import pool from '../config/db.js';

async function migrate() {
  console.log('Starting migration to add oem_key column...');
  try {
    // 1. Add column if it doesn't exist
    await pool.query(`
      ALTER TABLE website_providers 
      ADD COLUMN IF NOT EXISTS oem_key VARCHAR(100) UNIQUE;
    `);
    console.log('Ensured oem_key column exists.');

    // 2. Populate default values
    await pool.query(`
      UPDATE website_providers 
      SET oem_key = 'polycab' 
      WHERE provider_name ILIKE '%polycab%' AND oem_key IS NULL;
    `);
    
    await pool.query(`
      UPDATE website_providers 
      SET oem_key = 'solis' 
      WHERE provider_name ILIKE '%solis%' AND oem_key IS NULL;
    `);

    await pool.query(`
      UPDATE website_providers 
      SET oem_key = 'solax' 
      WHERE provider_name ILIKE '%solax%' AND oem_key IS NULL;
    `);
    
    console.log('Populated default oem_keys successfully.');
    
    // Print out current state of website_providers
    const result = await pool.query('SELECT id, provider_name, oem_key FROM website_providers');
    console.log('Current website_providers table state:');
    console.table(result.rows);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
    console.log('Migration finished.');
  }
}

migrate();
