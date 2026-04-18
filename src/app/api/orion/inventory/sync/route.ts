import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inventory, sims, aggregator_id } = await req.json();

    if (!inventory || !sims || !Array.isArray(sims)) {
        return NextResponse.json({ error: "Invalid payload: inventory and sims (array) are required." }, { status: 400 });
    }

    try {
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Ensure inventory_batches record exists
            // Mapping remote fields: id, name, created_date, modified_date, status
            // Local fields: inventory_id, account_id, status, aggregator (name)
            const [batchRows]: any = await connection.execute(
                'SELECT id FROM inventory_batches WHERE inventory_id = ?',
                [inventory.id.toString()]
            );

            let localBatchId;
            if (batchRows.length > 0) {
                localBatchId = batchRows[0].id;
                // Update status if needed
                await connection.execute(
                    'UPDATE inventory_batches SET status = ? WHERE id = ?',
                    [inventory.status === 'Active' ? 'AVAILABLE' : 'FULLY_ALLOCATED', localBatchId]
                );
            } else {
                const [insertResult]: any = await connection.execute(
                    'INSERT INTO inventory_batches (inventory_id, account_id, status, aggregator, total_count, available_count) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        inventory.id.toString(),
                        (session.user as any).account_id || 1,
                        inventory.status === 'Active' ? 'AVAILABLE' : 'FULLY_ALLOCATED',
                        inventory.aggregator_name || 'Telna',
                        sims.length,
                        sims.length
                    ]
                );
                localBatchId = insertResult.insertId;
            }

            // 2. Upsert SIMs (key is ICCID)
            // Fields: iccid, mapped_imsi, batch_id, account_id, status
            for (const sim of sims) {
                await connection.execute(
                    `INSERT INTO esims (iccid, mapped_imsi, batch_id, account_id, status) 
                     VALUES (?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                     mapped_imsi = VALUES(mapped_imsi), 
                     batch_id = VALUES(batch_id), 
                     status = VALUES(status)`,
                    [
                        sim.iccid,
                        sim.mapped_imsi || null,
                        localBatchId,
                        (session.user as any).account_id || 1,
                        sim.sim_status === 'active' ? 'ACTIVATED' : 'AVAILABLE'
                    ]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true, localBatchId });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error: any) {
        console.error("Sync failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
