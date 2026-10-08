// scrapeController.js - Handler to trigger scraper scripts and synchronize telemetry records
import prisma from '../config/prisma.js';
import * as queues from '../services/queues.js';

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

      const oemKey = account.website_providers?.oem_key || 'polycab';

      // 2. Queue the job in the custom queue manager
      console.log(`[Scrape Controller] Queueing manual scrape job for plant ${plantId} (OEM: ${oemKey})`);
      const queue = queues.get(oemKey);
      const job = await queue.add('scrape', {
        accountId: account.id,
        plantId: Number(plantId),
        oemProviderId: account.provider_id
      }, {
        attempts: 1, // Only 1 attempt for manual trigger
        removeOnComplete: true,
        removeOnFail: 50
      });

      // 3. Await the job completion (finished promise)
      await job.finished;

      // Log audit
      await prisma.audit_logs.create({
        data: {
          user_id: req.user ? Number(req.user.id) : null,
          action: `Manually scraped ${oemKey} plant data`,
          entity_type: 'Plant',
          entity_id: Number(plantId)
        }
      });

      res.json({
        success: true,
        message: `Successfully executed scraper for ${oemKey}.`
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

      const companyId = req.user?.company_id || 1;

      // 2. Create a temporary website account record (disabled first, to prevent automatic polling)
      let account = await prisma.website_accounts.findFirst({
        where: {
          provider_id: Number(providerId),
          username: username
        }
      });

      if (!account) {
        account = await prisma.website_accounts.create({
          data: {
            provider_id: Number(providerId),
            username: username,
            password: password,
            scrape_interval_minutes: Number(scrapeIntervalMinutes) || 5,
            enabled: false // Disabled during onboarding/discovery
          }
        });
      }

      // 3. Queue the onboarding scrape task
      const oemKey = provider.oem_key || 'polycab';
      console.log(`[Scrape Controller] Queueing onboarding discovery job for provider ${oemKey}`);
      const queue = queues.get(oemKey);
      const job = await queue.add('scrape', {
        accountId: account.id,
        oemProviderId: Number(providerId),
        isOnboarding: true
      }, {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 50
      });

      // 4. Await discovery execution
      await job.finished;

      // 5. Query newly auto-onboarded plants under this company to link them
      const dbPlants = await prisma.plants.findMany({
        where: { company_id: Number(companyId) },
        orderBy: { id: 'asc' }
      });

      if (dbPlants.length === 0) {
        // Clean up temp account if no plants were found
        await prisma.website_accounts.delete({
          where: { id: account.id }
        }).catch(() => {});

        return res.status(400).json({
          success: false,
          error: 'Scraper executed, but no stations/plants were found under this account.'
        });
      }

      // 6. Link the website account to the first plant discovered and enable it
      await prisma.website_accounts.update({
        where: { id: account.id },
        data: {
          plant_id: dbPlants[0].id,
          enabled: true
        }
      });

      // Link any other discovered plants by creating separate website_accounts rows
      for (let i = 1; i < dbPlants.length; i++) {
        const extraPlant = dbPlants[i];
        const existingAcc = await prisma.website_accounts.findFirst({
          where: { plant_id: extraPlant.id }
        });
        if (!existingAcc) {
          await prisma.website_accounts.create({
            data: {
              plant_id: extraPlant.id,
              provider_id: Number(providerId),
              username: username,
              password: password,
              scrape_interval_minutes: Number(scrapeIntervalMinutes) || 5,
              enabled: true
            }
          });
        }
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
