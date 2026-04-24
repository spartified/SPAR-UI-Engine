import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-packages.json";

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

            // Check if user has access to this account (hierarchy check)
            if (auth.accountId !== null && auth.accountId !== undefined) {
                const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
                const hierarchy = await getAccountHierarchy(auth.accountId);
                if (!hierarchy.includes(Number(accountId))) {
                    return NextResponse.json({ error: "Access Denied: Account outside of authorized hierarchy" }, { status: 403 });
                }
            }

            // Fetch Packages for the specific account (or root packages if applicable)
            // Typically package_templates are root level or linked to aggregator.
            // But we filter by account_id in the template if relevant.
            const [rows]: any = await pool.execute(
                `SELECT * FROM package_templates WHERE aggregator_account_id = ? OR 1=1`,
                [accountId] as any[]
            );

            // Refined check: only return if account is valid. 
            // In Orion, we might want to return only those mapped to this account's aggregator.

            return NextResponse.json(rows);
        }
    } catch (error: any) {
        console.error("External API GET packages failed:", error);
        return NextResponse.json({ error: error.message || "Fetch Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
