import mysql, { Pool } from 'mysql2/promise';

/**
 * DatabaseManager: A singleton for managing multiple MySQL connection pools.
 * This pattern allows different products/screens to share a common configuration
 * but point to different database instances/schemas.
 *
 * NOTE: We attach the instance to `globalThis` to survive Next.js dev-mode
 * module re-evaluation. Without this, a new pool is created on every request.
 */
class DatabaseManager {
    private pools: Map<string, Pool> = new Map();

    /**
     * Get or create a connection pool for a specific database name.
     * @param name - The identifier for the pool (e.g., 'CORE', 'ORION')
     * @param connectionString - The MySQL URI for this pool
     */
    public async getPool(name: string, connectionString?: string): Promise<Pool> {
        if (this.pools.has(name)) {
            return this.pools.get(name)!;
        }

        if (!connectionString) {
            throw new Error(`Connection string required to initialize database pool: ${name}`);
        }

        console.log(`Initializing new database pool for: ${name}`);

        const pool = mysql.createPool({
            uri: connectionString,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 50,
            connectTimeout: 10000,
        });
        this.pools.set(name, pool);

        return pool;
    }

    /**
     * Utility to close all pools on shutdown
     */
    public async closeAll(): Promise<void> {
        for (const [name, pool] of this.pools.entries()) {
            console.log(`Closing database pool: ${name}`);
            await pool.end();
            this.pools.delete(name);
        }
    }
}

// Attach to globalThis to survive Next.js dev-mode module re-evaluation.
// In production, this behaves exactly the same as a regular module singleton.
const globalForDb = globalThis as typeof globalThis & { dbManager?: DatabaseManager };

if (!globalForDb.dbManager) {
    globalForDb.dbManager = new DatabaseManager();
}

export const dbManager = globalForDb.dbManager;
