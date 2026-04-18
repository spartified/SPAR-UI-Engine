import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-esims.json";

const schema = schemaRaw as any;

let mockEsims = [
    { id: 1, iccid: '8901234560000000001', batch_id: 1, account_id: 1, status: 'ACTIVATED', assigned_user_id: null, created_at: '2025-01-15T00:00:00Z', updated_at: '2025-03-01T00:00:00Z' },
    { id: 2, iccid: '8901234560000000002', batch_id: 1, account_id: 1, status: 'ACTIVATED', assigned_user_id: null, created_at: '2025-01-15T00:00:00Z', updated_at: '2025-03-01T00:00:00Z' },
    { id: 3, iccid: '8901234560000000003', batch_id: 1, account_id: 2, status: 'SUSPENDED', assigned_user_id: null, created_at: '2025-01-15T00:00:00Z', updated_at: '2025-03-15T00:00:00Z' },
    { id: 4, iccid: '8901234560000000004', batch_id: 1, account_id: 2, status: 'AVAILABLE', assigned_user_id: null, created_at: '2025-01-15T00:00:00Z', updated_at: '2025-01-15T00:00:00Z' },
    { id: 5, iccid: '8901234560000001001', batch_id: 2, account_id: 2, status: 'ALLOCATED', assigned_user_id: null, created_at: '2025-02-20T00:00:00Z', updated_at: '2025-02-20T00:00:00Z' },
    { id: 6, iccid: '8901234560000002001', batch_id: 3, account_id: 1, status: 'DEACTIVATED', assigned_user_id: null, created_at: '2025-03-10T00:00:00Z', updated_at: '2025-03-25T00:00:00Z' },
];

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
            const values = [];

            if (auth.accountId !== null && auth.accountId !== undefined) {
                const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
                const hierarchy = await getAccountHierarchy(auth.accountId);
                if (hierarchy.length > 0) {
                    query += ` WHERE e.account_id IN (${hierarchy.join(',')})`;
                }
            }

            const [rows] = await pool.execute(query, values);
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET esims):", error);
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
        }
    }

    return NextResponse.json(mockEsims);
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

    const newEsim = { id: Math.max(...mockEsims.map(e => e.id)) + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    mockEsims.push(newEsim);
    return NextResponse.json(newEsim, { status: 201 });
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
                details: `Updated eSIM. SQL: ${sql}`
            });

            return NextResponse.json({ success: true, data });
        }
    } catch (error: any) {
        console.error("Database Update Failed (PUT esims):", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
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

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
