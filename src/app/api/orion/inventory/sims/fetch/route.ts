import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const inventoryId = searchParams.get('inventoryId');

    if (!inventoryId) {
        return NextResponse.json({ error: "Missing inventoryId" }, { status: 400 });
    }

    try {
        const pool = await dbManager.getPool('orion', process.env.ORION_DB_URL!);
        const [rows]: any = await pool.execute(
            "SELECT * FROM esims WHERE batch_id = (SELECT id FROM inventory_batches WHERE inventory_id = ? LIMIT 1)",
            [inventoryId]
        );

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error("Failed to fetch SIMs for inventory:", error);
        return NextResponse.json({ error: error.message || "Fetch Failed" }, { status: 500 });
    }
}
