import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";

export async function GET(req: NextRequest) {
    try {
        const corePool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);

        // Fetch Categories
        const [categories]: any = await corePool.execute('SELECT id, title, icon_name FROM portal_categories');

        // Fetch Active Modules
        const [modules]: any = await corePool.execute(
            'SELECT id, title, path, category_id as `category`, permission, schema_url as `schema`, db_pool as `dbPool`, external_url FROM portal_modules WHERE is_active = 1'
        );

        return NextResponse.json({
            categories,
            modules
        });
    } catch (error: any) {
        console.error("Failed to fetch dynamic modules:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
