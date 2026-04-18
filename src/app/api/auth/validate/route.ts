import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/core/auth/api-auth";

/**
 * Identity Resolution API
 * Primarily used by the Kong Gateway to validate tokens and enrich headers.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);

    if (!auth.authorized) {
        return NextResponse.json({
            authorized: false,
            error: auth.error || "Authentication failed"
        }, { status: 401 });
    }

    // Return the enriched context for Gateway-level header injection
    return NextResponse.json({
        authorized: true,
        userId: auth.userId,
        tenantId: auth.tenantId,
        accountId: auth.accountId,
        permissions: auth.permissions,
        isApiKey: auth.isApiKey
    });
}

// Support POST as well if some clients prefer it
export async function POST(req: NextRequest) {
    return GET(req);
}
