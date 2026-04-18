import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { KeycloakAdmin } from "@/core/utils/keycloak-admin";
import schemaRaw from "@/schemas/orion-users.json";

const schema = schemaRaw as any;

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        const coreConnectionString = process.env.CORE_DB_URL;

        if (connectionString && coreConnectionString) {
            const orionPool = await dbManager.getPool(poolName, connectionString);
            const corePool = await dbManager.getPool('CORE', coreConnectionString);

            const userAccountId = (session?.user as any)?.productContexts?.ORION?.accountId || (session?.user as any)?.account_id;
            let whereClause = "";
            if (userAccountId) {
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
                const [pRows]: any = await corePool.execute(`SELECT email, role, permissions FROM users WHERE email IN (${placeholders})`, emails);
                pRows.forEach((r: any) => {
                    platformData[r.email] = {
                        role: r.role,
                        permissions: r.permissions ? (typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions) : []
                    };
                });
            }

            const enrichedUsers = orionUsers.map((u: any) => ({
                ...u,
                role: platformData[u.email]?.role || 'viewer',
                permissions: platformData[u.email]?.permissions || []
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
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    if (!data.first_name || !data.email || !data.account_id) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userAccountId = (session?.user as any)?.productContexts?.ORION?.accountId || (session?.user as any)?.account_id;
    if (userAccountId) {
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
                "INSERT INTO users (id, username, name, email, role, permissions) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP, role = VALUES(role), permissions = VALUES(permissions)",
                [keycloakId, data.email, `${data.first_name} ${data.last_name || ''}`.trim(), data.email, data.role || 'viewer', JSON.stringify(data.permissions || [])]
            );

            const { role, permissions, ...orionData } = data;
            const keys = Object.keys(orionData);
            const values = Object.values(orionData);
            const placeholders = keys.map(() => '?').join(', ');
            const sql = `INSERT INTO users (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
            await orionPool.execute(sql, values as any[]);

            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
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
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { _identifiers, role, permissions, ...data } = body;
        const email = _identifiers.email || data.email;

        const userAccountId = (session?.user as any)?.productContexts?.ORION?.accountId || (session?.user as any)?.account_id;
        if (userAccountId && data.account_id) {
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

            if (role || permissions || data.first_name || data.last_name) {
                const updateFields: any = {};
                if (role) updateFields.role = role;
                if (permissions) updateFields.permissions = JSON.stringify(permissions);
                if (data.first_name || data.last_name) {
                    updateFields.name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
                }

                if (Object.keys(updateFields).length > 0) {
                    const setClause = Object.keys(updateFields).map(k => `\`${k}\` = ?`).join(', ');
                    await corePool.execute(`UPDATE users SET ${setClause} WHERE email = ?`, [...Object.values(updateFields), email]);
                }
            }

            const setClause = Object.keys(data).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(data);
            const whereClause = Object.keys(_identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(_identifiers);
            const sql = `UPDATE users SET ${setClause} WHERE ${whereClause}`;
            await orionPool.execute(sql, [...setValues, ...whereValues] as any[]);

            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
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
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
                username: (session.user as any).email || (session.user as any).name,
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
