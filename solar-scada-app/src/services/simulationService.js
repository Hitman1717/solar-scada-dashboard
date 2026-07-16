// simulationService.js - Simulates real-time solar SCADA telemetry (Residential / Excel aligned)

import { db } from './dbService';

export function runSimulationTick(plantId) {
  const plants = db.getAll(db.TABLES.PLANTS);
  const targetPlant = plants.find(p => p.id === Number(plantId));
  if (!targetPlant) return;

  const telemetry = db.getAll(db.TABLES.TELEMETRY);
  const plantTelemetry = telemetry.filter(t => t.plant_id === Number(plantId));

  // Get latest telemetry point to base new values on
  let lastPoint = plantTelemetry.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  const now = new Date();
  const hour = now.getHours();

  // Solar multiplier based on time of day (bell curve)
  let solarMultiplier = 0;
  if (hour >= 6 && hour <= 18) {
    solarMultiplier = Math.sin((hour - 6) * Math.PI / 12);
  }

  // Calculate capacities and targets (Residential kW)
  const capacityKW = parseFloat(targetPlant.plant_capacity);
  const randomFactor = 0.95 + Math.random() * 0.1;

  // Base calculations
  let pvPower = 0;
  let voltage = 230.0;
  let current = 0;
  let frequency = 50.0;
  let temperature = 25.0;
  let batteryVoltage = 12.0;

  if (solarMultiplier > 0) {
    pvPower = capacityKW * solarMultiplier * randomFactor;
    voltage = 226 + Math.sin(hour) * 6 * (0.98 + Math.random() * 0.04);
    current = (pvPower * 1000) / voltage;
    frequency = 50.0 + (Math.random() - 0.5) * 0.08;
    temperature = 28 + solarMultiplier * 8 + (Math.random() - 0.5) * 2;
    batteryVoltage = 13.1 + (18.2 * solarMultiplier * (0.95 + Math.random() * 0.1));
  } else {
    // Night time
    pvPower = 0;
    voltage = 228 + (Math.random() - 0.5) * 3;
    current = 0;
    frequency = 50.0 + (Math.random() - 0.5) * 0.05;
    temperature = 20.0 + (Math.random() - 0.5) * 1.5;
    batteryVoltage = 13.5 + (Math.random() - 0.5) * 0.5; // slow discharge
  }

  // Factor in active issues affecting power loss
  const activeIssues = db.getAll(db.TABLES.PLANT_ISSUES).filter(i => i.plant_id === Number(plantId) && i.status === 'Active');
  let powerLossKW = 0;
  activeIssues.forEach(issue => {
    if (issue.severity === 'Critical') {
      powerLossKW += 5.0 + Math.random() * 2.0;
    } else {
      powerLossKW += 1.0 + Math.random() * 0.5;
    }
  });

  pvPower = Math.max(0, pvPower - powerLossKW);
  if (pvPower === 0) {
    current = 0;
  }

  // Yield calculations
  let dailyGen = lastPoint ? lastPoint.daily_generation : 0;
  let totalGen = lastPoint ? lastPoint.total_generation : 1500;

  if (solarMultiplier > 0) {
    const powerGenPerMinute = pvPower * (5 / 60); // Assuming 5 min step
    dailyGen += powerGenPerMinute;
    totalGen += powerGenPerMinute;
  } else {
    // Reset daily yield at midnight
    if (now.getHours() === 0 && now.getMinutes() < 10) {
      dailyGen = 0;
    }
  }

  // Create new telemetry row
  const newTelemetry = db.insert(db.TABLES.TELEMETRY, {
    plant_id: Number(plantId),
    timestamp: now.toISOString(),
    pv_power: parseFloat(pvPower.toFixed(2)),
    power: parseFloat(pvPower.toFixed(2)),
    voltage: parseFloat(voltage.toFixed(1)),
    current: parseFloat(current.toFixed(2)),
    frequency: parseFloat(frequency.toFixed(2)),
    daily_generation: parseFloat(dailyGen.toFixed(2)),
    total_generation: parseFloat(totalGen.toFixed(2)),
    temperature: parseFloat(temperature.toFixed(1)),
    status: 'Normal',
    plant_type: 'Residential',
    grid_status: 'On-grid',
    battery_voltage: parseFloat(batteryVoltage.toFixed(1)),
    daily_charge: 0.00,
    daily_discharge: 0.00,
    daily_consumed: parseFloat((dailyGen * 0.95).toFixed(2)),
    imported_energy: 0.00
  });

  // Update last scraped time on website account
  const accounts = db.getAll(db.TABLES.WEBSITE_ACCOUNTS);
  const account = accounts.find(a => a.plant_id === Number(plantId));
  if (account) {
    db.update(db.TABLES.WEBSITE_ACCOUNTS, account.id, {
      last_scraped_at: now.toISOString()
    });
  }

  // Check if we should dynamically trigger a random alarm
  if (Math.random() < 0.05 && activeIssues.length < 3) {
    triggerRandomIncident(plantId);
  }

  updateTablesStatus(plantId);

  return newTelemetry;
}

function triggerRandomIncident(plantId) {
  const tables = db.getAll(db.TABLES.PLANT_TABLES).filter(t => t.plant_id === Number(plantId));
  if (tables.length === 0) return;

  const randomTable = tables[Math.floor(Math.random() * tables.length)];
  const isCritical = Math.random() < 0.2;
  
  const issueTypes = isCritical 
    ? ['Grid Failure', 'Inverter Fault']
    : ['High Temperature', 'Low Generation'];
  
  const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
  const message = isCritical 
    ? `Critical fault ${issueType} detected on string table ${randomTable.table_number}.`
    : `Warning: ${issueType} anomaly reported on string table ${randomTable.table_number}.`;

  db.insert(db.TABLES.PLANT_ISSUES, {
    plant_id: Number(plantId),
    telemetry_id: null,
    issue_type: issueType,
    severity: isCritical ? 'Critical' : 'Moderate',
    message: message,
    status: 'Active',
    started_at: new Date().toISOString(),
    resolved_at: null
  });

  db.logAudit(null, `System raised incident ${issueType} for Table ${randomTable.table_number}`, 'PlantIssue', null);
}

function updateTablesStatus(plantId) {
  const tables = db.getAll(db.TABLES.PLANT_TABLES).filter(t => t.plant_id === Number(plantId));
  const activeIssues = db.getAll(db.TABLES.PLANT_ISSUES).filter(i => i.plant_id === Number(plantId) && i.status === 'Active');

  tables.forEach(table => {
    const tableIssues = activeIssues.filter(i => i.message.includes(table.table_number));
    let degradePct = 1;
    let powerW = 5800;

    if (tableIssues.length > 0) {
      const criticalIssue = tableIssues.find(i => i.severity === 'Critical');
      if (criticalIssue) {
        degradePct = 30;
        powerW = 2200;
      } else {
        degradePct = 10;
        powerW = 4900;
      }
    }

    db.update(db.TABLES.PLANT_TABLES, table.id, {
      degrade_pct: degradePct,
      power_w: powerW
    });
  });
}
