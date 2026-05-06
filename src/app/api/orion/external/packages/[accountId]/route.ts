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

            // Resolve hierarchy for the target account to include all sub-accounts
            const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
            const targetHierarchy = await getAccountHierarchy(Number(accountId));

            // Fetch Packages for the specific account and its sub-accounts
            const [rows]: any = await pool.execute(
                `SELECT * FROM package_templates WHERE account_id IN (${targetHierarchy.join(',')})`,
                []
            );
            
            // Parse supported_countries JSON
            const results = rows.map((r: any) => {
                if (typeof r.supported_countries === 'string') {
                    try {
                        r.supported_countries = JSON.parse(r.supported_countries);
                    } catch (e) {
                        r.supported_countries = [];
                    }
                }
                return r;
            });

            return NextResponse.json(results);
        }
    } catch (error: any) {
        console.error("External API GET packages failed:", error);
        return NextResponse.json({ error: error.message || "Fetch Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
