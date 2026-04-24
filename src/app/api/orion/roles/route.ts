import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-roles.json";

const schema = schemaRaw as any;

let mockRoles = [
    { id: 1, name: 'Super Admin', description: 'Full system access', account_id: 1 },
    { id: 2, name: 'Account Manager', description: 'Manage accounts and users', account_id: 1 },
    { id: 3, name: 'eSIM Operator', description: 'Manage eSIM inventory and lifecycle', account_id: 2 },
    { id: 4, name: 'Viewer', description: 'Read-only access', account_id: 2 },
];

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:role:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const [rows] = await pool.execute(`SELECT * FROM ${schema.tableName}`);
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET roles):", error);
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
        }
    }

    return NextResponse.json(mockRoles);
}

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:role:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    if (!data.name) {
        return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
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
                details: `Inserted role: ${JSON.stringify(data)}`
            });

            return NextResponse.json(data, { status: 201 });
        }
    } catch (error: any) {
        console.error("Database Save Failed (POST roles):", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }

    const newRole = { id: Math.max(...mockRoles.map(r => r.id)) + 1, ...data };
    mockRoles.push(newRole);
    return NextResponse.json(newRole, { status: 201 });
}

export async function PUT(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:role:manage')) {
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
                details: `Updated role. SQL: ${sql}`
            });

            return NextResponse.json({ success: true, data });
        }
    } catch (error: any) {
        console.error("Database Update Failed (PUT roles):", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:role:manage')) {
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
                details: `Deleted role. WHERE ${whereClause}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Delete Failed (DELETE roles):", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
