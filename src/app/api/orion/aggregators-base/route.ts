import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import { aggregatorService } from "@/core/services/aggregator-service";
import { AuditLogger } from "@/core/utils/audit-logger";
import schemaRaw from "@/schemas/orion-aggregators-base.json";

const schema = schemaRaw as any;

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const hasPerm = (session?.user as any)?.permissions?.some((p: string) =>
        ['orion:aggregator:manage', 'orion:package:manage'].includes(p)
    );

    if (!session || !hasPerm) {
        console.warn(`[AggregatorsBase] Unauthorized access attempt: ${session?.user?.email}`);
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];

        if (action === 'countries') {
            try {
                const aggregatorId = searchParams.get('aggregator_id');
                const pool = await dbManager.getPool('ORION', process.env.ORION_DB_URL as string);

                let idToUse = aggregatorId;
                if (!idToUse) {
                    const [rows]: any = await pool.execute('SELECT id FROM aggregator_api_keys LIMIT 1');
                    if (rows.length > 0) idToUse = rows[0].id;
                }

                if (idToUse) {
                    console.log(`[AggregatorsBase] Fetching countries for aggregator ${idToUse}`);
                    const countries = await aggregatorService.getCountries(Number(idToUse));
                    const count = countries?.countries?.length || (Array.isArray(countries) ? countries.length : 0);
                    console.log(`[AggregatorsBase] Found ${count} countries`);
                    return NextResponse.json(countries);
                }
                console.warn(`[AggregatorsBase] No aggregator found for country fetch`);
                return NextResponse.json({ countries: [] });
            } catch (err: any) {
                console.error(`[AggregatorsBase] Country fetch error:`, err);
                return NextResponse.json({
                    error: "Failed to fetch countries from aggregator: " + err.message,
                    countries: []
                }, { status: 500 });
            }
        }

        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const [rows] = await pool.execute(`SELECT * FROM ${schema.tableName}`);
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (GET aggregators-base):", error);
        return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
    }
    return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:aggregator:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const data = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const keys = Object.keys(data);
            const values = Object.values(data);
            const placeholders = keys.map(() => '?').join(', ');
            const sql = `INSERT INTO ${schema.tableName} (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
            await pool.execute(sql, values as any[]);

            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
                screen: schema.title,
                action: 'Create Aggregator',
                status: 'Success',
                details: `Created aggregator ${data.name}`
            });

            return NextResponse.json({ success: true }, { status: 201 });
        }
    } catch (error: any) {
        console.error("Database Save Failed:", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:aggregator:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { _identifiers, ...data } = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const setClause = Object.keys(data).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(data);
            const whereClause = Object.keys(_identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(_identifiers);
            const sql = `UPDATE ${schema.tableName} SET ${setClause} WHERE ${whereClause}`;
            await pool.execute(sql, [...setValues, ...whereValues] as any[]);

            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
                screen: schema.title,
                action: 'Update Aggregator',
                status: 'Success',
                details: `Updated aggregator ID ${_identifiers.id}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Update Failed:", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('orion:aggregator:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const identifiers = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            const whereClause = Object.keys(identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(identifiers);
            const sql = `DELETE FROM ${schema.tableName} WHERE ${whereClause}`;
            await pool.execute(sql, whereValues as any[]);

            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
                screen: schema.title,
                action: 'Delete Aggregator',
                status: 'Success',
                details: `Deleted aggregator. WHERE ${whereClause}`
            });

            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Delete Failed:", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
