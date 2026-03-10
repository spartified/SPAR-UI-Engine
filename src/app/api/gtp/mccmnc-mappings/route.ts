import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import schemaRaw from "@/schemas/gtp-mccmnc-mapping.json";
const schema = schemaRaw as any;

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('gtp:mapping:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];

        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);
            let query = `SELECT * FROM ${schema.tableName}`;
            const filter = schema.metadataConfig?.listFilter;
            if (filter) {
                query += ` WHERE ${filter}`;
            }
            const [rows] = await pool.execute(query);
            return NextResponse.json(rows);
        }
    } catch (error) {
        console.error("Database Connection Failed (Mappings GET):", error);
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Database Connection Failed" }, { status: 500 });
        }
    }

    return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('gtp:mapping:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];

        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Metadata Injection
            const meta = schema.metadataConfig;
            let finalData = { ...data };
            if (meta?.updatedByField) finalData[meta.updatedByField] = (session.user as any).email || (session.user as any).name;
            if (meta?.updatedAtField) finalData[meta.updatedAtField] = new Date();
            if (meta?.lastActionField) finalData[meta.lastActionField] = 'I';

            const keys = Object.keys(finalData);
            const values = Object.values(finalData);
            const placeholders = keys.map(() => '?').join(', ');
            const sql = `INSERT INTO ${schema.tableName} (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;

            await pool.execute(sql, values as any[]);

            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
                screen: schema.title,
                action: 'Data Insert',
                status: 'Success',
                details: `Inserted record into ${schema.tableName}. Data: ${JSON.stringify(finalData)}`
            });
            return NextResponse.json(finalData, { status: 201 });
        }
    } catch (error: any) {
        console.error("Database Save Failed (Mappings POST):", error);
        return NextResponse.json({ error: error.message || "Database Save Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB URL Not Configured" }, { status: 500 });
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('gtp:mapping:manage')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { _identifiers, ...data } = await req.json();

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];

        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Metadata Injection
            const meta = schema.metadataConfig;
            let finalData = { ...data };
            if (meta?.updatedByField) finalData[meta.updatedByField] = (session.user as any).email || (session.user as any).name;
            if (meta?.updatedAtField) finalData[meta.updatedAtField] = new Date();
            if (meta?.lastActionField) finalData[meta.lastActionField] = 'U';

            const setClause = Object.keys(finalData).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(finalData);
            const whereClause = Object.keys(_identifiers).map(key => `\`${key}\` = ?`).join(' AND ');
            const whereValues = Object.values(_identifiers);

            const sql = `UPDATE ${schema.tableName} SET ${setClause} WHERE ${whereClause}`;
            await pool.execute(sql, [...setValues, ...whereValues] as any[]);
            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
                screen: schema.title,
                action: 'Data Update',
                status: 'Success',
                details: `Updated record. SQL: ${sql} | Values: ${JSON.stringify([...setValues, ...whereValues])}`
            });
            return NextResponse.json({ success: true, data });
        }
    } catch (error: any) {
        console.error("Database Update Failed (PUT):", error);
        return NextResponse.json({ error: error.message || "Database Update Failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).permissions.includes('gtp:mapping:manage')) {
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

            const meta = schema.metadataConfig;
            let sql = '';
            let execValues = [...whereValues];

            if (meta?.deleteType === 'soft' && meta?.lastActionField) {
                let setParts = [`\`${meta.lastActionField}\` = 'D'`];
                let setValues = [];
                if (meta.updatedByField) {
                    setParts.push(`\`${meta.updatedByField}\` = ?`);
                    setValues.push((session.user as any).email || (session.user as any).name);
                }
                if (meta.updatedAtField) {
                    setParts.push(`\`${meta.updatedAtField}\` = ?`);
                    setValues.push(new Date());
                }
                sql = `UPDATE ${schema.tableName} SET ${setParts.join(', ')} WHERE ${whereClause}`;
                execValues = [...setValues, ...whereValues];
            } else {
                sql = `DELETE FROM ${schema.tableName} WHERE ${whereClause}`;
            }

            await pool.execute(sql, execValues as any[]);
            await AuditLogger.log({
                username: (session.user as any).email || (session.user as any).name,
                screen: schema.title,
                action: 'Data Delete',
                status: 'Success',
                details: `Deleted record. WHERE ${whereClause} | Values: ${JSON.stringify(whereValues)}`
            });
            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error("Database Delete Failed (DELETE):", error);
        return NextResponse.json({ error: error.message || "Database Delete Failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
