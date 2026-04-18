import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { telnaService } from "@/core/services/telna-service";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    try {
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL);
        let query = `
            SELECT pt.*, a.name as account_name 
            FROM package_templates pt
            LEFT JOIN accounts a ON pt.account_id = a.id
        `;

        if (auth.accountId !== null && auth.accountId !== undefined) {
            const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
            const hierarchy = await getAccountHierarchy(auth.accountId);
            if (hierarchy.length > 0) {
                query += ` WHERE pt.account_id IN (${hierarchy.join(',')})`;
            }
        }

        query += ` ORDER BY pt.created_at DESC`;

        const [rows]: any = await pool.execute(query);
        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }
    try {
        const data = await req.json();
        console.log("[Packages API] POST payload:", JSON.stringify(data, null, 2));

        // 1. Call Telna API via Service FIRST
        let remoteId: string | number;
        try {
            const telnaResult = await telnaService.createPackageTemplate(data.aggregator_account_id, {
                name: data.name,
                traffic_policy: data.traffic_policy || 1053,
                supported_countries: data.supported_countries || [],
                voice_usage_allowance: data.voice_limit || 0,
                data_usage_allowance: data.data_limit_mb * 1048576,
                sms_usage_allowance: data.sms_limit || 0,
                activation_time_allowance: data.duration_seconds,
                activation_type: "AUTO",
                earliest_available_date: data.earliest_available_date,
                latest_available_date: data.latest_available_date,
                time_allowance: {
                    duration: data.duration_seconds,
                    unit: "SECOND"
                },
                inventory: 1 // Service will auto-resolve this
            });

            remoteId = telnaResult.id || telnaResult.template_id;
        } catch (telnaError: any) {
            console.error("Telna Sync Failed (Before DB):", telnaError);
            return NextResponse.json({
                success: false,
                error: "Remote synchronization failed: " + telnaError.message
            }, { status: 400 });
        }

        // 2. ONLY IF SUCCESSFUL: Create local record
        const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL);
        const params = [
            data.name || null,
            data.account_id || data.aggregator_account_id || null, // Fallback if necessary
            data.aggregator_account_id || null,
            data.data_limit_mb || 0,
            data.duration_seconds || 0,
            data.sms_limit || 0,
            data.voice_limit || 0,
            data.traffic_policy || 0,
            'IN_SYNC',
            remoteId,
            data.earliest_available_date || null,
            data.latest_available_date || null
        ];

        const [result]: any = await pool.execute(
            `INSERT INTO package_templates (
                name, account_id, aggregator_account_id, data_limit_mb, 
                duration_seconds, sms_limit, voice_limit, traffic_policy, sync_status,
                remote_id, earliest_available_date, latest_available_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params
        );

        const localId = result.insertId;
        return NextResponse.json({ success: true, id: localId, remote_id: remoteId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
