import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Resolve paths
const schemaPath = path.resolve('src/models/schema.sql');
const excelDataPath = path.resolve('../src/services/excel_data.json');

async function runSeed() {
  console.log('Starting Database Seeding...');
  
  try {
    // 1. Read and execute Schema SQL
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Executing schema.sql...');
    await pool.query(schemaSql);
    console.log('Schema executed successfully.');



    console.log('Seeding initial data...');

    // 3. Seed Companies
    await pool.query(`
      INSERT INTO companies (id, company_name, address, contact_person, contact_email, contact_phone, status) VALUES
      (1, 'Microsyslogic', '123 Tech Park, Chennai', 'Admin Rohit', 'admin@msl.com', '+91 98765 43210', 'Active'),
      (2, 'Oaksun Energy', 'Gaddiannaram Road, Hyderabad', 'Omkar Oak', 'omkar@oaksun.com', '+91 98765 11111', 'Active')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Seeded companies.');

    // 4. Seed Users
    const hashedPassword = bcrypt.hashSync('password', 10);
    await pool.query(`
      INSERT INTO users (id, company_id, name, email, password, role, is_active) VALUES
      (1, 1, 'Rohit Admin', 'admin@msl.com', $1, 'ADMIN', true),
      (2, 1, 'Manager Ramesh', 'mgmt@msl.com', $1, 'MANAGEMENT', true),
      (4, NULL, 'Super Admin', 'superadmin@msl.com', $1, 'SUPER_ADMIN', true)
      ON CONFLICT (id) DO NOTHING
    `, [hashedPassword]);
    console.log('Seeded users.');

    // 5. Seed Website Providers
    await pool.query(`
      INSERT INTO website_providers (id, provider_name, login_url, description) VALUES
      (1, 'Polycab', 'https://polycab.com', 'Polycab monitoring API'),
      (2, 'Solis', 'https://solisinverters.com', 'Solis Cloud API portal'),
      (3, 'Solax', 'https://solaxcloud.com', 'Solax portal scraper')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Seeded website providers.');

    // 6. Load excel data for Plants and Telemetry
    if (fs.existsSync(excelDataPath)) {
      console.log('Found excel_data.json, seeding plants and telemetry...');
      const rawExcel = fs.readFileSync(excelDataPath, 'utf8');
      const excelData = JSON.parse(rawExcel);

      const plants = excelData.plants || [];
      const telemetry = excelData.telemetry || [];

      // Seed Plants
      for (const p of plants) {
        await pool.query(`
          INSERT INTO plants (id, company_id, plant_name, plant_capacity, location, latitude, longitude, status, commission_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          p.id,
          p.company_id || 1,
          p.plant_name,
          p.plant_capacity,
          p.location,
          p.latitude || null,
          p.longitude || null,
          p.status || 'Normal',
          p.commission_date || null
        ]);
      }
      console.log(`Seeded ${plants.length} plants.`);

      // Seed Telemetry
      for (const t of telemetry) {
        // Map 'power' or 'pv_power' to 'present_power'
        const presentPower = t.present_power !== undefined ? t.present_power : (t.power !== undefined ? t.power : t.pv_power || 0.00);
        await pool.query(`
          INSERT INTO telemetry (
            id, plant_id, timestamp, present_power, voltage, current, frequency,
            daily_generation, total_generation, temperature, status, irradiance,
            plant_type, grid_status, battery_voltage, daily_charge, daily_discharge,
            daily_consumed, imported_energy, raw_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (id) DO NOTHING
        `, [
          t.id,
          t.plant_id,
          t.timestamp,
          presentPower,
          t.voltage || 0.00,
          t.current || 0.00,
          t.frequency || 50.00,
          t.daily_generation || 0.00,
          t.total_generation || 0.00,
          t.temperature || 0.00,
          t.status || 'Normal',
          t.irradiance || 0.00,
          t.plant_type || 'Residential',
          t.grid_status || 'On-grid',
          t.battery_voltage || 0.00,
          t.daily_charge || 0.00,
          t.daily_discharge || 0.00,
          t.daily_consumed || 0.00,
          t.imported_energy || 0.00,
          t.raw_json ? JSON.stringify(t.raw_json) : null
        ]);
      }
      console.log(`Seeded ${telemetry.length} telemetry records.`);

      // Dynamic mappings for Plant Users and Website Accounts based on imported plants
      console.log('Seeding dynamic plant mappings and website accounts...');
      for (const p of plants) {
        // Map Admin (1) and Management (2) to each plant
        await pool.query(`
          INSERT INTO plant_users (user_id, plant_id) VALUES (1, $1), (2, $1)
          ON CONFLICT DO NOTHING
        `, [p.id]);

        // Map website accounts
        let providerId = 1; // Polycab
        if (p.id >= 5) {
          providerId = 2; // Solis
        } else if (p.id === 3 || p.id === 4) {
          providerId = 3; // Solax
        }

        await pool.query(`
          INSERT INTO website_accounts (id, plant_id, provider_id, username, password, scrape_interval_minutes, enabled, last_scraped_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          p.id,
          p.id,
          providerId,
          `plant.${p.id}.user`,
          'password123',
          5,
          true
        ]);
      }
      console.log('Seeded plant users and website accounts.');

    } else {
      console.log('excel_data.json not found, skipping plants & telemetry seeding.');
    }

    // 7. Seed Plant Tables
    await pool.query(`
      INSERT INTO plant_tables (id, plant_id, table_number, panels_count, panel_model, inverter_model, gateway_id, mac_address, degrade_pct, age_years, power_w) VALUES
      (1, 1, 'T-01', 10, 'Oaksun-100W', 'Oaksun Inv 1', 'GW-01', '00:1A:2B:3C:4D:5E', 1, 0.5, 3870),
      (2, 1, 'T-02', 15, 'Oaksun-100W', 'Oaksun Inv 1', 'GW-01', '00:1A:2B:3C:4D:5F', 2, 0.5, 5820),
      (3, 1, 'T-03', 15, 'Oaksun-100W', 'Oaksun Inv 2', 'GW-02', '00:1A:2B:3C:4D:60', 1, 0.5, 8950)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Seeded plant string tables.');

    // 8. Seed Plant Issues
    await pool.query(`
      INSERT INTO plant_issues (id, plant_id, telemetry_id, issue_type, severity, message, status, started_at) VALUES
      (1, 1, null, 'Low Generation', 'Moderate', 'String T-01 output is 5% below expected capacity.', 'Active', '2026-07-06T10:00:00Z')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Seeded initial plant issues.');

    // 9. Seed Audit Logs
    await pool.query(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, created_at) VALUES
      (1, 4, 'Created Company', 'Company', 2, '2025-02-15T11:30:00Z'),
      (2, 1, 'Updated Website Password', 'WebsiteAccount', 1, '2026-07-06T09:00:00Z')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Seeded audit logs.');

    // 10. Reset PostgreSQL SERIAL Sequences to match Max(id) (Solves audit_logs duplicate pkey constraint errors)
    console.log('Resetting database SERIAL sequence generators...');
    await pool.query(`
      SELECT setval('companies_id_seq', COALESCE((SELECT MAX(id) FROM companies), 1));
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
      SELECT setval('plants_id_seq', COALESCE((SELECT MAX(id) FROM plants), 1));
      SELECT setval('website_providers_id_seq', COALESCE((SELECT MAX(id) FROM website_providers), 1));
      SELECT setval('website_accounts_id_seq', COALESCE((SELECT MAX(id) FROM website_accounts), 1));
      SELECT setval('plant_tables_id_seq', COALESCE((SELECT MAX(id) FROM plant_tables), 1));
      SELECT setval('telemetry_id_seq', COALESCE((SELECT MAX(id) FROM telemetry), 1));
      SELECT setval('plant_issues_id_seq', COALESCE((SELECT MAX(id) FROM plant_issues), 1));
      SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 1));
      SELECT setval('company_variables_id_seq', COALESCE((SELECT MAX(id) FROM company_variables), 1));
    `);
    console.log('Database sequences synchronized successfully.');

    console.log('Database Seeding Complete successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding failed with error:', error);
    process.exit(1);
  }
}

runSeed();
