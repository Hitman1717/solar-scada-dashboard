import { Worker } from './queues.js';
import browserPool from './browserPool.js';
import { sessionPath, getSessionIfExists } from './sessions.js';
import prisma from '../config/prisma.js';
import { syncTelemetryFromJson } from './scraperRunner.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRAPER_DIR = path.resolve(__dirname, '../../../../solar_scrapping');
const JSON_DATA_FILE = path.join(SCRAPER_DIR, 'solar_data.json');

import * as polycabScraper from './scrapers/polycab.js';
import * as solisScraper from './scrapers/solis.js';
import * as solaxScraper from './scrapers/solax.js';

const scrapers = {
  polycab: polycabScraper,
  solis: solisScraper,
  solax: solaxScraper
};

// Map of active worker instances
const workers = {};

export function initWorkers() {
  const oemKeys = ['polycab', 'solis', 'solax'];
  
  oemKeys.forEach(oemKey => {
    const queueName = `${oemKey}-scrapes`;
    
    // Each OEM queue gets its own worker configuration (concurrency / rate limiter)
    const worker = new Worker(queueName, async (job) => {
      console.log(`[Worker:${oemKey}] Processing job ${job.id} for accountId ${job.data.accountId}...`);
      await processScrapeJob(job, oemKey);
    }, {
      concurrency: oemKey === 'solis' ? 5 : 3, // Solis: max 5 jobs, others: 3
      limiter: {
        max: oemKey === 'solis' ? 5 : 3,
        duration: 10000 // duration window in ms (e.g. 5 jobs per 10s)
      }
    });

    worker.on('failed', async (job, error) => {
      await handleJobFailure(job, error);
    });

    workers[oemKey] = worker;
    console.log(`[Worker:${oemKey}] Worker registered successfully on queue: ${queueName}`);
  });
}

