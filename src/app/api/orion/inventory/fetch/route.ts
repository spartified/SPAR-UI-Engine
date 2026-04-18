import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const aggregatorId = req.nextUrl.searchParams.get('aggregatorId');
    if (!aggregatorId) {
        return NextResponse.json({ error: "Missing aggregatorId" }, { status: 400 });
    }

    try {
        // 1. Get Aggregator details from DB
        const pool = await dbManager.getPool('orion', process.env.ORION_DB_URL!);
        const [rows]: any = await pool.execute(
            'SELECT * FROM aggregator_api_keys WHERE id = ?',
            [aggregatorId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: "Aggregator not found" }, { status: 404 });
        }

        const aggregator = rows[0];

        // 2. Determine URL and Token
        // For this implementation, we use the specific Telna details provided by the user
        // In a real production system, the full token would be stored securely (not just masked/hashed)
        let url = aggregator.base_url + "/inventory/inventories";
        let token = "eyJvcmciOiI2Mjg2MWUxZmY4YjU3ZDAwMDEzNmI1NjkiLCJpZCI6ImQ0YjE1MzJiZmJhMTQ0NGZiOGVjOGM2OTNmNDliNmRhIiwiaCI6Im11cm11cjY0In0=";

        // If it's NOT the telna one, we might need different logic, but for now we follow the user request
        if (!aggregator.base_url.includes('telna.com')) {
            // Fallback or generic logic
            return NextResponse.json({ error: "External API not configured for this aggregator yet" }, { status: 501 });
        }

        // 3. Perform the request
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`External API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Fetch Inventory Proxy Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch from external API" }, { status: 500 });
    }
}
