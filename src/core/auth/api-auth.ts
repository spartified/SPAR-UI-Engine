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
                    // Resolve all unique database pools from both static and dynamic registries
                    const staticPools = MODULE_REGISTRY.map(m => m.dbPool).filter(Boolean);
                    let dynamicPools: string[] = [];
                    try {
                        const [moduleRows]: any = await corePool.execute("SELECT DISTINCT db_pool FROM portal_modules WHERE is_active = 1 AND db_pool IS NOT NULL");
                        dynamicPools = moduleRows.map((r: any) => r.db_pool);
                    } catch (err) {
                        console.warn("[API Auth] Failed to fetch dynamic pools:", err);
                    }

                    const pools = Array.from(new Set([...staticPools, ...dynamicPools]));
                    
                    for (const poolName of pools) {
                        if (poolName === 'CORE') continue;
                        const poolConnString = (process.env as any)[`${poolName}_DB_URL`];
                        if (typeof poolConnString === 'string') {
                            try {
                                const pPool = await dbManager.getPool(poolName as any, poolConnString);
                                
                                // Fetch user record - using SELECT * to stay compatible with different schemas
                                const [queryRows]: any = await pPool.execute(
                                    `SELECT * FROM users WHERE email = ? AND status = 'ACTIVE' LIMIT 1`,
                                    [email]
                                );
                                const pRows = queryRows as any[];
                                
                                if (pRows.length > 0) {
                                    const row = pRows[0];
                                    // @ts-ignore
                                    productContexts[poolName] = { 
                                        accountId: row.account_id || row.accountId || null, 
                                        roleId: row.role_id || row.roleId || null 
                                    };

                                    // Priority 1: Direct JSON permissions (used by Orion)
                                    if (row.permissions) {
                                        try {
                                            const pms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
                                            if (Array.isArray(pms)) permissions.push(...pms);
                                        } catch (pe) { 
                                            console.warn(`[API Auth] Failed to parse permissions for ${poolName}`, pe); 
                                        }
                                    }

                                    // Priority 2: Role-based permissions (if role_id exists)
                                    const roleId = row.role_id || row.roleId;
                                    if (roleId) {
                                        try {
                                            const [rRows]: any = await pPool.execute(`SELECT permissions FROM roles WHERE id = ? LIMIT 1`, [roleId]);
                                            if (rRows?.[0]?.permissions) {
                                                const pms = typeof rRows[0].permissions === 'string' ? JSON.parse(rRows[0].permissions) : rRows[0].permissions;
                                                if (Array.isArray(pms)) permissions.push(...pms);
                                            }
                                        } catch (roleErr) { 
                                            // Roles table might not exist in this product
                                        }
                                    }
                                }
                            } catch (e: any) {
                                console.warn(`[API Auth] Context resolution failed for ${poolName}:`, e.message);
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
