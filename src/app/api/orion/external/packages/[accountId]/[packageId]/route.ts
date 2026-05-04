import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";

/**
 * External API: Fetch specific plan details
 * GET /api/orion/external/packages/[accountId]/[packageId]
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { accountId: string; packageId: string } }
) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const requestedAccountId = parseInt(params.accountId);
    const packageId = parseInt(params.packageId);

    // Security check
    const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
    const hierarchy = await getAccountHierarchy(auth.accountId!);
    
    if (!hierarchy.includes(requestedAccountId)) {
        return NextResponse.json({ error: "Access denied to this account context" }, { status: 403 });
    }

    try {
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL!);
        const [rows]: any = await pool.execute(
            `SELECT pt.*, a.name as account_name
             FROM package_templates pt
             LEFT JOIN accounts a ON pt.account_id = a.id
             WHERE pt.id = ? AND pt.account_id IN (${hierarchy.join(',')}) LIMIT 1`,
            [packageId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: "Package not found" }, { status: 404 });
        }

        // Parse supported_countries if it's a string
        const result = rows[0];
        if (typeof result.supported_countries === 'string') {
            try {
                result.supported_countries = JSON.parse(result.supported_countries);
            } catch (e) {}
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[External API] Package Details Failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
