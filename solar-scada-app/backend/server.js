import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './src/routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());

// Parse JSON and form-url-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Solar SCADA Backend is running' });
});

// Main API Router
app.use('/api', apiRouter);

// Background Cron Scheduler (Runs every minute to check active plants and trigger due scrapers)
import cron from 'node-cron';
import prisma from './src/config/prisma.js';
import { runScraper, syncTelemetryFromJson } from './src/services/scraperRunner.js';
import { runAnomalyDetection } from './src/services/anomalyDetector.js';

cron.schedule('* * * * *', async () => {
  console.log('--- [Cron] Polling active website accounts for scheduling... ---');
  try {
    const activeAccounts = await prisma.website_accounts.findMany({
      where: { enabled: true },
      include: { website_providers: true }
    });
    
    const now = new Date();
    
    for (const account of activeAccounts) {
      try {
        let isDue = false;
        if (!account.last_scraped_at) {
          isDue = true;
        } else {
          const elapsedMinutes = (now - new Date(account.last_scraped_at)) / 1000 / 60;
          isDue = elapsedMinutes >= (account.scrape_interval_minutes || 5);
        }

        if (isDue) {
          const providerName = account.website_providers?.provider_name || 'Polycab';
          console.log(`[Cron] Scraping due for Plant ID ${account.plant_id} (${providerName}). Interval: ${account.scrape_interval_minutes}m.`);
          
          // 1. Run Puppeteer scraper and irradiance post-processor
          await runScraper(providerName, account.username, account.password);
          
          // 2. Sync all newly scraped telemetry records (opportunistic)
          await syncTelemetryFromJson(account.plant_id);

          // 3. Update last_scraped_at to prevent immediate repeat scraping
          await prisma.website_accounts.update({
            where: { id: account.id },
            data: { last_scraped_at: now }
          });

          console.log(`[Cron] Successfully completed scraping and updated last_scraped_at for Plant ID ${account.plant_id}.`);
        }
      } catch (err) {
        console.error(`[Cron] Failed during schedule check/scrape for plant ${account.plant_id}:`, err.message);
      }
    }
    // 4. Run global anomaly checks
    await runAnomalyDetection();
  } catch (err) {
    console.error('[Cron] Failed to process scheduled scraper check:', err.message);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Solar SCADA Backend listening on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}/api`);
  console.log(`=================================================`);
});
