import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";

const DB_POOL = "ORION";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:esim:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { action, esim_ids, account_id } = await req.json();

    // Validate action
    const validActions = ['ACTIVATE', 'DEACTIVATE', 'SUSPEND', 'RESUME', 'ALLOCATE_SUBACCOUNT'];
    if (!validActions.includes(action)) {
        return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    if (!esim_ids || !Array.isArray(esim_ids) || esim_ids.length === 0) {
        return NextResponse.json({ error: "esim_ids must be a non-empty array" }, { status: 400 });
    }

    if (action === 'ALLOCATE_SUBACCOUNT' && !account_id) {
        return NextResponse.json({ error: "account_id is required for ALLOCATE_SUBACCOUNT" }, { status: 400 });
    }

    // Map action to new eSIM status
    const statusMap: Record<string, string> = {
        'ACTIVATE': 'ACTIVATED',
        'DEACTIVATE': 'DEACTIVATED',
        'SUSPEND': 'SUSPENDED',
        'RESUME': 'ACTIVATED',
    };

    const newStatus = statusMap[action];
    const userId = (session.user as any).id || 0;
    const username = (session.user as any).email || (session.user as any).name;

    try {
        const connectionString = (process.env as any)[`${DB_POOL}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(DB_POOL, connectionString);

            // Update eSIM statuses or account_id
            const placeholders = esim_ids.map(() => '?').join(', ');

            if (action === 'ALLOCATE_SUBACCOUNT') {
                const updateSql = `UPDATE esims SET account_id = ?, updated_at = NOW() WHERE id IN (${placeholders})`;
                await pool.execute(updateSql, [account_id, ...esim_ids]);
            } else {
                const updateSql = `UPDATE esims SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`;
                await pool.execute(updateSql, [newStatus, ...esim_ids]);
            }

            // Insert lifecycle action records
            for (const esimId of esim_ids) {
                const insertSql = `INSERT INTO esim_lifecycle_actions (esim_id, action, performed_by, account_id, status, request_payload, created_at) VALUES (?, ?, ?, NULL, 'SUCCESS', ?, NOW())`;
                await pool.execute(insertSql, [
                    esimId,
                    action,
                    userId,
                    JSON.stringify({ action, esim_ids }),
                ]);
            }

            await AuditLogger.log({
                username,
                screen: 'Device Lifecycle Control Center',
                action: 'Bulk Action',
                status: 'Success',
                details: `${action} performed on ${esim_ids.length} eSIM(s). IDs: ${esim_ids.join(', ')}`
            });

            return NextResponse.json({
                success: true,
                message: `${action} completed for ${esim_ids.length} eSIM(s)`,
                affected: esim_ids.length,
                newStatus
            });
        }
    } catch (error: any) {
        console.error(`Bulk ${action} Failed:`, error);

        // Log failed actions
        try {
            const connectionString = (process.env as any)[`${DB_POOL}_DB_URL`];
            if (connectionString) {
                const pool = await dbManager.getPool(DB_POOL, connectionString);
                for (const esimId of esim_ids) {
                    const insertSql = `INSERT INTO esim_lifecycle_actions (esim_id, action, performed_by, account_id, status, request_payload, response_payload, created_at) VALUES (?, ?, ?, NULL, 'FAILED', ?, ?, NOW())`;
                    await pool.execute(insertSql, [
                        esimId,
                        action,
                        userId,
                        JSON.stringify({ action, esim_ids }),
                        JSON.stringify({ error: error.message }),
                    ]);
                }
            }
        } catch (logError) {
            console.error("Failed to log lifecycle action:", logError);
        }

        return NextResponse.json({ error: error.message || `Bulk ${action} Failed` }, { status: 500 });
    }

    // Mock fallback for development
    return NextResponse.json({
        success: true,
        message: `[MOCK] ${action} completed for ${esim_ids.length} eSIM(s)`,
        affected: esim_ids.length,
        newStatus
    });
}

// GET: Retrieve lifecycle action history
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:esim:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const connectionString = (process.env as any)[`${DB_POOL}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(DB_POOL, connectionString);
            const [rows] = await pool.execute(
                `SELECT ela.*, e.iccid FROM esim_lifecycle_actions ela LEFT JOIN esims e ON ela.esim_id = e.id ORDER BY ela.created_at DESC LIMIT 100`
            );
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET esim-actions):", error);
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
        }
    }

    // Mock data
    return NextResponse.json([
        { id: 1, esim_id: 1, iccid: '8901234560000000001', action: 'ACTIVATE', performed_by: 1, status: 'SUCCESS', created_at: '2025-03-01T10:00:00Z' },
        { id: 2, esim_id: 3, iccid: '8901234560000000003', action: 'SUSPEND', performed_by: 1, status: 'SUCCESS', created_at: '2025-03-15T14:30:00Z' },
        { id: 3, esim_id: 6, iccid: '8901234560000002001', action: 'DEACTIVATE', performed_by: 1, status: 'SUCCESS', created_at: '2025-03-25T09:15:00Z' },
    ]);
}
