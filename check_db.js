const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function checkUsers() {
    try {
        const connection = await mysql.createConnection(process.env.CORE_DB_URL);
        console.log('Connected to:', process.env.CORE_DB_URL);

        const [users] = await connection.execute('SELECT id, username FROM users');
        console.log('Users in local DB:', users);

        const [keys] = await connection.execute('SHOW CREATE TABLE api_keys');
        console.log('API Keys Table Definition:', keys[0]['Create Table']);

        await connection.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

checkUsers();
