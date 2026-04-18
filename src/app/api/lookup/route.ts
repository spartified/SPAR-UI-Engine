import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import { MODULE_REGISTRY } from "@/config/modules";

// --- Mock Data for Local Development ---

const getMockData = (query: string) => {
    const q = query.toLowerCase();

    // 1. Network Master (Filters - Lookups only)
    if (q.includes("network_master") && !q.includes("gtp_session_stats")) {
        return [
            { value: 1, label: "Dummy Network 1" },
            { value: 2, label: "Dummy Network 2" },
            { value: 3, label: "Dummy Network 3" },
        ];
    }

    // 2. GTP Session Stats - Dimension-based Stats
    if (q.includes("gtp_session_stats") && q.includes("group by") && !q.includes("group by x_axis")) {
        const categories = q.includes("network_name") ? ["VPMN 1", "VPMN 2", "VPMN 3"] :
            q.includes("pgw_ip") ? ["192.168.1.1", "192.168.1.2", "192.168.1.3"] :
                q.includes("apn") ? ["internet", "ims", "mms"] : ["Category A", "Category B"];
        const isFailureReport = q.includes("error_1");

        return categories.map(cat => (isFailureReport ? {
            x_axis: cat,
            error_1: 50 + Math.floor(Math.random() * 50),
            error_2: 30 + Math.floor(Math.random() * 30),
            error_3: 10 + Math.floor(Math.random() * 20)
        } : {
            x_axis: cat,
            total_sessions: 500 + Math.floor(Math.random() * 300),
            success_count: 400 + Math.floor(Math.random() * 100),
            fail_count: 80 + Math.floor(Math.random() * 40),
            rejected_count: 20 + Math.floor(Math.random() * 20)
        }));
    }

    // 3. Trends
    if (q.includes("gtp_session_stats") && (q.includes("date_format") || q.includes("datediff") || q.includes("x_axis"))) {
        const data = [];
        const isFailureReport = q.includes("error_1");
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            const x_axis = date.toISOString().split('T')[0];
            if (isFailureReport) {
                data.push({ x_axis, error_1: 20 + Math.floor(Math.random() * 30), error_2: 10 + Math.floor(Math.random() * 20), error_3: 5 + Math.floor(Math.random() * 10) });
            } else {
                data.push({ x_axis, total_sessions: 1000 + Math.floor(Math.random() * 500), success_count: 800 + Math.floor(Math.random() * 200), fail_count: 100 + Math.floor(Math.random() * 100), rejected_count: 50 + Math.floor(Math.random() * 50) });
            }
        }
        return data;
    }

    // 4. Accounts lookup
    if (q.includes("accounts") && q.includes("label")) {
        return [
            { value: 1, label: "Spartified Global" },
            { value: 2, label: "Acme Enterprise" },
            { value: 3, label: "Acme Reseller A" },
            { value: 4, label: "TravelSIM Corp" },
            { value: 5, label: "Customer Alpha" },
        ];
    }

    return [];
};

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { dbPool, query } = body;

        if (dbPool === 'ERROR_LOG') {
            console.error('CLIENT CRASH TRACE:', decodeURIComponent(query));
            return NextResponse.json({ success: true });
        }

        if (!dbPool || !query) {
            return NextResponse.json({ error: "Missing dbPool or query" }, { status: 400 });
        }

        // 1. Permission Discovery (Contextual)
        if (dbPool === 'SYSTEM' && query === 'available_permissions') {
            const userPermissions = (session?.user as any)?.permissions || [];
            const availablePermissions = MODULE_REGISTRY
                .filter(m => {
                    if (!userPermissions.includes(m.permission)) return false;
                    if (!m.dbPool || m.dbPool === 'CORE') return true;
                    return !!(process.env as any)[`${m.dbPool}_DB_URL`];
                })
                .map(m => {
                    let prefix = 'Platform: ';
                    if (m.permission === 'grafana') prefix = 'Grafana: ';
                    else if (m.dbPool) prefix = `${m.dbPool}: `;

                    return { label: `${prefix}${m.title}`, value: m.permission };
                });
            const uniquePermissions = Array.from(new Map(availablePermissions.map(p => [p.value, p])).values());
            return NextResponse.json(uniquePermissions);
        }

        const connectionString = (process.env as any)[`${dbPool}_DB_URL`];

        // 2. Mock Data Fallback
        if (!connectionString || process.env.NEXT_PUBLIC_MOCK_DATA === 'true') {
            return NextResponse.json(getMockData(query));
        }

        const pool = await dbManager.getPool(dbPool, connectionString);
        let finalQuery = query;

        // 3. Generic Data Isolation (Product Agnostic)
        const productContext = (session?.user as any)?.productContexts?.[dbPool];
        const userAccountId = productContext?.accountId;

        if (userAccountId) {
            const { getHierarchy } = await import("@/core/utils/hierarchy");
            const hierarchy = await getHierarchy(dbPool, userAccountId);
            const hierarchyList = hierarchy.join(',');

            if (hierarchyList) {
                // Determine filter column (standard convention: 'id' for root table, 'account_id' for others)
                const isRootTable = query.toLowerCase().includes('from accounts') || query.toLowerCase().includes('from organizations');
                const filterCol = isRootTable ? 'id' : 'account_id';

                if (query.toLowerCase().includes('where')) {
                    finalQuery = query.replace(/where/i, `WHERE ${filterCol} IN (${hierarchyList}) AND `);
                } else if (query.toLowerCase().includes('group by')) {
                    finalQuery = query.replace(/group by/i, `WHERE ${filterCol} IN (${hierarchyList}) GROUP BY `);
                } else if (query.toLowerCase().includes('order by')) {
                    finalQuery = query.replace(/order by/i, `WHERE ${filterCol} IN (${hierarchyList}) ORDER BY `);
                } else if (query.toLowerCase().includes('limit')) {
                    finalQuery = query.replace(/limit/i, `WHERE ${filterCol} IN (${hierarchyList}) LIMIT `);
                } else {
                    finalQuery = `${query} WHERE ${filterCol} IN (${hierarchyList})`;
                }
                console.log(`[Isolation System] Pool: ${dbPool}, Col: ${filterCol}, Hierarchy: ${hierarchy.length} nodes`);
            }
        }

        const [rows] = await pool.execute(finalQuery);
        return NextResponse.json(rows);

    } catch (error: any) {
        console.error("Lookup Failed:", error);
        return NextResponse.json({ error: error.message || "Lookup Failed" }, { status: 500 });
    }
}
