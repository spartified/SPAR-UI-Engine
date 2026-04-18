import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-inventory.json";

const schema = schemaRaw as any;

let mockInventory = [
    { id: 1, inventory_id: 'INV-001', account_id: 1, start_iccid: '8901234560000000001', end_iccid: '8901234560000001000', total_count: 1000, available_count: 750, aggregator: 'Aggregator-A', rate_plan_id: null, status: 'PARTIALLY_ALLOCATED', created_at: '2025-01-15T00:00:00Z' },
    { id: 2, inventory_id: 'INV-002', account_id: 2, start_iccid: '8901234560000001001', end_iccid: '8901234560000002000', total_count: 1000, available_count: 1000, aggregator: 'Aggregator-B', rate_plan_id: null, status: 'AVAILABLE', created_at: '2025-02-20T00:00:00Z' },
    { id: 3, inventory_id: 'INV-003', account_id: 1, start_iccid: '8901234560000002001', end_iccid: '8901234560000002500', total_count: 500, available_count: 0, aggregator: 'Aggregator-A', rate_plan_id: null, status: 'FULLY_ALLOCATED', created_at: '2025-03-10T00:00:00Z' },
];

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    if (!auth.permissions?.includes('orion:inventory:manage') && !auth.permissions?.includes('dashboard:read')) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Handle filtering
            const aggregator = req.nextUrl.searchParams.get('aggregator');
            let query = `SELECT * FROM ${schema.tableName}`;
            let params: any[] = [];

            if (aggregator) {
                query += ` WHERE aggregator = ?`;
                params.push(aggregator);
            }

            // Account Scoping
            if (auth.accountId !== null && auth.accountId !== undefined) {
                query += aggregator ? ` AND account_id = ?` : ` WHERE account_id = ?`;
                params.push(auth.accountId);
            }

            const [rows] = await pool.execute(query, params);
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET inventory):", error);
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
        }
    }

    return NextResponse.json(mockInventory);
}

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:inventory:manage')) {
        return NextResponse.json({ error: "Unauthorized. Permission required." }, { status: 403 });
    }

    const data = await req.json();
    if (!data.inventory_id || !data.account_id || !data.start_iccid || !data.end_iccid) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
                details: `Inserted inventory batch: ${JSON.stringify(data)}`
            });

            return NextResponse.json(data, { status: 201 });
        }
    } catch (error: any) {
        console.error("Database Save Failed (POST inventory):", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }

    const newBatch = { id: Math.max(...mockInventory.map(i => i.id)) + 1, ...data, created_at: new Date().toISOString() };
    mockInventory.push(newBatch);
    return NextResponse.json(newBatch, { status: 201 });
}

export async function PUT(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:inventory:manage')) {
        return NextResponse.json({ error: "Unauthorized. Permission required." }, { status: 403 });
    }

    const { _identifiers, ...data } = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const setClause = Object.keys(data).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(data);
            const whereClause = Object.keys(_identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(_identifiers);
            const sql = `UPDATE ${schema.tableName} SET ${setClause} WHERE ${whereClause}`;
            await pool.execute(sql, [...setValues, ...whereValues] as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Update',
                status: 'Success',
                details: `Updated inventory batch. SQL: ${sql}`
            });

            return NextResponse.json({ success: true, data });
        }
    } catch (error: any) {
        console.error("Database Update Failed (PUT inventory):", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:inventory:manage')) {
        return NextResponse.json({ error: "Unauthorized. Permission required." }, { status: 403 });
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
                details: `Deleted inventory batch. WHERE ${whereClause}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Delete Failed (DELETE inventory):", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
