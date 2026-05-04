const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const coreDbUrlMatch = envContent.match(/CORE_DB_URL=(.+)/);
const CORE_DB_URL = coreDbUrlMatch ? coreDbUrlMatch[1].trim() : null;

async function runMigration() {
    try {
        if (!CORE_DB_URL) throw new Error('CORE_DB_URL not found in .env.local');
        const connection = await mysql.createConnection(CORE_DB_URL);
        console.log('Connected to CORE database.');

        const sqlPath = path.join(__dirname, '../../SPAR-ORION-Portal/sql/register_module.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon but ignore semicolons inside comments/strings if any
        // For simplicity, we'll split by ;\n
        const statements = sql.split(/;\s*[\r\n]/);

        for (let statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.trim().substring(0, 50) + '...');
                await connection.execute(statement);
            }
        }

        console.log('Migration completed successfully.');
        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
