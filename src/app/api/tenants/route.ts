import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    console.log("Tenant API - Session:", session ? "Exists" : "Null");
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const poolName = "CORE";
        const connectionString = process.env.CORE_DB_URL;
        console.log("Tenant API - CORE_DB_URL:", connectionString);
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Fetch all tenants. In a real scenario, this would filter by user_tenants table based on session.user.id.
            const [rows] = await pool.execute(`SELECT id, name, description FROM tenants`);
            console.log("Tenant API - Rows fetched:", (rows as any[]).length);
            return NextResponse.json(rows);
        } else {
            console.log("Tenant API - CORE_DB_URL is MISSING!");
        }
    } catch (error) {
        console.error("Database Connection Failed (GET tenants):", error);
        return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
    }
    return NextResponse.json([]);
}
