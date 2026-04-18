import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const keyId = params.id;
    const isAdmin = (session.user as any).permissions?.includes('api-key:manage');

    try {
        const pool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);

        let sql = 'UPDATE api_keys SET status = "revoked" WHERE id = ?';
        let queryParams: any[] = [keyId];

        if (!isAdmin) {
            sql += ' AND user_id = ?';
            queryParams.push((session.user as any).id);
        }

        const [result]: any = await pool.execute(sql, queryParams);

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: "Key not found or not authorized" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
