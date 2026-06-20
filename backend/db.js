const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Load .env.local if it exists (for local development), otherwise load .env (for production/deployment)
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'billx_v2',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  dateStrings:        true,
  timezone:           '+05:30',
  charset:            'UTF8MB4_UNICODE_CI',
  ssl:                process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const promisePool = pool.promise();

// Test connection on startup
pool.getConnection((err, conn) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ MySQL connected to:', process.env.DB_NAME);
  conn.release();
});

module.exports = promisePool;
