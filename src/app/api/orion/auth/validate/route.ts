import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import { dbManager } from "@/core/db/manager";

/**
 * Token Validation Endpoint for Northbound Services
 * Allows external services to validate a Bearer token and retrieve account context.
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);

    if (!auth.authorized) {
        return NextResponse.json({ 
            valid: false, 
            error: auth.error || "Unauthorized" 
        }, { status: 401 });
    }

    // Return the resolved identity and Orion account context
    // Fetch readable names for userId and accountId
    let userEmail = null;
    let accountName = null;

    try {
        const corePool: any = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
        const [uRows]: any = await corePool.execute("SELECT email FROM users WHERE id = ? LIMIT 1", [auth.userId]);
        userEmail = uRows[0]?.email;

        if (auth.accountId) {
            const orionPool: any = await dbManager.getPool('ORION', process.env.ORION_DB_URL!);
            const [aRows]: any = await orionPool.execute("SELECT name FROM accounts WHERE id = ? LIMIT 1", [auth.accountId]);
            accountName = aRows[0]?.name;
        }
    } catch (e) {
        console.warn("[Auth Validate] Enrichment failed:", e);
    }

    return NextResponse.json({
        valid: true,
        userId: auth.userId,
        userEmail,
        accountId: auth.accountId,
        accountName,
        tenantId: auth.tenantId,
        permissions: auth.permissions,
        productContexts: auth.productContexts
    });
}
