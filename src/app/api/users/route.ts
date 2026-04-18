import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import { KeycloakAdmin } from "@/core/utils/keycloak-admin";
import { AuditLogger } from "@/core/utils/audit-logger";

// Development fallback remains if DB is totally unconfigured
import { DEV_USERS } from "@/core/auth/dev-users";
let mockUsers = [...DEV_USERS];

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !(session.user as any).permissions.includes('user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const corePool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
        const [rows]: any = await corePool.execute('SELECT id, username, name, email, role, tenants, permissions, created_at FROM users ORDER BY created_at DESC');

        const parsedRows = rows.map((row: any) => ({
            ...row,
            tenants: row.tenants ? (typeof row.tenants === 'string' ? JSON.parse(row.tenants) : row.tenants) : [],
            permissions: row.permissions ? (typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions) : []
        }));

        return NextResponse.json(parsedRows);
    } catch (error) {
        console.warn("DB Users lookup failed, falling back to mock:", error);
    }

    return NextResponse.json(mockUsers);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !(session.user as any).permissions.includes('user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const userData = await req.json();
    if (!userData.email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    try {
        // 1. Create in Keycloak
        console.log(`[Platform User] Creating Keycloak identity for ${userData.email}`);
        const firstName = userData.name?.split(' ')[0] || userData.username || 'User';
        const lastName = userData.name?.split(' ').slice(1).join(' ') || '';

        let keycloakId = await KeycloakAdmin.createUser(userData.email, firstName, lastName);

        if (!keycloakId) throw new Error("Failed to get Keycloak ID");

        // 2. Sync to Platform DB (CORE)
        const corePool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
        await corePool.execute(
            "INSERT INTO users (id, username, name, email, role, tenants, permissions) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP, tenants = VALUES(tenants), permissions = VALUES(permissions)",
            [keycloakId, userData.email, userData.name || userData.username, userData.email, userData.role || 'viewer', JSON.stringify(userData.tenants || []), JSON.stringify(userData.permissions || [])]
        );

        // 3. Automatically map to Orion (if configured)
        const orionUrl = process.env.ORION_DB_URL;
        if (orionUrl) {
            try {
                const orionPool = await dbManager.getPool('ORION', orionUrl);

                // Find a default account (First active one)
                const [accounts]: any = await orionPool.execute("SELECT id FROM accounts WHERE status = 'ACTIVE' LIMIT 1");
                const defaultAccountId = accounts.length > 0 ? accounts[0].id : 1;

                console.log(`[Platform User] Auto-mapping ${userData.email} to Orion Account ${defaultAccountId}`);
                await orionPool.execute(
                    "INSERT INTO users (first_name, last_name, email, account_id, role_id, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP",
                    [firstName, lastName, userData.email, defaultAccountId, 10, 'ACTIVE']
                );
            } catch (orionErr) {
                console.error("[Platform User] Orion mapping failed (non-critical):", orionErr);
            }
        }

        await AuditLogger.log({
            username: (session.user as any).email || (session.user as any).name,
            screen: 'Platform Users',
            action: 'User Creation',
            status: 'Success',
            details: `Created platform user ${userData.email} with auto-Orion sync`
        });

        return NextResponse.json({ ...userData, id: keycloakId }, { status: 201 });
    } catch (error: any) {
        console.error("Platform User Creation Failed:", error);
        return NextResponse.json({ error: error.message || "Execution Failed" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const corePool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);

        // Handle ID extraction from top-level or nested _identifiers
        const id = body.id || body._identifiers?.id || body.username || body._identifiers?.username;
        const data = body;

        if (!id) throw new Error("Missing user identifier (id or username)");

        // Whitelist allowed columns to prevent SQL errors from frontend metadata (like _identifiers)
        const allowedColumns = ['username', 'name', 'email', 'role', 'tenants', 'permissions'];
        const updateData: any = {};

        allowedColumns.forEach(col => {
            if (data[col] !== undefined) {
                updateData[col] = data[col];
            }
        });

        if (updateData.permissions) {
            updateData.permissions = JSON.stringify(updateData.permissions);
        }
        if (updateData.tenants) {
            updateData.tenants = JSON.stringify(updateData.tenants);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true, message: "No fields to update" });
        }

        const setClause = Object.keys(updateData).map(key => `\`${key}\` = ?`).join(', ');
        const setValues = Object.values(updateData);
        const sql = `UPDATE users SET ${setClause} WHERE id = ?`;

        await corePool.execute(sql, [...setValues, id] as any[]);

        await AuditLogger.log({
            username: (session.user as any).email || (session.user as any).name,
            screen: 'Platform Users',
            action: 'User Update',
            status: 'Success',
            details: `Updated platform user ${id}`
        });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Platform User Update Failed:", error);
        return NextResponse.json({ error: error.message || "Update Failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('user:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const id = body.id || body._identifiers?.id;
        const email = body.email || body._identifiers?.email || body._identifiers?.username || body.username;

        if (!email && !id) {
            return NextResponse.json({ error: "Identifier (email or id) required" }, { status: 400 });
        }

        // 1. Delete from Keycloak
        if (email) {
            console.log(`[Platform User] Deleting Keycloak identity: ${email}`);
            try {
                await KeycloakAdmin.deleteUser(email);
            } catch (kcErr) {
                console.error("[Platform User] Keycloak delete failed:", kcErr);
            }
        }

        // 2. Delete from CORE DB
        const corePool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
        if (id) {
            await corePool.execute("DELETE FROM users WHERE id = ?", [id]);
        } else {
            await corePool.execute("DELETE FROM users WHERE email = ?", [email]);
        }

        await AuditLogger.log({
            username: (session.user as any).email || (session.user as any).name,
            screen: 'Platform Users',
            action: 'User Deletion',
            status: 'Success',
            details: `Deleted platform user ${email || id}`
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Platform User Deletion Failed:", error);
        return NextResponse.json({ error: error.message || "Deletion Failed" }, { status: 500 });
    }
}
