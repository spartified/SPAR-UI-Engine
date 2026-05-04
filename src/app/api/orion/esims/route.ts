import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { aggregatorService } from "@/app/api/orion/services/aggregator-service";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-esims.json";

const schema = schemaRaw as any;

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:esim:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            let query = `
                SELECT e.*, pt.name as package_name, a.name as account_name
                FROM ${schema.tableName} e
                LEFT JOIN package_templates pt ON e.package_id = pt.id
                LEFT JOIN accounts a ON e.account_id = a.id
            `;

            if (auth.accountId !== null && auth.accountId !== undefined) {
                const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
                const hierarchy = await getAccountHierarchy(auth.accountId);
                if (hierarchy.length > 0) {
                    query += ` WHERE e.account_id IN (${hierarchy.join(',')})`;
                }
            }

            const [rows] = await pool.execute(query);
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET esims):", error);
        return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
    }
    return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:esim:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    if (!data.iccid) {
        return NextResponse.json({ error: "Missing required field: iccid" }, { status: 400 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const keys = Object.keys(data);
            const values = Object.values(data);
            const placeholders = keys.map(() => '?').join(', ');
            const sql = `INSERT INTO ${schema.tableName} (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
            await pool.execute(sql, values as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Insert',
                status: 'Success',
                details: `Inserted eSIM: ${JSON.stringify(data)}`
            });

            return NextResponse.json(data, { status: 201 });
        }
    } catch (error: any) {
        console.error("Database Save Failed (POST esims):", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "Operation Failed" }, { status: 500 });
}

export async function PUT(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:esim:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { _identifiers, ...data } = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Valid columns for filtering
            const validColumns = [
                'mapped_imsi', 'batch_id', 'account_id', 'package_id',
                'status', 'assigned_user_id', 'remote_id', 'sync_status'
            ];

            // 1. Detect package change for sync
            if (data.package_id) {
                const iccid = _identifiers.iccid;
                const [existing]: any = await pool.execute(
                    `SELECT e.package_id, k.id as aggregator_id 
                     FROM ${schema.tableName} e
                     JOIN inventory_batches b ON e.batch_id = b.id
                     JOIN aggregators a ON b.aggregator = a.name
                     JOIN aggregator_api_keys k ON a.id = k.aggregator_id
                     WHERE e.iccid = ?`,
                    [iccid]
                );

                if (existing.length > 0 && existing[0].package_id !== Number(data.package_id)) {
                    console.log(`[ESIM Sync] Package change detected for ${iccid}: ${existing[0].package_id} -> ${data.package_id}`);

                    // Resolve remote_id for the package
                    const [pkg]: any = await pool.execute(
                        'SELECT remote_id FROM package_templates WHERE id = ?',
                        [data.package_id]
                    );

                    if (pkg.length > 0 && pkg[0].remote_id) {
                        try {
                            const aggregatorId = existing[0].aggregator_id;
                            await aggregatorService.subscribePackage(aggregatorId, iccid, pkg[0].remote_id);
                            console.log(`[ESIM Sync] Successfully synced package change to aggregator.`);
                            // If it was AVAILABLE, mark as ACTIVATED now that a package is assigned
                            if (data.status === 'AVAILABLE') {
                                data.status = 'ACTIVATED';
                            }
                        } catch (err: any) {
                            console.error(`[ESIM Sync] Aggregator subscription failed:`, err.message);
                            throw new Error("Failed to sync package change with carrier: " + err.message);
                        }
                    }
                }
            }

            // 2. Filter input data to only include valid columns
            const filteredData: any = {};
            validColumns.forEach(col => {
                if (data[col] !== undefined) filteredData[col] = data[col];
            });

            if (Object.keys(filteredData).length === 0) {
                return NextResponse.json({ success: true, message: "No fields to update" });
            }

            const setClause = Object.keys(filteredData).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(filteredData);
            const whereClause = Object.keys(_identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(_identifiers);
            const sql = `UPDATE ${schema.tableName} SET ${setClause} WHERE ${whereClause}`;
            await pool.execute(sql, [...setValues, ...whereValues] as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Update',
                status: 'Success',
                details: `Updated eSIM. SQL: ${sql}`
            });

            return NextResponse.json({ success: true, data });
        }
    } catch (error: any) {
        console.error("Database Update Failed (PUT esims):", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "Operation Failed" }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:esim:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const identifiers = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const whereClause = Object.keys(identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(identifiers);
            const sql = `DELETE FROM ${schema.tableName} WHERE ${whereClause}`;
            await pool.execute(sql, whereValues as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Delete',
                status: 'Success',
                details: `Deleted eSIM. WHERE ${whereClause}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Delete Failed (DELETE esims):", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "Operation Failed" }, { status: 500 });
}
