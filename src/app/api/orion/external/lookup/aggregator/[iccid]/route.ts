import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";

/**
 * External API: Lookup Aggregator ID for an ICCID
 * GET /api/orion/external/lookup/aggregator/[iccid]
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { iccid: string } }
) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const iccid = params.iccid;

    try {
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL!);
        
        // Logic: Join esims -> inventory_batches -> aggregators
        const query = `
            SELECT 
                e.iccid, 
                e.account_id as orion_account_id,
                a.id as aggregator_id,
                a.name as aggregator_name
            FROM esims e
            JOIN inventory_batches b ON e.batch_id = b.id
            JOIN aggregators a ON b.aggregator = a.name
            WHERE e.iccid = ? LIMIT 1
        `;

        const [rows]: any = await pool.execute(query, [iccid]);

        if (rows.length === 0) {
            return NextResponse.json({ error: "ICCID not found in inventory" }, { status: 404 });
        }

        const result = rows[0];

        // Security: Ensure the user has permission to see this SIM
        const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
        const hierarchy = await getAccountHierarchy(auth.accountId!);
        
        if (!hierarchy.includes(result.orion_account_id)) {
            return NextResponse.json({ error: "Access denied to this SIM context" }, { status: 403 });
        }

        return NextResponse.json({
            iccid: result.iccid,
            aggregator_id: result.aggregator_id,
            aggregator_name: result.aggregator_name,
            orion_account_id: result.orion_account_id
        });

    } catch (error: any) {
        console.error("[External API] Aggregator Lookup Failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
