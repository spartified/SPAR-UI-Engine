import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-esims.json";

const schema = schemaRaw as any;

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { accountId } = params;

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Get hierarchy for the TARGET account
            const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
            const targetHierarchy = await getAccountHierarchy(Number(accountId));

            // Check if user has access to this account (authorization check)
            if (auth.accountId !== null && auth.accountId !== undefined) {
                const authHierarchy = await getAccountHierarchy(auth.accountId);
                if (!authHierarchy.includes(Number(accountId))) {
                    return NextResponse.json({ error: "Access Denied: Account outside of authorized hierarchy" }, { status: 403 });
                }
            }

            // Fetch SIMs for the entire target hierarchy
            const [rows]: any = await pool.execute(
                `SELECT * FROM ${schema.tableName} WHERE account_id IN (${targetHierarchy.join(',')})`
            );

            return NextResponse.json(rows);
        }
    } catch (error: any) {
        console.error("External API GET sims failed:", error);
        return NextResponse.json({ error: error.message || "Fetch Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
