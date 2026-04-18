import { dbManager } from "@/core/db/manager";

export interface AuditEntry {
    username: string;
    ipAddress?: string;
    screen?: string;
    action: 'Login' | 'Logout' | 'Data Insert' | 'Data Update' | 'Data Delete' | 'Login Failed' | 'Bulk Action' | string;
    details?: string;
    status: 'Success' | 'Fail';
}

export class AuditLogger {
    private static CORE_POOL_NAME = 'CORE';

    public static async log(entry: AuditEntry) {
        try {
            const connectionString = process.env.CORE_DB_URL;
            if (!connectionString) {
                console.warn("CORE_DB_URL not set, skipping audit log.");
                return;
            }

            const pool = await dbManager.getPool(this.CORE_POOL_NAME, connectionString);

            // 1. Insert the new log entry
            await pool.execute(
                `INSERT INTO audit_logs (username, ip_address, screen, action, details, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [entry.username, entry.ipAddress || null, entry.screen || null, entry.action, entry.details || null, entry.status]
            );

            // 2. Data Retention: Maintain only for last 7 days
            // Note: This runs on every log entry. For high-volume systems, 
            // this should be moved to a cron job or scheduled task.
            await pool.execute(
                `DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)`
            );

        } catch (error) {
            console.error("Failed to write audit log:", error);
        }
    }
}
