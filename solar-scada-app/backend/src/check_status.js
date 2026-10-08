import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const plants = await pool.query('SELECT * FROM plants');
    console.log('Plants count:', plants.rows.length);
    console.log('Plants:', plants.rows);

    const plantUsers = await pool.query('SELECT * FROM plant_users');
    console.log('Plant Users count:', plantUsers.rows.length);
    console.log('Plant Users:', plantUsers.rows);

    const audits = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5');
    console.log('Recent Audits:', audits.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
