import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbManager } from "@/core/db/manager";
import crypto from "crypto";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const pool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);
        const isAdmin = (session.user as any).permissions?.includes('api-key:manage');

        let query = 'SELECT id, name, prefix, status, expires_at, created_at, tenant_id, user_id FROM api_keys';
        let params: any[] = [];

        if (!isAdmin) {
            query += ' WHERE user_id = ?';
            params.push((session.user as any).id);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.execute(query, params);
        return NextResponse.json({ data: rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    try {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const prefix = `sk_${rawToken.substring(0, 4)}...`;
        const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

        const tenantId = (session.user as any).tenant_id || (session.user as any).id;
        const userId = (session.user as any).id;

        const pool = await dbManager.getPool('CORE', process.env.CORE_DB_URL!);

        const [userCheck]: any = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (userCheck.length === 0) {
            await pool.execute(
                'INSERT INTO users (id, username, name, email, role) VALUES (?, ?, ?, ?, ?)',
                [userId, (session.user as any).email || (session.user as any).username || userId, (session.user as any).name || null, (session.user as any).email || null, (session.user as any).role || 'viewer']
            );
        }

        const [result]: any = await pool.execute(
            'INSERT INTO api_keys (name, prefix, api_key_hash, tenant_id, user_id) VALUES (?, ?, ?, ?, ?)',
            [name, prefix, hash, tenantId, userId]
        );

        return NextResponse.json({
            success: true,
            apiKey: rawToken,
            id: result.insertId,
            prefix,
            name
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
