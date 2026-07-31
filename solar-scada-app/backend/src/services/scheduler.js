import prisma from '../config/prisma.js';
import * as queues from './queues.js';

export async function tick() {
  const now = new Date();
  // Get time in minutes of the day to evaluate scheduled intervals
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  
  console.log(`[Scheduler] Ticking at ${now.toISOString()} (Minutes of the day: ${nowMinutes})...`);

  try {
    const accounts = await prisma.website_accounts.findMany({
      where: { enabled: true },
      include: { website_providers: true }
    });

    for (const account of accounts) {
      const interval = account.scrape_interval_minutes || 5;
      
      // Jitter offset derived from account ID: spreads accounts evenly across the interval window
      const offset = account.id % interval;
      
      const dueNow = (nowMinutes - offset) % interval === 0;
      
      if (!dueNow) {
        continue;
      }

      const oemKey = account.website_providers?.oem_key || 'polycab';
      console.log(`[Scheduler] Account ID ${account.id} (${account.username}, OEM: ${oemKey}) is due. Queueing scrape job.`);

      const queue = queues.get(oemKey);
      await queue.add('scrape', {
        accountId: account.id,
        plantId: account.plant_id,
        oemProviderId: account.provider_id
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }, // Backoff: 5s, 10s, 20s
        removeOnComplete: true,
        removeOnFail: 50
      });
    }
  } catch (err) {
    console.error(`[Scheduler] Error during schedule tick execution:`, err.message);
  }
}
