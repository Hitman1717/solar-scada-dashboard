import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
let pool;

if (process.env.DATABASE_URL) {
  // Use direct connection URL (if the pooler is active, ensure we pass the correct params or use standard connection pool)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Supabase/Neon PostgreSQL
    }
  });
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
}

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
