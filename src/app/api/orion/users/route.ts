import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { KeycloakAdmin } from "@/core/utils/keycloak-admin";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-users.json";

const schema = schemaRaw as any;

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized. Permission required: orion:user:manage" }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        const coreConnectionString = process.env.CORE_DB_URL;

        if (connectionString && coreConnectionString) {
            const orionPool = await dbManager.getPool(poolName, connectionString);
            const corePool = await dbManager.getPool('CORE', coreConnectionString);

            const userAccountId = auth.accountId;
            let whereClause = "";
            if (userAccountId && !auth.permissions.includes('admin')) {
                const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
                const hierarchy = await getAccountHierarchy(userAccountId);
                if (hierarchy.length > 0) {
                    whereClause = ` WHERE account_id IN (${hierarchy.join(',')})`;
                }
            }

            const [orionUsers]: any = await orionPool.execute(`SELECT * FROM ${schema.tableName}${whereClause}`);

            const emails = orionUsers.map((u: any) => u.email).filter(Boolean);
            let platformData: any = {};

            if (emails.length > 0) {
                const placeholders = emails.map(() => '?').join(',');
                const [pRows]: any = await corePool.execute(`SELECT email, role FROM users WHERE email IN (${placeholders})`, emails);
                pRows.forEach((r: any) => {
                    platformData[r.email] = {
                        role: r.role
                    };
                });
            }

            const enrichedUsers = orionUsers.map((u: any) => ({
                ...u,
                role: platformData[u.email]?.role || u.role || 'viewer',
                permissions: u.permissions ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions) : []
            }));

            return NextResponse.json(enrichedUsers);
        }
        return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
    } catch (error: any) {
        console.error("Database Connection Failed (GET users):", error);
        return NextResponse.json({ error: error.message || "Fetch Failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized. Permission required: orion:user:manage" }, { status: 403 });
    }

    const data = await req.json();
    if (!data.first_name || !data.email || !data.account_id) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userAccountId = auth.accountId;
    if (userAccountId && !auth.permissions.includes('admin')) {
        const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
        const hierarchy = await getAccountHierarchy(userAccountId);
        if (!hierarchy.includes(Number(data.account_id))) {
            return NextResponse.json({ error: "Access Denied: Account ID out of authorized hierarchy" }, { status: 403 });
        }
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        const coreConnectionString = process.env.CORE_DB_URL;

        if (connectionString && coreConnectionString) {
            console.log(`[Provisioning] Creating Keycloak user for ${data.email}`);
            let keycloakId = '';
            try {
                keycloakId = await KeycloakAdmin.createUser(data.email, data.first_name, data.last_name || '');
            } catch (kcError: any) {
                console.error("[Provisioning] Keycloak failure:", kcError.message);
                return NextResponse.json({ error: "Identity Provider failure: " + kcError.message }, { status: 500 });
            }

            if (!keycloakId) {
                return NextResponse.json({ error: "Failed to resolve Keycloak ID" }, { status: 500 });
            }

            const orionPool = await dbManager.getPool(poolName, connectionString);
            const corePool = await dbManager.getPool('CORE', coreConnectionString);

            await corePool.execute(
                "INSERT INTO users (id, username, name, email, role) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP, role = VALUES(role)",
                [keycloakId, data.email, `${data.first_name} ${data.last_name || ''}`.trim(), data.email, data.role || 'viewer']
            );

            const orionData = { ...data };
            orionData.permissions = JSON.stringify(data.permissions || []);
            if (!orionData.role) orionData.role = 'viewer';

            const keys = Object.keys(orionData);
            const values = Object.values(orionData);
            const placeholders = keys.map(() => '?').join(', ');
            const sql = `INSERT INTO users (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
            await orionPool.execute(sql, values as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Insert',
                status: 'Success',
                details: `Synchronized user creation: ${data.email} (Account: ${data.account_id})`
            });

            return NextResponse.json({ ...data, keycloak_id: keycloakId }, { status: 201 });
        }
        return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
    } catch (error: any) {
        console.error("Database Save Failed (POST users):", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized. Permission required: orion:user:manage" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { _identifiers, role, permissions, ...data } = body;
        const email = _identifiers.email || data.email;

        const userAccountId = auth.accountId;
        if (userAccountId && data.account_id && !auth.permissions.includes('admin')) {
            const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
            const hierarchy = await getAccountHierarchy(userAccountId);
            if (!hierarchy.includes(Number(data.account_id))) {
                return NextResponse.json({ error: "Access Denied: Target account out of hierarchy" }, { status: 403 });
            }
        }

        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        const coreConnectionString = process.env.CORE_DB_URL;

        if (connectionString && coreConnectionString) {
            const orionPool = await dbManager.getPool(poolName, connectionString);
            const corePool = await dbManager.getPool('CORE', coreConnectionString);

            if (role || data.first_name || data.last_name) {
                const updateFields: any = {};
                if (role) updateFields.role = role;
                if (data.first_name || data.last_name) {
                    updateFields.name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
                }

                if (Object.keys(updateFields).length > 0) {
                    const setClause = Object.keys(updateFields).map(k => `\`${k}\` = ?`).join(', ');
                    await corePool.execute(`UPDATE users SET ${setClause} WHERE email = ?`, [...Object.values(updateFields), email]);
                }
            }

            const orionData = { ...data };
            if (role) orionData.role = role;
            if (permissions) orionData.permissions = JSON.stringify(permissions);

            const setClause = Object.keys(orionData).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(orionData);
            const whereClause = Object.keys(_identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(_identifiers);
            const sql = `UPDATE users SET ${setClause} WHERE ${whereClause}`;
            await orionPool.execute(sql, [...setValues, ...whereValues] as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Update',
                status: 'Success',
                details: `Updated user: ${email}`
            });

            return NextResponse.json({ success: true, data });
        }
        return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
    } catch (error: any) {
        console.error("Database Update Failed (PUT users):", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized || !auth.permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized. Permission required: orion:user:manage" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const id = body.id || body._identifiers?.id;
        const email = body.email || body._identifiers?.email || body._identifiers?.username || body.username;

        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        const coreConnectionString = process.env.CORE_DB_URL;

        if (connectionString) {
            if (email) {
                console.log(`[Orion Sync] Deleting Keycloak identity for ${email}`);
                try {
                    await KeycloakAdmin.deleteUser(email);
                } catch (kcErr) {
                    console.error("[Orion Sync] Keycloak delete failed:", kcErr);
                }
            }

            if (email && coreConnectionString) {
                const corePool = await dbManager.getPool('CORE', coreConnectionString);
                await corePool.execute("DELETE FROM users WHERE email = ?", [email]);
            }

            const orionPool = await dbManager.getPool(poolName, connectionString);
            const identifiers = body._identifiers || body;
            const whereClause = Object.keys(identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(identifiers);
            const sql = `DELETE FROM users WHERE ${whereClause}`;
            await orionPool.execute(sql, whereValues as any[]);

            await AuditLogger.log({
                username: auth.userId || 'api-key',
                screen: schema.title,
                action: 'Data Delete',
                status: 'Success',
                details: `Deleted user ${email}`
            });

            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
    } catch (error: any) {
        console.error("Database Delete Failed (DELETE users):", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }
}
