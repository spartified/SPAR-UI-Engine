import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";

/**
 * External API: Fetch specific ICCID details
 * GET /api/orion/external/sims/[accountId]/[iccid]
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { accountId: string; iccid: string } }
) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const requestedAccountId = parseInt(params.accountId);
    const iccid = params.iccid;

    // Security: Ensure requested account matches or is a child of the authenticated account
    const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
    const hierarchy = await getAccountHierarchy(auth.accountId!);
    
    if (!hierarchy.includes(requestedAccountId)) {
        return NextResponse.json({ error: "Access denied to this account context" }, { status: 403 });
    }

    try {
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL!);
        const [rows]: any = await pool.execute(
            `SELECT e.*, pt.name as package_name, a.name as account_name
             FROM esims e
             LEFT JOIN package_templates pt ON e.package_id = pt.id
             LEFT JOIN accounts a ON e.account_id = a.id
             WHERE e.account_id = ? AND e.iccid = ? LIMIT 1`,
            [requestedAccountId, iccid]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: "SIM not found" }, { status: 404 });
        }

        return NextResponse.json(rows[0]);
    } catch (error: any) {
        console.error("[External API] SIM Details Failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
