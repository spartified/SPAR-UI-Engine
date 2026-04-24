import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-aggregators.json";
import crypto from "crypto";

const schema = schemaRaw as any;

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:aggregator:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (auth.accountId !== 1 && !auth.permissions.includes('admin')) {
        return NextResponse.json({ error: "Unauthorized. Root access only." }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const [rows] = await pool.execute(`SELECT aak.*, a.name AS aggregator_name FROM ${schema.tableName} aak JOIN aggregators a ON aak.aggregator_id = a.id`);
            // Remove sensitive hash from responses
            const safeRows = (rows as any[]).map(({ api_key_hash, ...rest }) => rest);
            return NextResponse.json(safeRows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET aggregators):", error);
        return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
    }
    return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:aggregator:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (auth.accountId !== 1 && !auth.permissions.includes('admin')) {
        return NextResponse.json({ error: "Unauthorized. Root access only." }, { status: 403 });
    }

    const { api_key, api_key_masked: _ignoreMasked, ...data } = await req.json();

    if (!api_key || api_key.trim() === '') {
        return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    const api_key_hash = crypto.createHash('sha256').update(api_key.trim()).digest('base64');
    const api_key_masked = "************" + api_key.trim().slice(-4);

    const recordToInsert = { ...data, api_key_hash, api_key_masked };

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const keys = Object.keys(recordToInsert);
            const values = Object.values(recordToInsert);
            const placeholders = keys.map(() => '?').join(', ');
            const sql = `INSERT INTO ${schema.tableName} (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
            await pool.execute(sql, values as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Create Aggregator',
                status: 'Success',
                details: `Created aggregator API key setup for ID ${data.aggregator_id}`
            });

            return NextResponse.json({ success: true }, { status: 201 });
        }
    } catch (error: any) {
        console.error("Database Save Failed:", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function PUT(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:aggregator:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (auth.accountId !== 1 && !auth.permissions.includes('admin')) {
        return NextResponse.json({ error: "Unauthorized. Root access only." }, { status: 403 });
    }

    const { _identifiers, api_key, api_key_masked: _ignoreMasked, ...data } = await req.json();

    const recordToUpdate = { ...data };

    if (api_key && api_key.trim() !== '') {
        recordToUpdate.api_key_hash = crypto.createHash('sha256').update(api_key.trim()).digest('base64');
        recordToUpdate.api_key_masked = "************" + api_key.trim().slice(-4);
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const setClause = Object.keys(recordToUpdate).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(recordToUpdate);
            const whereClause = Object.keys(_identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(_identifiers);
            const sql = `UPDATE ${schema.tableName} SET ${setClause} WHERE ${whereClause}`;
            await pool.execute(sql, [...setValues, ...whereValues] as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Update Aggregator',
                status: 'Success',
                details: `Updated aggregator ID ${_identifiers.id}. API Key updated: ${!!api_key}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Update Failed:", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:aggregator:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (auth.accountId !== 1 && !auth.permissions.includes('admin')) {
        return NextResponse.json({ error: "Unauthorized. Root access only." }, { status: 403 });
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
                action: 'Delete Aggregator',
                status: 'Success',
                details: `Deleted aggregator. WHERE ${whereClause}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Delete Failed:", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
