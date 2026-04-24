import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { aggregatorService } from "../../services/aggregator-service";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const aggregatorId = req.nextUrl.searchParams.get('aggregatorId');
    if (!aggregatorId) {
        return NextResponse.json({ error: "Missing aggregatorId" }, { status: 400 });
    }

    try {
        // 1. Validate the aggregator exists in local DB to ensure auth exists
        const pool = await dbManager.getPool('orion', process.env.ORION_DB_URL!);
        const [rows]: any = await pool.execute(
            'SELECT * FROM aggregator_api_keys WHERE id = ?',
            [aggregatorId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: "Aggregator not found" }, { status: 404 });
        }

        // 2. Fetch inventories through the shared AggregatorService layer
        const data = await aggregatorService.getInventories(Number(aggregatorId));
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Fetch Inventory Proxy Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch from external API" }, { status: 500 });
    }
}
