import NextAuth, { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import CredentialsProvider from "next-auth/providers/credentials";
import { DEV_USERS } from "@/core/auth/dev-users";
import { AuditLogger } from "@/core/utils/audit-logger";
import { MODULE_REGISTRY } from "@/config/modules";
import { dbManager } from "@/core/db/manager";

export const authOptions: NextAuthOptions = {
    providers: [
        // 1. Keycloak Provider (Production/Staging)
        KeycloakProvider({
            clientId: process.env.KEYCLOAK_ID || "nextjs-app",
            clientSecret: process.env.KEYCLOAK_SECRET || "dummy-secret",
            issuer: process.env.KEYCLOAK_ISSUER || "http://localhost:8080/realms/my-realm",
        }),
        // 2. Credentials Provider (Dev/Demo Fallback)
        CredentialsProvider({
            name: "Dev Login",
            credentials: {
                username: { label: "Username", type: "text", placeholder: "admin" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (process.env.AUTH_MODE === 'keycloak') {
                    return null;
                }

                if (!credentials?.username || !credentials?.password) return null;

                const user = DEV_USERS.find(u => u.username === credentials.username && u.password === credentials.password);

                if (user) {
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        image: null,
                        role: user.role,
                        permissions: user.permissions
                    };
                }
                return null;
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, account, profile }) {
            // Initial sign in
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.permissions = (user as any).permissions;
                token.account_id = (user as any).account_id;
            }

            if (account) {
                token.id_token = account.id_token;
            }

            if (account?.provider === "keycloak" && (profile || account.access_token)) {
                try {
                    let realmRoles = (profile as any)?.realm_access?.roles || [];
                    let clientRoles = (profile as any)?.resource_access?.[process.env.KEYCLOAK_ID || 'nextjs-app']?.roles || [];

                    if (realmRoles.length === 0 && clientRoles.length === 0 && account.access_token) {
                        try {
                            const payloadBase64 = account.access_token.split('.')[1];
                            if (payloadBase64) {
                                const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
                                realmRoles = payload.realm_access?.roles || [];
                                clientRoles = payload.resource_access?.[process.env.KEYCLOAK_ID || 'nextjs-app']?.roles || [];
                            }
                        } catch (e) {
                            console.error("Error decoding access token:", e);
                        }
                    }

                    const allRoles = Array.from(new Set([...realmRoles, ...clientRoles]));
                    const isAdmin = allRoles.some(role => role === 'admin' || role === 'ADMIN');
                    token.role = isAdmin ? 'admin' : 'viewer';

                    const platformPermissions: string[] = [];
                    const modulePermissions: string[] = [];
                    const productContexts: any = {};
                    const userEmail = (profile as any)?.email || token.email || user?.email;

                    if (token.role === 'admin') {
                        const allModulePermissions = MODULE_REGISTRY.map((m: any) => m.permission);
                        token.permissions = Array.from(new Set(['node:read', ...allModulePermissions]));
                        token.account_id = (profile as any)?.account_id || (profile as any)?.tenant_id || 1;
                    } else {
                        // 1. Fetch Platform Permissions (CORE)
                        try {
                            const corePool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
                            const [coreRows]: any = await corePool.execute(`SELECT permissions FROM users WHERE email = ? LIMIT 1`, [userEmail]);
                            if (coreRows?.[0]?.permissions) {
                                const perms = typeof coreRows[0].permissions === 'string' ? JSON.parse(coreRows[0].permissions) : coreRows[0].permissions;
                                platformPermissions.push(...perms);
                            }
                        } catch (coreErr) {
                            console.error("[JWT] CORE Permission lookup failed:", coreErr);
                        }

                        // 2. Resolve Product Contexts and Module Permissions (Generic)
                        const pools = Array.from(new Set(MODULE_REGISTRY.map(m => m.dbPool).filter(Boolean)));
                        for (const poolName of pools) {
                            if (poolName === 'CORE') continue;
                            const poolConnString = (process.env as any)[`${poolName}_DB_URL`];

                            if (typeof poolConnString === 'string' && typeof poolName === 'string') {
                                try {
                                    const pPool = await dbManager.getPool(poolName, poolConnString);
                                    const [rows]: any = await pPool.execute(
                                        `SELECT * FROM users WHERE email = ? AND status = 'ACTIVE' LIMIT 1`,
                                        [userEmail]
                                    );

                                    if (rows && rows.length > 0) {
                                        productContexts[poolName] = {
                                            accountId: rows[0].account_id,
                                            roleId: rows[0].role_id,
                                            role: rows[0].role
                                        };
                                        if (poolName === 'ORION' || !token.account_id) {
                                            token.account_id = rows[0].account_id;
                                        }

                                        // Support legacy role_id pattern
                                        if (rows[0].role_id) {
                                            const [rRows]: any = await pPool.execute(`SELECT permissions FROM roles WHERE id = ? LIMIT 1`, [rows[0].role_id]);
                                            if (rRows?.[0]?.permissions) {
                                                const pms = typeof rRows[0].permissions === 'string' ? JSON.parse(rRows[0].permissions) : rRows[0].permissions;
                                                modulePermissions.push(...pms);
                                            }
                                        }

                                        // Support new direct permissions column pattern
                                        if (rows[0].permissions) {
                                            const pms = typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions) : rows[0].permissions;
                                            modulePermissions.push(...pms);
                                        }
                                    }
                                } catch (err) {
                                    console.warn(`[JWT] Context resolution failed for pool ${poolName}:`, err);
                                }
                            }
                        }

                        token.productContexts = productContexts;
                        token.permissions = Array.from(new Set(['node:read', ...platformPermissions, ...modulePermissions]));
                    }
                } catch (err: any) {
                    console.error("JWT Callback Error:", err);
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
                (session.user as any).role = token.role;
                (session.user as any).permissions = token.permissions;
                (session.user as any).account_id = token.account_id;
                (session.user as any).productContexts = (token as any).productContexts || {};
                (session.user as any).id_token = token.id_token;
            }
            return session;
        },
    },
    events: {
        async signIn({ user, account, profile }) {
            await AuditLogger.log({
                username: user.email || (user as any).username || user.name || 'unknown',
                action: 'Login',
                status: 'Success',
                details: `Logged in via ${account?.provider}`
            });

            try {
                const pool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
                const [rows]: any = await pool.execute('SELECT id FROM users WHERE id = ?', [user.id]);

                if (rows.length === 0) {
                    await pool.execute(
                        'INSERT INTO users (id, username, name, email, role) VALUES (?, ?, ?, ?, ?)',
                        [user.id, user.email || (user as any).username || user.id, user.name || null, user.email || null, (user as any).role || 'viewer']
                    );
                }
            } catch (error) {
                console.error("[Provisioning] Failed to sync user to local DB:", error);
            }
        },
        async signOut({ token }) {
            await AuditLogger.log({
                username: token.email || (token as any).username || (token as any).name || 'unknown',
                action: 'Logout',
                status: 'Success'
            });
        },
    },
    pages: {
        signIn: '/',
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