async function processScrapeJob(job, oemKey) {
  const { accountId, plantId } = job.data;

  const account = await prisma.website_accounts.findUnique({
    where: { id: Number(accountId) }
  });

  if (!account || (!account.enabled && !job.data.isOnboarding)) {
    console.log(`[Worker:${oemKey}] Account ${accountId} is deleted or disabled (and not onboarding). Skipping.`);
    return;
  }

  const scraper = scrapers[oemKey];
  if (!scraper) {
    throw new Error(`Scraper strategy for OEM '${oemKey}' is not supported/implemented.`);
  }

  const browser = await browserPool.acquire();
  let context = null;

  try {
    const sessionState = await getSessionIfExists(accountId);
    context = await browser.newContext({
      storageState: sessionState,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    
    // 1. Run the Playwright strategy scraper
    console.log(`[Worker:${oemKey}] Running scrape for account username: ${account.username}...`);
    const scrapedData = await scraper.scrape(account, page);
    
    // 2. Persist cookies/storageState session for subsequent scrapes
    await context.storageState({ path: sessionPath(accountId) });
    await context.close();
    context = null;

    // 3. Save telemetry and update database
    await saveScrapedResults(account, scrapedData);

    // 4. Update WebsiteAccounts.last_scraped_at
    await prisma.website_accounts.update({
      where: { id: account.id },
      data: { last_scraped_at: new Date() }
    });

    // 5. If successful, resolve any active ScrapeFailure alarms for this plant
    await prisma.plant_issues.updateMany({
      where: {
        plant_id: account.plant_id,
        issue_type: 'ScrapeFailure',
        status: 'Active'
      },
      data: {
        status: 'Resolved',
        resolved_at: new Date(),
        updated_at: new Date()
      }
    });

    // Restore plant status to Normal if it was marked Bad due to scrape failure
    if (account.plant_id) {
      const plant = await prisma.plants.findUnique({ where: { id: account.plant_id } });
      if (plant && plant.status === 'Bad') {
        await prisma.plants.update({
          where: { id: account.plant_id },
          data: { status: 'Normal' }
        });
      }
    }

    console.log(`[Worker:${oemKey}] Job ${job.id} scrape and database sync completed successfully.`);

  } catch (err) {
    if (context) {
      await context.close().catch(() => {});
    }
    throw err; // Re-throw to trigger BullMQ worker attempts/backoff retry logic
  } finally {
    browserPool.release(browser);
  }
}

export async function saveScrapedResults(account, scrapedData) {
  if (!scrapedData || scrapedData.length === 0) {
    console.log(`[Worker] No new telemetry data parsed by scraper.`);
    return;
  }

  // 1. Get active database plants for resolving names to IDs dynamically
  const dbPlants = await prisma.plants.findMany();
  const nameToId = {};
  dbPlants.forEach(p => {
    nameToId[p.plant_name.toLowerCase().trim()] = p.id;
  });

  // Determine starting ID for new dynamically discovered plants
  let nextId = 1;
  if (dbPlants.length > 0) {
    nextId = Math.max(...dbPlants.map(p => p.id)) + 1;
  }

  // Track all plants we see in this scrape session
  const sessionPlants = {}; // name -> id

  // 2. Build list of records with resolved/allocated plant IDs
  const newRows = [];
  for (const record of scrapedData) {
    const cleanName = record.plant_name.trim();
    const lowerName = cleanName.toLowerCase();
    
    let recordPlantId = nameToId[lowerName];
    
    // If not in database, check if we already allocated an ID in this session
    if (!recordPlantId) {
      if (sessionPlants[lowerName]) {
        recordPlantId = sessionPlants[lowerName];
      } else {
        recordPlantId = nextId++;
        sessionPlants[lowerName] = recordPlantId;
        console.log(`[Worker] Dynamically allocated ID ${recordPlantId} for discovered plant: '${cleanName}'`);
      }
    } else {
      sessionPlants[lowerName] = recordPlantId;
    }

    newRows.push({
      plant_id: recordPlantId,
      timestamp: record.timestamp,
      power: record.power,
      voltage: null,
      current: null,
      frequency: null,
      irradiance: null,
      daily_generation: record.daily_generation,
      total_generation: record.total_generation,
      temperature: null,
      status: record.status,
      raw_json: typeof record.raw_json === 'object' ? JSON.stringify(record.raw_json) : String(record.raw_json),
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
  }

  // 3. Read existing solar_data.json
  let fileData = { plants: [], telemetry: [] };
  if (fs.existsSync(JSON_DATA_FILE)) {
    try {
      fileData = JSON.parse(fs.readFileSync(JSON_DATA_FILE, 'utf8'));
    } catch (e) {
      console.error(`[Worker] Failed to parse solar_data.json, recreating...`);
    }
  }
  if (!fileData.plants) fileData.plants = [];
  if (!fileData.telemetry) fileData.telemetry = [];

  // Merge old and new records
  const combined = [...fileData.telemetry, ...newRows];
  
  // Sort descending by timestamp for deduplication
  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const seen = new Set();
  const unique = [];
  for (const row of combined) {
    const key = `${row.plant_id}|||${row.timestamp}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }

  // Sort ascending for file serialization
  unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  unique.forEach((row, idx) => {
    row.id = idx + 1;
  });

  // Re-build file plants mapping list, adding the newly discovered session plants
  const uniquePlantIds = [...new Set(unique.map(r => r.plant_id))];
  
  const plantsMap = {};
  // First, add all existing database plants
  dbPlants.forEach(p => {
    plantsMap[p.id] = p.plant_name.toUpperCase();
  });
  // Then, add the dynamically discovered plants from this session
  Object.entries(sessionPlants).forEach(([lowerName, id]) => {
    if (!plantsMap[id]) {
      const originalRecord = scrapedData.find(r => r.plant_name.toLowerCase().trim() === lowerName);
      plantsMap[id] = (originalRecord ? originalRecord.plant_name : lowerName).toUpperCase();
    }
  });

  const filePlants = uniquePlantIds
    .filter(id => plantsMap[id])
    .map(id => {
      const record = unique.find(r => r.plant_id === id);
      let capacity = '10.00 kWp';
      if (record && record.raw_json) {
        try {
          const raw = typeof record.raw_json === 'string' ? JSON.parse(record.raw_json) : record.raw_json;
          if (raw.GoodsKWP) {
            capacity = parseFloat(raw.GoodsKWP).toFixed(2) + ' kWp';
          } else if (raw["PV Capacity"]) {
            capacity = String(raw["PV Capacity"]).toLowerCase().includes('kw') ? String(raw["PV Capacity"]) : (String(raw["PV Capacity"]) + ' kWp');
          }
        } catch (e) {}
      }
      return {
        id: id,
        plant_name: plantsMap[id],
        plant_capacity: capacity
      };
    })
    .sort((a, b) => a.id - b.id);

  fs.writeFileSync(JSON_DATA_FILE, JSON.stringify({
    plants: filePlants,
    telemetry: unique
  }, null, 2), 'utf8');

  console.log(`[Worker] Updated solar_data.json with ${newRows.length} records and ${filePlants.length} active plants.`);

  // 4. Opportunistic sync to database and anomaly detection trigger
  await syncTelemetryFromJson(account.plant_id);
}

async function handleJobFailure(job, error) {
  const { accountId, plantId } = job.data;
  console.error(`[Worker] Scraping job ${job.id} for account ${accountId} permanently failed: ${error.message}`);

  try {
    // 1. Log failure to AuditLogs
    await prisma.audit_logs.create({
      data: {
        action: `Scrape Job Failed: ${error.message.substring(0, 200)}`,
        entity_type: 'WebsiteAccount',
        entity_id: Number(accountId)
      }
    });

    if (plantId) {
      const plantIdNum = Number(plantId);

      // 2. Flag plant status = 'Bad'
      await prisma.plants.update({
        where: { id: plantIdNum },
        data: { status: 'Bad' }
      });

      // 3. Create or update Critical ScrapeFailure issue in plant_issues
      const existingIssue = await prisma.plant_issues.findFirst({
        where: {
          plant_id: plantIdNum,
          issue_type: 'ScrapeFailure',
          status: 'Active'
        }
      });

      if (!existingIssue) {
        await prisma.plant_issues.create({
          data: {
            plant_id: plantIdNum,
            issue_type: 'ScrapeFailure',
            severity: 'Critical',
            message: `Scraping failed consistently after maximum retries. Error: ${error.message.substring(0, 150)}`,
            status: 'Active',
            started_at: new Date()
          }
        });
      }
    }
  } catch (err) {
    console.error(`[Worker] Failed during permanent error handling sequence:`, err.message);
  }
}
