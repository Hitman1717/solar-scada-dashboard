// scrapeController.js - Handler to trigger scraper scripts and synchronize telemetry records
import prisma from '../config/prisma.js';
import { runScraper, syncTelemetryFromJson } from '../services/scraperRunner.js';

export const scrapeController = {
  triggerScrape: async (req, res) => {
    const { plantId } = req.params;
    try {
      console.log(`Manual scraping triggered for Plant ID ${plantId}...`);

      // 1. Fetch website credentials and provider name for this plant from the database
      const account = await prisma.website_accounts.findFirst({
        where: {
          plant_id: Number(plantId),
          enabled: true
        },
        include: {
          website_providers: true
        }
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'No active or enabled scraper account configuration found for this plant.'
        });
      }

      const providerName = account.website_providers?.provider_name || 'Polycab';

      // 2. Trigger the Puppeteer scraper script and wait for JSON export completion
      await runScraper(providerName, account.username, account.password);

      // 3. Sync the newly scraped telemetry data from solar_data.json to the telemetry table
      const syncedCount = await syncTelemetryFromJson(plantId);

      // 4. Update last_scraped_at
      await prisma.website_accounts.update({
        where: { id: account.id },
        data: { last_scraped_at: new Date() }
      });

      // Log audit
      await prisma.audit_logs.create({
        data: {
          user_id: req.user ? Number(req.user.id) : null,
          action: `Manually scraped ${providerName} plant data`,
          entity_type: 'Plant',
          entity_id: Number(plantId)
        }
      });

      res.json({
        success: true,
        message: `Successfully executed scraper for ${providerName}.`,
        syncedRecords: syncedCount
      });

    } catch (err) {
      console.error(`Scrape controller failed for Plant ID ${plantId}:`, err);
      res.status(500).json({
        success: false,
        error: err.message || 'Scraper execution or synchronization error occurred.'
      });
    }
  },

  // Onboard scraper account and auto-discover all plants under it
  onboardScraperAccount: async (req, res) => {
    const { providerId, username, password, scrapeIntervalMinutes } = req.body;
    try {
      console.log(`Onboarding scraper account for provider ID ${providerId}...`);

      // 1. Fetch provider details
      const provider = await prisma.website_providers.findUnique({
        where: { id: Number(providerId) }
      });

      if (!provider) {
        return res.status(404).json({ success: false, error: 'Website provider not found.' });
      }

      // 2. Trigger scraper to discover plants and write to solar_data.json
      await runScraper(provider.provider_name, username, password);

      // 3. Sync and auto-discover plants (writes them to database)
      const companyId = req.user?.company_id || 1;
      
      // Pass a dummy plantId or null so syncTelemetryFromJson knows it's an auto-discovery sync
      await syncTelemetryFromJson(null);

      // 4. Find the newly registered plants under this company to link them
      const dbPlants = await prisma.plants.findMany({
        where: { company_id: Number(companyId) },
        orderBy: { id: 'asc' }
      });

      if (dbPlants.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Scraper executed, but no stations/plants were found under this account.'
        });
      }

      // Link the website account to the first plant we found/created
      let account = await prisma.website_accounts.findFirst({
        where: {
          provider_id: Number(providerId),
          username: username
        }
      });

      if (!account) {
        account = await prisma.website_accounts.create({
          data: {
            plant_id: dbPlants[0].id,
            provider_id: Number(providerId),
            username: username,
            password: password,
            scrape_interval_minutes: Number(scrapeIntervalMinutes) || 5,
            enabled: true,
            last_scraped_at: new Date()
          }
        });
      }

      // Log audit
      await prisma.audit_logs.create({
        data: {
          user_id: req.user ? Number(req.user.id) : null,
          action: `Onboarded scraper account for provider ${provider.provider_name}`,
          entity_type: 'WebsiteAccount',
          entity_id: account.id
        }
      });

      res.json({
        success: true,
        message: `Successfully onboarded scraper account and registered ${dbPlants.length} plants.`,
        plantsCount: dbPlants.length
      });

    } catch (err) {
      console.error('Scraper onboarding failed:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Error occurred during scraper onboarding and plant discovery.'
      });
    }
  }
};
