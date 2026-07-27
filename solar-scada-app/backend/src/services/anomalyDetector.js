import prisma from '../config/prisma.js';

/**
 * Runs the geographical correlation and offline status checks for all plants
 */
export async function runAnomalyDetection() {
  console.log('--- [Anomaly Detector] Running SCADA Alerts & Anomalies check... ---');
  try {
    const plants = await prisma.plants.findMany();
    if (plants.length === 0) return;

    const now = new Date();
    const activeIssues = await prisma.plant_issues.findMany({
      where: { status: 'Active' }
    });

    // 1. Group plants by geographical proximity (within 0.01 lat/lng, ~1km)
    const groups = [];
    const visited = new Set();

    for (let i = 0; i < plants.length; i++) {
      if (visited.has(plants[i].id)) continue;
      const group = [plants[i]];
      visited.add(plants[i].id);

      const lat1 = Number(plants[i].latitude || 0);
      const lng1 = Number(plants[i].longitude || 0);

      for (let j = i + 1; j < plants.length; j++) {
        if (visited.has(plants[j].id)) continue;
        const lat2 = Number(plants[j].latitude || 0);
        const lng2 = Number(plants[j].longitude || 0);

        if (Math.abs(lat1 - lat2) <= 0.01 && Math.abs(lng1 - lng2) <= 0.01) {
          group.push(plants[j]);
          visited.add(plants[j].id);
        }
      }
      if (group.length > 1) {
        groups.push(group);
      }
    }

    console.log(`[Anomaly Detector] Found ${groups.length} geographical plant clusters.`);

    // Keep track of plants that underperform
    const underperformingPlants = new Set();
    const offlinePlants = new Set();

    // 2. Offline check: Check if plants haven't reported telemetry in 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    // We only perform offline checks during daylight hours (e.g. 7 AM to 6 PM)
    const currentHour = now.getHours();
    const isDaylight = currentHour >= 7 && currentHour <= 18;

    for (const plant of plants) {
      const latestTelemetry = await prisma.telemetry.findFirst({
        where: { plant_id: plant.id },
        orderBy: { timestamp: 'desc' }
      });

      let isOffline = false;
      if (!latestTelemetry) {
        isOffline = true;
      } else {
        const lastSeen = new Date(latestTelemetry.timestamp);
        if (lastSeen < twoHoursAgo) {
          isOffline = true;
        }
      }

      // If offline (during daylight or in general), flag it
      if (isOffline && isDaylight) {
        offlinePlants.add(plant.id);
        
        // Trigger Critical Offline Alarm
        const existingOfflineAlert = activeIssues.find(
          i => i.plant_id === plant.id && i.issue_type === 'Offline'
        );
        if (!existingOfflineAlert) {
          console.log(`[Anomaly Detector] Plant ${plant.plant_name} triggered OFFLINE alarm.`);
          await prisma.plant_issues.create({
            data: {
              plant_id: plant.id,
              issue_type: 'Offline',
              severity: 'Critical',
              message: `Station is offline - no telemetry received since ${latestTelemetry ? new Date(latestTelemetry.timestamp).toLocaleString() : 'ever'}.`,
              status: 'Active',
              started_at: now
            }
          });
        }
      } else {
        // Resolve Offline Alarm if active
        const existingOfflineAlert = activeIssues.find(
          i => i.plant_id === plant.id && i.issue_type === 'Offline'
        );
        if (existingOfflineAlert) {
          console.log(`[Anomaly Detector] Plant ${plant.plant_name} OFFLINE alarm resolved.`);
          await prisma.plant_issues.update({
            where: { id: existingOfflineAlert.id },
            data: {
              status: 'Resolved',
              resolved_at: now
            }
          });
        }
      }
    }

    // 3. Proximity +-5% check
    for (const group of groups) {
      // Find latest telemetry for each plant in group
      const latestData = [];
      for (const plant of group) {
        // Skip if plant is offline
        if (offlinePlants.has(plant.id)) continue;

        const telemetry = await prisma.telemetry.findFirst({
          where: { plant_id: plant.id },
          orderBy: { timestamp: 'desc' }
        });
        if (telemetry) {
          // Ensure telemetry is fresh (within last 2 hours)
          const telTime = new Date(telemetry.timestamp);
          if (telTime >= twoHoursAgo) {
            const capacityStr = plant.plant_capacity || '10.00 kWp';
            const capacity = parseFloat(capacityStr) || 10.00;
            const power = parseFloat(telemetry.present_power) || 0.00;
            const normalized = power / capacity; // kW per kWp

            latestData.push({
              plant,
              normalized,
              power,
              capacity
            });
          }
        }
      }

      if (latestData.length < 2) continue; // Need at least 2 reporting plants in group to compare

      // Find max normalized output in group
      const maxNormalized = Math.max(...latestData.map(d => d.normalized));

      // Skip comparison if maximum output is zero or near-zero (e.g. night time)
      if (maxNormalized < 0.05) continue;

      for (const item of latestData) {
        const threshold = 0.95 * maxNormalized;
        
        if (item.normalized < threshold) {
          underperformingPlants.add(item.plant.id);
          const percentLower = Math.round((1 - (item.normalized / maxNormalized)) * 100);

          // Trigger Warning Irregularity Alarm
          const existingIrregularityAlert = activeIssues.find(
            i => i.plant_id === item.plant.id && i.issue_type === 'Irregularity'
          );
          if (!existingIrregularityAlert) {
            console.log(`[Anomaly Detector] Plant ${item.plant.plant_name} triggered IRREGULARITY warning (${percentLower}% lower output).`);
            await prisma.plant_issues.create({
              data: {
                plant_id: item.plant.id,
                issue_type: 'Irregularity',
                severity: 'Warning',
                message: `Generation is ${percentLower}% lower than adjacent stations (±5% deviation exceeded).`,
                status: 'Active',
                started_at: now
              }
            });
          }
        }
      }
    }

    // Resolve Irregularity alerts for plants that are now performing fine
    for (const plant of plants) {
      if (!underperformingPlants.has(plant.id)) {
        const existingIrregularityAlert = activeIssues.find(
          i => i.plant_id === plant.id && i.issue_type === 'Irregularity'
        );
        if (existingIrregularityAlert) {
          console.log(`[Anomaly Detector] Plant ${plant.plant_name} IRREGULARITY warning resolved.`);
          await prisma.plant_issues.update({
            where: { id: existingIrregularityAlert.id },
            data: {
              status: 'Resolved',
              resolved_at: now
            }
          });
        }
      }
    }

    console.log('[Anomaly Detector] Completed checking SCADA anomalies.');
  } catch (error) {
    console.error('[Anomaly Detector] Error running anomaly detector:', error);
  }
}
