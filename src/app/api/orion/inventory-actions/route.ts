import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-esims.json";

const schema = schemaRaw as any;

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { account_id, iccid_list } = await req.json();

    if (!account_id || !iccid_list || !Array.isArray(iccid_list)) {
        return NextResponse.json({ error: "Missing required fields: account_id, iccid_list" }, { status: 400 });
    }

    try {
        const pool = await dbManager.getPool(schema.dbPool, process.env[`${schema.dbPool}_DB_URL`]!);

        // Bulk update account_id for the provided ICCIDs
        const placeholders = iccid_list.map(() => '?').join(',');
        const sql = `UPDATE ${schema.tableName} SET account_id = ? WHERE iccid IN (${placeholders})`;
        await pool.execute(sql, [account_id, ...iccid_list] as any[]);

        await AuditLogger.log({
            username: auth.userId || 'api-key',
            screen: 'Inventory Actions',
            action: 'Bulk Allocate',
            status: 'Success',
            details: `Allocated ${iccid_list.length} ICCIDs to account ${account_id}`
        });

        return NextResponse.json({ success: true, count: iccid_list.length });
    } catch (error: any) {
        console.error("Bulk allocation failed:", error);
        return NextResponse.json({ error: error.message || "Allocation Failed" }, { status: 500 });
    }
}
