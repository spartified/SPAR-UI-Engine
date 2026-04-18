import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import { MODULE_REGISTRY } from "@/config/modules";
import crypto from "crypto";

export interface ApiAuthResult {
    authorized: boolean;
    tenantId?: string;
    userId?: string;
    accountId?: number | null; // Primary account context
    productContexts: Record<string, { accountId: number | null, roleId?: number }>;
    permissions: string[];
    isApiKey: boolean;
    error?: string;
}

/**
 * Platform-Level API Authentication
 * Validates either a Bearer API Key OR a standard NextAuth Server Session.
 */
export async function authenticateApiRequest(req: NextRequest): Promise<ApiAuthResult> {
    try {
        const productContexts: Record<string, any> = {};

        // 0. Check for Gateway-Injected Headers
        const xAccountId = req.headers.get("X-SPAR-Account-ID");
        const xUserId = req.headers.get("X-SPAR-User-ID");
        const xTenantId = req.headers.get("X-SPAR-Tenant-ID");
        const xPermissions = req.headers.get("X-SPAR-Permissions");

        if (xUserId || xAccountId) {
            return {
                authorized: true,
                userId: xUserId || undefined,
                tenantId: xTenantId || undefined,
                accountId: xAccountId ? parseInt(xAccountId) : null,
                productContexts: {}, // Headers usually imply a single context
                permissions: xPermissions ? xPermissions.split(',') : [],
                isApiKey: false
            };
        }

        // 1. Check for API Key (Bearer Token)
        const authHeader = req.headers.get("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            const hash = crypto.createHash("sha256").update(token).digest("hex");

            const corePool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
            const [rows]: any = await corePool.execute(
                'SELECT tenant_id, user_id FROM api_keys WHERE api_key_hash = ? AND status = ? AND (expires_at IS NULL OR expires_at > NOW())',
                [hash, 'active']
            );

            if (rows.length > 0) {
                const userId = rows[0].user_id;
                const tenantId = rows[0].tenant_id;
                const permissions: string[] = [];

                // Resolve cross-product contexts for this API key owner
                const [userRows]: any = await corePool.execute('SELECT email FROM users WHERE id = ?', [userId]);
                const email = userRows[0]?.email;

                if (email) {
                    const pools = Array.from(new Set(MODULE_REGISTRY.map(m => m.dbPool).filter(Boolean)));
                    for (const poolName of pools) {
                        if (poolName === 'CORE') continue;
                        const poolConnString = (process.env as any)[`${poolName}_DB_URL`];
                        if (poolConnString) {
                            try {
                                const pPool = await dbManager.getPool(poolName, poolConnString);
                                const [pRows]: any = await pPool.execute(
                                    `SELECT account_id, role_id FROM users WHERE email = ? AND status = 'ACTIVE' LIMIT 1`,
                                    [email]
                                );
                                if (pRows.length > 0) {
                                    productContexts[poolName] = { accountId: pRows[0].account_id, roleId: pRows[0].role_id };
                                    if (pRows[0].role_id) {
                                        const [rRows]: any = await pPool.execute(`SELECT permissions FROM roles WHERE id = ? LIMIT 1`, [pRows[0].role_id]);
                                        if (rRows?.[0]?.permissions) {
                                            const pms = typeof rRows[0].permissions === 'string' ? JSON.parse(rRows[0].permissions) : rRows[0].permissions;
                                            permissions.push(...pms);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn(`[API Auth] Context resolution failed for ${poolName}:`, e);
                            }
                        }
                    }
                }

                return {
                    authorized: true,
                    userId,
                    tenantId,
                    accountId: productContexts['ORION']?.accountId || null,
                    productContexts,
                    permissions,
                    isApiKey: true
                };
            }
            return { authorized: false, isApiKey: true, error: "Invalid API Key", productContexts: {}, permissions: [] };
        }

        // 2. Fallback to Standard NextAuth Session
        const session = await getServerSession(authOptions);
        if (session) {
            return {
                authorized: true,
                userId: (session.user as any)?.id,
                tenantId: (session.user as any)?.account_id,
                accountId: (session.user as any)?.account_id || null,
                productContexts: (session.user as any)?.productContexts || {},
                permissions: (session.user as any)?.permissions || [],
                isApiKey: false
            };
        }

        return { authorized: false, isApiKey: false, error: "Unauthorized", productContexts: {}, permissions: [] };

    } catch (error: any) {
        console.error("API Auth Error:", error);
        return { authorized: false, isApiKey: false, error: "Internal Error", productContexts: {}, permissions: [] };
    }
}
