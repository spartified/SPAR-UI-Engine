import { NextRequest } from "next/server";

export async function getIsolationContext(req: NextRequest, session: any, pool: any, tableName: string) {
    const tenantId = req.headers.get('x-tenant-id');
    const userRole = session.user.role;
    const userAccountId = session.user.account_id;

    if (!tenantId) {
        throw new Error("Missing x-tenant-id header");
    }

    // 1. Fetch all accounts for this tenant to build hierarchy
    const [accountsRows]: any = await pool.execute(`SELECT id, parent_id FROM accounts WHERE tenant_id = ? AND status != 'DELETED'`, [tenantId]);

    // 2. Find all descendants of userAccountId
    const accessibleAccountIds = new Set<number>();

    // Root users can see everything in the tenant
    if (userRole === 'admin') {
        const rootAccount = accountsRows.find((a: any) => a.parent_id === null || typeof a.parent_id === 'undefined');
        if (rootAccount) {
            // They can see this root and everything below it
            if (userAccountId == rootAccount.id) {
                accountsRows.forEach((a: any) => accessibleAccountIds.add(a.id));
            }
        } else {
            accountsRows.forEach((a: any) => accessibleAccountIds.add(a.id));
        }
    } else {
        // Recursive function to find descendants
        const findDescendants = (parentId: number) => {
            accountsRows.forEach((acc: any) => {
                if (acc.parent_id === parentId && !accessibleAccountIds.has(acc.id)) {
                    accessibleAccountIds.add(acc.id);
                    findDescendants(acc.id);
                }
            });
        };

        if (userAccountId) {
            accessibleAccountIds.add(userAccountId);
            findDescendants(userAccountId);
        }
    }

    return {
        tenantId,
        userAccountId,
        accessibleAccountIds: Array.from(accessibleAccountIds),
        isRoot: userRole === 'admin'
    };
}
