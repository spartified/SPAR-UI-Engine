import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { inventory, sims, aggregator_id } = await req.json();

    try {
        const pool = await dbManager.getPool('orion', process.env.ORION_DB_URL!);

        // 1. Create or Update Batch
        const [batchResult]: any = await pool.execute(
            "INSERT INTO inventory_batches (inventory_id, aggregator_id, status, total_count) VALUES (?, ?, 'SYNCED', ?) ON DUPLICATE KEY UPDATE status = 'SYNCED'",
            [inventory.id, aggregator_id, sims.length]
        );

        const batchDbId = batchResult.insertId || (await pool.execute("SELECT id FROM inventory_batches WHERE inventory_id = ?", [inventory.id]) as any)[0][0].id;

        // 2. Insert SIMs
        for (const sim of sims) {
            await pool.execute(
                "INSERT INTO esims (iccid, mapped_imsi, batch_id, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)",
                [sim.iccid, sim.mapped_imsi, batchDbId, inventory.status || 'AVAILABLE']
            );
        }

        return NextResponse.json({ success: true, localBatchId: batchDbId });
    } catch (error: any) {
        console.error("Failed to sync inventory:", error);
        return NextResponse.json({ error: error.message || "Sync Failed" }, { status: 500 });
    }
}
