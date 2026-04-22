import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { aggregatorService } from "../../../services/aggregator-service";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const iccid = req.nextUrl.searchParams.get('inventoryId');
    const aggregatorAccountId = req.nextUrl.searchParams.get('aggregatorId');

    if (!iccid || !aggregatorAccountId) {
        return NextResponse.json({ error: "Missing inventoryId or aggregatorId" }, { status: 400 });
    }

    try {
        const sims = await aggregatorService.getInventorySims(aggregatorAccountId, iccid);
        return NextResponse.json(sims);
    } catch (error: any) {
        console.error("Failed to fetch inventory SIMs:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch SIMs" }, { status: 500 });
    }
}
