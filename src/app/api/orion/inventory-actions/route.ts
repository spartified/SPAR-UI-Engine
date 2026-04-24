import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('admin')) {
        return NextResponse.json({ error: "Unauthorized. Root access required." }, { status: 403 });
    }

    const data = await req.json();
    const { action, iccid_list, account_id } = data;

    if (action !== 'ALLOCATE_TO_ACCOUNT') {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!iccid_list || iccid_list.length === 0 || !account_id) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const pool = await dbManager.getPool('ORION', (process.env as any).ORION_DB_URL);

        // Execute the bulk update safely
        const placeholders = iccid_list.map(() => '?').join(',');
        const query = `UPDATE esims SET account_id = ?, status = 'WARM' WHERE iccid IN (${placeholders})`;

        await pool.execute(query, [account_id, ...iccid_list]);

        await AuditLogger.log({
            username: auth.userId || 'api-key',
            screen: 'Inventory Management',
            action: 'Bulk Allocate ICCIDs',
            status: 'Success',
            details: `Allocated ${iccid_list.length} ICCIDs to Account ID ${account_id}`
        });

        return NextResponse.json({ success: true, allocated_count: iccid_list.length });
    } catch (error: any) {
        console.error("Bulk allocation failed:", error);
        return NextResponse.json({ error: "Database Allocation Failed" }, { status: 500 });
    }
}
