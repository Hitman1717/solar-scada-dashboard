import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for online PG hosts like Supabase/Neon
    }
  });
  console.log('PostgreSQL Pool initialized using DATABASE_URL');
} else {
  const isLocal = (process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1');
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'postgres',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });
  console.log(`PostgreSQL Pool initialized using individual connection variables (SSL: ${!isLocal})`);
}

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client from database pool:', err.stack);
  } else {
    console.log('Database connected successfully to PostgreSQL');
    release();
  }
});

export default pool;
