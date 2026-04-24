import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { aggregatorService } from "../services/aggregator-service";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const iccid = req.nextUrl.searchParams.get('iccid');
    if (!iccid) {
        return NextResponse.json({ error: "Missing iccid" }, { status: 400 });
    }

    try {
        const pool = await dbManager.getPool('orion', process.env.ORION_DB_URL!);

        // Find aggregator ID from the batch mapping
        const [rows]: any = await pool.execute(`
            SELECT a.id, e.status, e.mapped_imsi, ib.inventory_id, a.name as aggregator_name
            FROM esims e
            LEFT JOIN inventory_batches ib ON e.batch_id = ib.id
            LEFT JOIN aggregator_api_keys a ON a.name = ib.aggregator
            WHERE e.iccid = ?
        `, [iccid]);

        const dbEsim = rows.length > 0 ? rows[0] : {};
        const aggregatorAccountId = dbEsim.id || 1;

        // Fetch euicc profile from remote aggregator
        let remoteProfile: any = {};
        try {
            remoteProfile = await aggregatorService.getEuiccProfile(aggregatorAccountId, iccid);
        } catch (err: any) {
            console.error("EUICC Fetch error (ignoring for UI render):", err.message);
        }

        // Construct response to replace mock
        return NextResponse.json({
            iccid: iccid,
            dateCreated: new Date().toISOString(),
            company: 'Spartified',
            inventory: dbEsim.inventory_id || 'Unknown',
            whitelist: 'N/A',
            simType: 'eSIM',
            simStatus: dbEsim.status || 'AVAILABLE',
            mappedImsi: dbEsim.mapped_imsi || 'N/A',
            euicc: {
                state: remoteProfile.state || 'AVAILABLE',
                lastOperationDate: remoteProfile.action_date || 'N/A',
                activationCode: remoteProfile.activation_code || 'N/A',
                reuseRemaining: remoteProfile.install_remaining || 0,
                reuseEnabled: remoteProfile.reuse_enabled ? 'Yes' : 'No',
                profileReusePolicy: remoteProfile.profile_policy || 'N/A',
                releaseDate: remoteProfile.release_date || 'N/A',
                confirmationCodeReq: remoteProfile.confirmation_code_required ? 'Yes' : 'No',
                confirmationCodeRetries: remoteProfile.confirmation_code_retries || 'N/A',
                eid: remoteProfile.eid || 'N/A'
            },
            services: {
                data: 'Enabled',
                sms: 'Enabled',
                voice: 'Enabled'
            },
            msisdns: [],
            apns: ['globaldata']
        });
    } catch (error: any) {
        console.error("Failed to fetch detail:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch details" }, { status: 500 });
    }
}
