import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-accounts.json";

const schema = schemaRaw as any;

// Mock data for development
let mockAccounts = [
    { id: 1, name: 'Spartified Global', parent_id: null, type: 'ROOT', state: 'PRODUCTION', billing_enabled: true, classifier: 'IOT', contact_first_name: 'Admin', contact_last_name: 'User', contact_email: 'admin@spartified.com', contact_phone: '+1234567890', status: 'ACTIVE', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: 2, name: 'Acme Enterprise', parent_id: 1, type: 'ENTERPRISE', state: 'PRODUCTION', billing_enabled: true, classifier: 'IOT', contact_first_name: 'John', contact_last_name: 'Doe', contact_email: 'john@acme.com', contact_phone: '+1987654321', status: 'ACTIVE', created_at: '2025-02-01T00:00:00Z', updated_at: '2025-02-01T00:00:00Z' },
    { id: 3, name: 'Acme Reseller A', parent_id: 2, type: 'RESELLER', state: 'TRIAL', billing_enabled: false, classifier: 'IOT', contact_first_name: 'Jane', contact_last_name: 'Smith', contact_email: 'jane@reseller.com', contact_phone: '+1122334455', status: 'ACTIVE', created_at: '2025-03-01T00:00:00Z', updated_at: '2025-03-01T00:00:00Z' },
    { id: 4, name: 'TravelSIM Corp', parent_id: 1, type: 'ENTERPRISE', state: 'PRODUCTION', billing_enabled: true, classifier: 'TRAVELSIM', contact_first_name: 'Mike', contact_last_name: 'Travel', contact_email: 'mike@travelsim.com', contact_phone: '+1555666777', status: 'ACTIVE', created_at: '2025-04-01T00:00:00Z', updated_at: '2025-04-01T00:00:00Z' },
    { id: 5, name: 'Customer Alpha', parent_id: 3, type: 'CUSTOMER', state: 'TRIAL', billing_enabled: false, classifier: 'IOT', contact_first_name: 'Alice', contact_last_name: 'Alpha', contact_email: 'alice@alpha.com', contact_phone: '+1999888777', status: 'ACTIVE', created_at: '2025-05-01T00:00:00Z', updated_at: '2025-05-01T00:00:00Z' },
];

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:account:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const userAccountId = (auth as any).accountId;
            let query = `SELECT * FROM ${schema.tableName}`;

            let whereConditions = [];
            const filter = schema.metadataConfig?.listFilter;
            if (filter) whereConditions.push(filter);

            if (userAccountId) {
                const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
                const hierarchy = await getAccountHierarchy(userAccountId);
                if (hierarchy.length > 0) {
                    whereConditions.push(`id IN (${hierarchy.join(',')})`);
                }
            }

            if (whereConditions.length > 0) {
                query += ` WHERE ${whereConditions.join(' AND ')}`;
            }

            const [rows] = await pool.execute(query);
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET accounts):", error);
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
        }
    }

    return NextResponse.json(mockAccounts);
}

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:account:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    if (!data.name || !data.type) {
        return NextResponse.json({ error: "Missing required fields: name, type" }, { status: 400 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            if (data.type === 'ROOT') {
                const [existingRoot] = await pool.execute(`SELECT id FROM ${schema.tableName} WHERE type = 'ROOT' AND status != 'DELETED' LIMIT 1`);
                if ((existingRoot as any[]).length > 0) {
                    return NextResponse.json({ error: "A Root account already exists. Only one Root account is permitted." }, { status: 400 });
                }
            }

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
                details: `Inserted account: ${JSON.stringify(data)}`
            });

            return NextResponse.json(data, { status: 201 });
        }
    } catch (error: any) {
        console.error("Database Save Failed (POST accounts):", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }

    const newAccount = { id: Math.max(...mockAccounts.map(a => a.id)) + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    mockAccounts.push(newAccount);
    return NextResponse.json(newAccount, { status: 201 });
}

export async function PUT(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:account:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { _identifiers, ...data } = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            if (data.type === 'ROOT') {
                const idValues = Object.values(_identifiers);
                const [existingRoot] = await pool.execute(`SELECT id FROM ${schema.tableName} WHERE type = 'ROOT' AND status != 'DELETED' AND id != ? LIMIT 1`, [idValues[0]]);
                if ((existingRoot as any[]).length > 0) {
                    return NextResponse.json({ error: "A Root account already exists. Only one Root account is permitted." }, { status: 400 });
                }
            }

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
                details: `Updated account. SQL: ${sql}`
            });

            return NextResponse.json({ success: true, data });
        }
    } catch (error: any) {
        console.error("Database Update Failed (PUT accounts):", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions?.includes('orion:account:manage')) {
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

            // Soft delete — set status to DELETED
            const sql = `UPDATE ${schema.tableName} SET \`status\` = 'DELETED' WHERE ${whereClause}`;
            await pool.execute(sql, whereValues as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Delete',
                status: 'Success',
                details: `Soft-deleted account. WHERE ${whereClause}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Delete Failed (DELETE accounts):", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
