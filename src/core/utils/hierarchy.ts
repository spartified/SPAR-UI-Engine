import { dbManager } from "@/core/db/manager";

/**
 * Resolves all descendant IDs for a given root ID in a hierarchical table.
 * This is a generic utility for any hierarchical structure (e.g. accounts, organizations).
 * 
 * @param dbPool - The database pool to query (e.g., 'ORION', 'CORE')
 * @param rootId - The starting ID of the hierarchy
 * @param options - Configuration for the hierarchy table (tableName, parentCol, idCol)
 */
export async function getHierarchy(
    dbPool: string,
    rootId: number | string | null,
    options: { table?: string, parentCol?: string, idCol?: string } = {}
): Promise<any[]> {
    if (rootId === null || rootId === undefined) return [];

    const { table = 'accounts', parentCol = 'parent_id', idCol = 'id' } = options;
    const connectionString = (process.env as any)[`${dbPool}_DB_URL`];
    if (!connectionString) return [rootId];

    try {
        const pool = await dbManager.getPool(dbPool, connectionString);

        // Recursive CTE to get the full subtree
        const query = `
            WITH RECURSIVE hierarchy AS (
                SELECT \`${idCol}\` FROM \`${table}\` WHERE \`${idCol}\` = ?
                UNION ALL
                SELECT t.\`${idCol}\` FROM \`${table}\` t
                JOIN hierarchy h ON t.\`${parentCol}\` = h.\`${idCol}\`
                WHERE t.status != 'DELETED'
            )
            SELECT \`${idCol}\` FROM hierarchy
        `;

        const [rows]: any = await pool.execute(query, [rootId]);
        return rows.map((r: any) => r[idCol]);
    } catch (error) {
        console.error(`[Hierarchy] Failed to resolve tree for ${dbPool}.${table}:`, error);
        return [rootId];
    }
}

/** 
 * Backward compatibility wrapper for Orion-specific legacy calls.
 * @deprecated Use getHierarchy directly.
 */
export async function getAccountHierarchy(accountId: number | null): Promise<number[]> {
    return getHierarchy('ORION', accountId);
}
