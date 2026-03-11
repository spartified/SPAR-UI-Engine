import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";

// --- Mock Data for Local Development ---

const getMockData = (query: string) => {
    const q = query.toLowerCase();

    // 1. Network Master (Filters)
    if (q.includes("network_master")) {
        return [
            { value: 1, label: "Dummy Network 1" },
            { value: 2, label: "Dummy Network 2" },
            { value: 3, label: "Dummy Network 3" },
        ];
    }

    // 2. GTP Session Stats - Success/Fail Trends (Time)
    if (q.includes("gtp_session_stats") && q.includes("sum(sess_count)")) {
        const data = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            const x_axis = date.toISOString().split('T')[0];
            data.push({
                x_axis,
                total_sessions: 1000 + Math.floor(Math.random() * 500),
                success_count: 800 + Math.floor(Math.random() * 200),
                fail_count: 100 + Math.floor(Math.random() * 100),
                rejected_count: 50 + Math.floor(Math.random() * 50)
            });
        }
        return data;
    }

    // 3. GTP Session Stats - Failures Breakdown (Bars/Categories)
    if (q.includes("gtp_session_stats") && q.includes("group by")) {
        const categories = q.includes("network_name") ? ["VPMN 1", "VPMN 2", "VPMN 3"] :
            q.includes("pgw_ip") ? ["192.168.1.1", "192.168.1.2", "192.168.1.3"] :
                q.includes("apn") ? ["internet", "ims", "mms"] : ["Category A", "Category B"];

        return categories.map(cat => ({
            x_axis: cat,
            total_sessions: 500 + Math.floor(Math.random() * 300),
            success_count: 400 + Math.floor(Math.random() * 100),
            fail_count: 80 + Math.floor(Math.random() * 40),
            total_failures: 80 + Math.floor(Math.random() * 40),
            rejected_count: 20 + Math.floor(Math.random() * 20)
        }));
    }

    return [];
};

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { dbPool, query } = await req.json();

        if (!dbPool || !query) {
            return NextResponse.json({ error: "Missing dbPool or query" }, { status: 400 });
        }

        const connectionString = (process.env as any)[`${dbPool}_DB_URL`];

        // If no connection string is provided, or if MOCK_DATA env is set, return mock data
        if (!connectionString || process.env.NEXT_PUBLIC_MOCK_DATA === 'true') {
            console.warn(`[MOCK MODE] Returning mock data for query on pool: ${dbPool}`);
            return NextResponse.json(getMockData(query));
        }

        const pool = await dbManager.getPool(dbPool, connectionString);
        const [rows] = await pool.execute(query);
        return NextResponse.json(rows);

    } catch (error: any) {
        console.error("Lookup Failed:", error);
        // Fallback to mock data even on error in dev environments
        if (process.env.NODE_ENV === 'development') {
            const { query } = await req.clone().json();
            return NextResponse.json(getMockData(query));
        }
        return NextResponse.json({ error: error.message || "Lookup Failed" }, { status: 500 });
    }
}
