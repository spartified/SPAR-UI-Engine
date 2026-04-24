import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/core/db/manager";
import { AuditLogger } from "@/core/utils/audit-logger";
import { authenticateApiRequest } from "@/core/auth/api-auth";
import schemaRaw from "@/schemas/orion-accounts.json";

const schema = schemaRaw as any;

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { accountId } = params;

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Check if user has access to this account (hierarchy check)
            if (auth.accountId !== null && auth.accountId !== undefined) {
                const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
                const hierarchy = await getAccountHierarchy(auth.accountId);
                if (!hierarchy.includes(Number(accountId))) {
                    return NextResponse.json({ error: "Access Denied: Account outside of authorized hierarchy" }, { status: 403 });
                }
            }

            const [rows]: any = await pool.execute(
                `SELECT * FROM ${schema.tableName} WHERE id = ? AND status != 'DELETED'`,
                [accountId]
            );

            if (rows.length === 0) {
                return NextResponse.json({ error: "Account not found" }, { status: 404 });
            }

            return NextResponse.json(rows[0]);
        }
    } catch (error: any) {
        console.error("External API GET account failed:", error);
        return NextResponse.json({ error: error.message || "Fetch Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}

export async function PATCH(req: NextRequest, { params }: { params: { accountId: string } }) {
    const auth = await authenticateApiRequest(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { accountId } = params;
    let data: any;
    try {
        data = await req.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const poolName = schema.dbPool;
        const connectionString = (process.env as any)[`${poolName}_DB_URL`];
        if (connectionString) {
            const pool = await dbManager.getPool(poolName, connectionString);

            // Check if user has access to this account (hierarchy check)
            if (auth.accountId !== null && auth.accountId !== undefined) {
                const { getAccountHierarchy } = await import("@/core/utils/hierarchy");
                const hierarchy = await getAccountHierarchy(auth.accountId);
                if (!hierarchy.includes(Number(accountId))) {
                    return NextResponse.json({ error: "Access Denied: Account outside of authorized hierarchy" }, { status: 403 });
                }
            }

            // Verify account exists
            const [existing]: any = await pool.execute(
                `SELECT id FROM ${schema.tableName} WHERE id = ? AND status != 'DELETED'`,
                [accountId]
            );
            if (existing.length === 0) {
                return NextResponse.json({ error: "Account not found" }, { status: 404 });
            }

            // Filter data to only include editable fields
            const editableFields = schema.fields.filter((f: any) => f.editable).map((f: any) => f.name);
            const filteredData: any = {};
            Object.keys(data).forEach(key => {
                if (editableFields.includes(key)) {
                    filteredData[key] = data[key];
                }
            });

            if (Object.keys(filteredData).length === 0) {
                return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
            }

            const setClause = Object.keys(filteredData).map(key => `\`${key}\` = ?`).join(', ');
            const setValues = Object.values(filteredData);
            const sql = `UPDATE ${schema.tableName} SET ${setClause}, updated_at = NOW() WHERE id = ?`;
            await pool.execute(sql, [...setValues, accountId] as any[]);

            await AuditLogger.log({
                username: auth.userId || 'external-api',
                screen: 'External API',
                action: 'Data Update',
                status: 'Success',
                details: `Updated account ${accountId} via external API. Fields: ${Object.keys(filteredData).join(', ')}`
            });

            return NextResponse.json({ success: true, message: "Account updated successfully" });
        }
    } catch (error: any) {
        console.error("External API PATCH account failed:", error);
        return NextResponse.json({ error: error.message || "Update Failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "DB Not Configured" }, { status: 500 });
}
