import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idsString = searchParams.get('ids');
    if (!idsString) {
        return NextResponse.json({ syncedIds: [] });
    }

    const ids = idsString.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) {
        return NextResponse.json({ syncedIds: [] });
    }

    try {
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL);
        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT inventory_id FROM inventory_batches WHERE inventory_id IN (${placeholders})`;
        const [rows]: any = await pool.execute(sql, ids);

        const syncedIds = rows.map((row: any) => row.inventory_id);
        return NextResponse.json({ syncedIds });
    } catch (error: any) {
        console.error("Error checking sync status:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
