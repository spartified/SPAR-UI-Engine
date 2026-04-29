import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { authenticateApiRequest } from "@/core/auth/api-auth";

export async function GET(req: NextRequest) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const aggregatorId = searchParams.get('aggregatorId');

    if (!aggregatorId) {
        return NextResponse.json({ error: "Missing aggregatorId" }, { status: 400 });
    }

    try {
        const pool = await dbManager.getPool('orion', process.env.ORION_DB_URL!);
        const [rows]: any = await pool.execute(
            "SELECT * FROM inventory_batches WHERE aggregator_id = ? AND status = 'PENDING_FETCH'",
            [aggregatorId]
        );

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error("Failed to fetch inventory batches:", error);
        return NextResponse.json({ error: error.message || "Fetch Failed" }, { status: 500 });
    }
}
