// scraperRunner.js - Child process manager to trigger Puppeteer scrapers and sync JSON results
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/prisma.js';
import { runAnomalyDetection } from './anomalyDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths resolved relative to this service file
const SCRAPER_DIR = path.resolve(__dirname, '../../../../solar_scrapping');
const CREDENTIALS_FILE = path.join(SCRAPER_DIR, 'credentials.json');
const JSON_DATA_FILE = path.join(SCRAPER_DIR, 'solar_data.json');

/**
 * Runs a specific website provider scraper and updates credentials.json dynamically
 */
export function runScraper(providerName, username, password) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Starting scraper run for ${providerName}...`);

      // 1. Update credentials.json dynamically
      if (fs.existsSync(CREDENTIALS_FILE)) {
        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
        const key = providerName.toLowerCase();
        if (!creds[key]) creds[key] = {};
        creds[key].username = username;
        creds[key].password = password;
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
        console.log(`Successfully updated credentials.json for ${providerName}.`);
      }

      // 2. Select scraper folder and file
      const providerKey = providerName.toLowerCase();
      let scraperSubdir = '';
      let scraperFile = '';

      if (providerKey.includes('polycab')) {
        scraperSubdir = 'polycab';
        scraperFile = 'polycab.js';
      } else if (providerKey.includes('solax')) {
        scraperSubdir = 'solax';
        scraperFile = 'solax.js';
      } else if (providerKey.includes('solis')) {
        scraperSubdir = 'solis';
        scraperFile = 'solis.js';
      } else {
        return reject(new Error(`Unsupported scraper provider: ${providerName}`));
      }

      const scriptPath = path.join(SCRAPER_DIR, scraperSubdir, scraperFile);
      const workingDir = path.join(SCRAPER_DIR, scraperSubdir);

      console.log(`Executing scraper: node ${scraperFile} in ${workingDir}`);

      // 3. Execute Scraper Script
      exec(`node ${scraperFile}`, { cwd: workingDir }, (err, stdout, stderr) => {
        if (err) {
          console.error(`Scraper execution error for ${providerName}:`, err);
          return reject(err);
        }

        console.log(`Scraper stdout for ${providerName}:\n`, stdout);

        // 4. Run irradiance post-processor (update_irradiance.js) to parse newly updated solar_data.json
        console.log('Running irradiance post-processor to update solar_data.json...');
        const irradianceScript = path.join(SCRAPER_DIR, 'update_irradiance.js');

        exec('node update_irradiance.js', { cwd: SCRAPER_DIR }, (expErr, expStdout, expStderr) => {
          if (expErr) {
            console.error('Irradiance processor failed:', expErr);
            return reject(expErr);
          }

          console.log('Irradiance processor stdout:\n', expStdout);
          resolve({ success: true, message: `${providerName} scraping and irradiance processing completed.` });
        });
      });

    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Syncs newly generated solar_data.json telemetry records back to PostgreSQL using Prisma
 * Uses Opportunistic Sync (Plan A) to update all registered plants found in the dataset.
 */
export async function syncTelemetryFromJson(plantId) {
  try {
    console.log(`Synchronizing PostgreSQL database telemetry (Opportunistic Sync)...`);
    
    if (!fs.existsSync(JSON_DATA_FILE)) {
      throw new Error(`solar_data.json not found at ${JSON_DATA_FILE}`);
    }

    const fileData = JSON.parse(fs.readFileSync(JSON_DATA_FILE, 'utf8'));
    const telemetry = fileData.telemetry || [];
    const filePlants = fileData.plants || [];

    // Get triggering company ID to assign auto-discovered plants
    let companyId = null;
    if (plantId) {
      const triggerPlant = await prisma.plants.findUnique({
        where: { id: Number(plantId) },
        select: { company_id: true }
      });
      if (triggerPlant) {
        companyId = triggerPlant.company_id;
      }
    }
    if (!companyId) {
      const firstCompany = await prisma.companies.findFirst({ select: { id: true } });
      companyId = firstCompany ? firstCompany.id : null;
    }

    // 1. Auto-discover and Onboard new plants from the file array
    for (const p of filePlants) {
      const existingDbPlant = await prisma.plants.findFirst({
        where: { plant_name: p.plant_name }
      });
      if (!existingDbPlant && companyId) {
        console.log(`Auto-Discovering and Onboarding new Plant: ${p.plant_name}...`);
        await prisma.plants.create({
          data: {
            company_id: companyId,
            plant_name: p.plant_name,
            plant_capacity: p.plant_capacity || '10.00 kWp',
            location: p.location || 'Unknown',
            latitude: p.latitude ? Number(p.latitude) : 17.4065,
            longitude: p.longitude ? Number(p.longitude) : 78.4772,
            status: p.status || 'Normal',
            commission_date: p.commission_date ? new Date(p.commission_date) : new Date()
          }
        });
      }
    }

    // Build plant maps for ID alignment by name
    const dbPlants = await prisma.plants.findMany();
    const plantNameToDbId = {};
    dbPlants.forEach(p => {
      plantNameToDbId[p.plant_name.toLowerCase()] = p.id;
    });

    const filePlantIdToName = {};
    filePlants.forEach(p => {
      filePlantIdToName[p.id] = p.plant_name.toLowerCase();
    });

    // 2. Filter telemetry rows belonging to registered plants
    const validTelemetry = telemetry.filter(t => {
      const name = filePlantIdToName[t.plant_id];
      const dbId = name ? plantNameToDbId[name] : null;
      return dbId !== null && dbId !== undefined;
    });

    if (validTelemetry.length === 0) {
      console.log(`No registered plant telemetry records found in solar_data.json.`);
      return 0;
    }

    // Group telemetry by matched database plant ID
    const telemetryByPlant = {};
    validTelemetry.forEach(t => {
      const name = filePlantIdToName[t.plant_id];
      const dbId = plantNameToDbId[name];
      if (!telemetryByPlant[dbId]) telemetryByPlant[dbId] = [];
      telemetryByPlant[dbId].push(t);
    });

    let totalInsertedCount = 0;
    let triggeredPlantCount = 0;

    for (const pid of Object.keys(telemetryByPlant)) {
      const plantIdNum = Number(pid);
      const plantTelemetry = telemetryByPlant[pid];

      // Find the latest timestamp in PostgreSQL for this plant to prevent duplicate key errors
      const latestDbResult = await prisma.telemetry.findFirst({
        where: { plant_id: plantIdNum },
        orderBy: { timestamp: 'desc' }
      });
      const latestDbTimestamp = latestDbResult ? new Date(latestDbResult.timestamp) : new Date(0);

      // Insert only newer telemetry rows
      let plantInsertedCount = 0;
      for (const t of plantTelemetry) {
        const rowTimestamp = new Date(t.timestamp);
        if (rowTimestamp > latestDbTimestamp) {
          // Map present_power
          const presentPower = t.present_power !== undefined ? t.present_power : (t.power !== undefined ? t.power : t.pv_power || 0.00);

          await prisma.telemetry.create({
            data: {
              plant_id: plantIdNum,
              timestamp: rowTimestamp,
              present_power: presentPower,
              voltage: t.voltage || 0.00,
              current: t.current || 0.00,
              frequency: t.frequency || 50.00,
              daily_generation: t.daily_generation || 0.00,
              total_generation: t.total_generation || 0.00,
              temperature: t.temperature || 0.00,
              status: t.status || 'Normal',
              irradiance: t.irradiance || 0.00,
              plant_type: t.plant_type || 'Residential',
              grid_status: t.grid_status || 'On-grid',
              battery_voltage: t.battery_voltage || 0.00,
              daily_charge: t.daily_charge || 0.00,
              daily_discharge: t.daily_discharge || 0.00,
              daily_consumed: t.daily_consumed || 0.00,
              imported_energy: t.imported_energy || 0.00,
              raw_json: t.raw_json ? (typeof t.raw_json === 'object' ? JSON.stringify(t.raw_json) : String(t.raw_json)) : null
            }
          });
          plantInsertedCount++;
        }
      }
      totalInsertedCount += plantInsertedCount;
      if (plantIdNum === Number(plantId)) {
        triggeredPlantCount = plantInsertedCount;
      }
    }

    console.log(`Successfully synced ${totalInsertedCount} new telemetry rows across registered plants to PostgreSQL.`);

    // 3. Trigger active alerts check (Offline / ±5% Underperformance correlation)
    await runAnomalyDetection();
    
    // Return the rows inserted for the triggered plant ID if provided (for backward compatibility)
    return plantId ? triggeredPlantCount : totalInsertedCount;

  } catch (err) {
    console.error(`Failed to sync telemetry from JSON:`, err);
    throw err;
  }
}
