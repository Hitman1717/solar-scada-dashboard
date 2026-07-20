// dbService.js - Mock Database Layer stored in LocalStorage
import excelData from './excel_data.json';

const DB_KEY_PREFIX = 'solar_scada_';

const TABLES = {
  COMPANIES: 'companies',
  USERS: 'users',
  PLANTS: 'plants',
  PLANT_USERS: 'plant_users',
  WEBSITE_PROVIDERS: 'website_providers',
  WEBSITE_ACCOUNTS: 'website_accounts',
  TELEMETRY: 'telemetry',
  PLANT_ISSUES: 'plant_issues',
  PLANT_TABLES: 'plant_tables',
  AUDIT_LOGS: 'audit_logs',
};

// Initial Seed Data (Excel data based, Polycab/Solis/Solax providers)
const INITIAL_DATA = {
  [TABLES.COMPANIES]: [
    { id: 1, company_name: 'Microsyslogic', address: '123 Tech Park, Chennai', contact_person: 'Admin Rohit', contact_email: 'admin@msl.com', contact_phone: '+91 98765 43210', status: 'Active', created_at: '2025-01-10T10:00:00Z', updated_at: '2025-01-10T10:00:00Z' },
    { id: 2, company_name: 'Oaksun Energy', address: 'Gaddiannaram Road, Hyderabad', contact_person: 'Omkar Oak', contact_email: 'omkar@oaksun.com', contact_phone: '+91 98765 11111', status: 'Active', created_at: '2025-02-15T11:30:00Z', updated_at: '2025-02-15T11:30:00Z' }
  ],
  [TABLES.USERS]: [
    // company_id: 1 represents Microsyslogic
    { id: 1, company_id: 1, name: 'Rohit Admin', email: 'admin@msl.com', password: 'password', role: 'ADMIN', is_active: true, last_login: '2026-07-06T21:10:00Z', created_at: '2025-01-10T10:05:00Z', updated_at: '2025-01-10T10:05:00Z' },
    { id: 2, company_id: 1, name: 'Manager Ramesh', email: 'mgmt@msl.com', password: 'password', role: 'MANAGEMENT', is_active: true, last_login: '2026-07-06T21:05:00Z', created_at: '2025-01-12T09:15:00Z', updated_at: '2025-01-12T09:15:00Z' },
    // company_id: null represents Super Admin
    { id: 4, company_id: null, name: 'Super Admin', email: 'superadmin@msl.com', password: 'password', role: 'SUPER_ADMIN', is_active: true, last_login: '2026-07-06T20:50:00Z', created_at: '2025-01-01T09:00:00Z', updated_at: '2025-01-01T09:00:00Z' }
  ],
  [TABLES.PLANTS]: [
    { id: 1, company_id: 1, plant_name: 'MY SPACE STUDY HALL 1', plant_capacity: '15.00 kWp', location: 'Gaddiannaram Road_1', latitude: 17.3685, longitude: 78.5316, status: 'Normal', commission_date: '2025-06-01', created_at: '2025-06-01T08:00:00Z', updated_at: '2025-06-01T08:00:00Z' },
    { id: 2, company_id: 1, plant_name: 'MY SPACE STUDY HALL', plant_capacity: '10.00 kWp', location: 'Gaddiannaram Road', latitude: 17.3685, longitude: 78.5316, status: 'Normal', commission_date: '2025-08-12', created_at: '2025-08-12T09:00:00Z', updated_at: '2025-08-12T09:00:00Z' }
  ],
  [TABLES.PLANT_USERS]: [
    { user_id: 1, plant_id: 1 },
    { user_id: 1, plant_id: 2 },
    { user_id: 2, plant_id: 1 },
    { user_id: 2, plant_id: 2 }
  ],
  [TABLES.WEBSITE_PROVIDERS]: [
    { id: 1, provider_name: 'Polycab', login_url: 'https://polycab.com', description: 'Polycab monitoring API' },
    { id: 2, provider_name: 'Solis', login_url: 'https://solisinverters.com', description: 'Solis Cloud API portal' },
    { id: 3, provider_name: 'Solax', login_url: 'https://solaxcloud.com', description: 'Solax portal scraper' }
  ],
  [TABLES.WEBSITE_ACCOUNTS]: [
    { id: 1, plant_id: 1, provider_id: 1, username: 'omkar.oak', password: 'password123', scrape_interval_minutes: 5, enabled: true, last_scraped_at: '2026-07-06T21:10:00Z', created_at: '2025-06-02T10:00:00Z', updated_at: '2026-07-06T21:10:00Z' },
    { id: 2, plant_id: 2, provider_id: 2, username: 'omkar.oak', password: 'password123', scrape_interval_minutes: 10, enabled: true, last_scraped_at: '2026-07-06T21:00:00Z', created_at: '2025-08-13T11:00:00Z', updated_at: '2026-07-06T21:00:00Z' }
  ],
  [TABLES.PLANT_TABLES]: [
    { id: 1, plant_id: 1, table_number: 'T-01', panels_count: 10, panel_model: 'Oaksun-100W', inverter_model: 'Oaksun Inv 1', gateway_id: 'GW-01', mac_address: '00:1A:2B:3C:4D:5E', degrade_pct: 1, age_years: 0.5, power_w: 3870 },
    { id: 2, plant_id: 1, table_number: 'T-02', panels_count: 15, panel_model: 'Oaksun-100W', inverter_model: 'Oaksun Inv 1', gateway_id: 'GW-01', mac_address: '00:1A:2B:3C:4D:5F', degrade_pct: 2, age_years: 0.5, power_w: 5820 },
    { id: 3, plant_id: 1, table_number: 'T-03', panels_count: 15, panel_model: 'Oaksun-100W', inverter_model: 'Oaksun Inv 2', gateway_id: 'GW-02', mac_address: '00:1A:2B:3C:4D:60', degrade_pct: 1, age_years: 0.5, power_w: 8950 }
  ],
  [TABLES.TELEMETRY]: [], // Will seed past 24 hours dynamically
  [TABLES.PLANT_ISSUES]: [
    { id: 1, plant_id: 1, telemetry_id: null, issue_type: 'Low Generation', severity: 'Moderate', message: 'String T-01 output is 5% below expected capacity.', status: 'Active', started_at: '2026-07-06T10:00:00Z', resolved_at: null, created_at: '2026-07-06T10:00:00Z' }
  ],
  [TABLES.AUDIT_LOGS]: [
    { id: 1, user_id: 4, action: 'Created Company', entity_type: 'Company', entity_id: 2, created_at: '2025-02-15T11:30:00Z' },
    { id: 2, user_id: 1, action: 'Updated Website Password', entity_type: 'WebsiteAccount', entity_id: 1, created_at: '2026-07-06T09:00:00Z' }
  ]
};

// Generates historical telemetry data for chart visualizations
function generateTelemetrySeed() {
  const telemetry = [];
  const start = new Date('2026-07-05T00:00:00Z');
  const end = new Date('2026-07-06T21:00:00Z');
  let id = 1;

  for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
    const hour = d.getHours();
    
    // Solar generation profile (bell curve peak at 13:00)
    let solarMultiplier = 0;
    if (hour >= 6 && hour <= 18) {
      solarMultiplier = Math.sin((hour - 6) * Math.PI / 12);
    }
    
    // Random variations
    const randomVariation = () => (0.95 + Math.random() * 0.1);

    // Seed Plant 1: MY SPACE STUDY HALL 1 (Capacity 15kWp)
    if (solarMultiplier > 0) {
      const pvPower = 15.00 * solarMultiplier * randomVariation();
      const dailyGen = 31.30 * solarMultiplier; 
      const batVolt = 13.1 + (18.2 * solarMultiplier * randomVariation());

      telemetry.push({
        id: id++,
        plant_id: 1,
        timestamp: d.toISOString(),
        pv_power: parseFloat(pvPower.toFixed(2)),
        power: parseFloat(pvPower.toFixed(2)),
        voltage: parseFloat((230 + Math.sin(hour) * 5 * randomVariation()).toFixed(1)),
        current: parseFloat((pvPower * 1000 / 230).toFixed(2)),
        frequency: parseFloat((50.0 + Math.random() * 0.05).toFixed(2)),
        daily_generation: parseFloat(dailyGen.toFixed(2)),
        total_generation: parseFloat((2840 + dailyGen).toFixed(2)),
        temperature: parseFloat((27 + solarMultiplier * 10 + Math.random() * 2).toFixed(1)),
        status: 'Normal',
        plant_type: 'Residential',
        grid_status: 'On-grid',
        battery_voltage: parseFloat(batVolt.toFixed(1)),
        daily_charge: 0.00,
        daily_discharge: 0.00,
        daily_consumed: parseFloat((dailyGen * 0.95).toFixed(2)),
        imported_energy: 0.00
      });
    }

    // Seed Plant 2: MY SPACE STUDY HALL (Capacity 10kWp)
    if (solarMultiplier > 0) {
      const pvPower = 10.00 * solarMultiplier * randomVariation();
      const dailyGen = 20.50 * solarMultiplier;
      const batVolt = 12.0 + (12.3 * solarMultiplier * randomVariation());
      
      telemetry.push({
        id: id++,
        plant_id: 2,
        timestamp: d.toISOString(),
        pv_power: parseFloat(pvPower.toFixed(2)),
        power: parseFloat(pvPower.toFixed(2)),
        voltage: parseFloat((228 + Math.cos(hour) * 4 * randomVariation()).toFixed(1)),
        current: parseFloat((pvPower * 1000 / 228).toFixed(2)),
        frequency: parseFloat((50.0 + Math.random() * 0.04).toFixed(2)),
        daily_generation: parseFloat(dailyGen.toFixed(2)),
        total_generation: parseFloat((1450 + dailyGen).toFixed(2)),
        temperature: parseFloat((26 + solarMultiplier * 8 + Math.random() * 1.5).toFixed(1)),
        status: 'Normal',
        plant_type: 'Residential',
        grid_status: 'On-grid',
        battery_voltage: parseFloat(batVolt.toFixed(1)),
        daily_charge: 0.00,
        daily_discharge: 0.00,
        daily_consumed: parseFloat((dailyGen * 0.9).toFixed(2)),
        imported_energy: 0.00
      });
    }
  }
  return telemetry;
}

// Write to LocalStorage
function writeTable(tableName, data) {
  localStorage.setItem(DB_KEY_PREFIX + tableName, JSON.stringify(data));
}

// Read from LocalStorage
function readTable(tableName) {
  const val = localStorage.getItem(DB_KEY_PREFIX + tableName);
  return val ? JSON.parse(val) : null;
}

// Initialize Database if not already present or if Excel data changed
export function initializeDB() {
  const localTelemetry = readTable(TABLES.TELEMETRY) || [];
  const localPlants = readTable(TABLES.PLANTS) || [];
  const excelTelemetry = excelData.telemetry || [];
  const excelPlants = excelData.plants || [];

  const needsReinit = localTelemetry.length !== excelTelemetry.length || 
                      localPlants.length !== excelPlants.length ||
                      !localStorage.getItem(DB_KEY_PREFIX + 'initialized_excel_v1');

  if (needsReinit) {
    // Clear to reload fresh
    localStorage.clear();

    // Seed base tables
    Object.keys(INITIAL_DATA).forEach(table => {
      if (table !== TABLES.PLANTS && table !== TABLES.TELEMETRY && table !== TABLES.PLANT_USERS && table !== TABLES.WEBSITE_ACCOUNTS) {
        writeTable(table, INITIAL_DATA[table]);
      }
    });

    // Seed Plants from Excel
    writeTable(TABLES.PLANTS, excelPlants);

    // Seed Telemetry from Excel
    writeTable(TABLES.TELEMETRY, excelTelemetry);

    // Dynamic Plant-User mapping
    const plantUsers = [];
    excelPlants.forEach(p => {
      plantUsers.push({ user_id: 1, plant_id: p.id }); // Admin
      plantUsers.push({ user_id: 2, plant_id: p.id }); // Management
    });
    writeTable(TABLES.PLANT_USERS, plantUsers);

    // Dynamic Website Accounts mapping
    const websiteAccounts = [];
    excelPlants.forEach(p => {
      let providerId = 1;
      if (p.id >= 5) {
        providerId = 2; // Solis
      } else if (p.id === 3 || p.id === 4) {
        providerId = 3; // Solax
      }
      
      websiteAccounts.push({
        id: p.id,
        plant_id: p.id,
        provider_id: providerId,
        username: `plant.${p.id}.user`,
        password: 'password123',
        scrape_interval_minutes: 5,
        enabled: true,
        last_scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
    writeTable(TABLES.WEBSITE_ACCOUNTS, websiteAccounts);

    localStorage.setItem(DB_KEY_PREFIX + 'initialized_excel_v1', 'true');
    console.log("Successfully initialized database with Excel data.");
  }
}

// DB Operations wrapper
export const db = {
  getAll: (tableName) => {
    initializeDB();
    return readTable(tableName) || [];
  },

  getById: (tableName, id) => {
    const list = db.getAll(tableName);
    return list.find(item => item.id === Number(id) || item.id === id);
  },

  insert: (tableName, item) => {
    const list = db.getAll(tableName);
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
    const newItem = { 
      id: newId, 
      ...item, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    };
    list.push(newItem);
    writeTable(tableName, list);
    return newItem;
  },

  update: (tableName, id, updates) => {
    const list = db.getAll(tableName);
    const index = list.findIndex(item => item.id === Number(id) || item.id === id);
    if (index !== -1) {
      list[index] = { 
        ...list[index], 
        ...updates, 
        updated_at: new Date().toISOString() 
      };
      writeTable(tableName, list);
      return list[index];
    }
    return null;
  },

  delete: (tableName, id) => {
    const list = db.getAll(tableName);
    const filtered = list.filter(item => item.id !== Number(id) && item.id !== id);
    writeTable(tableName, filtered);
    return true;
  },

  getPlantsForUser: (userId, role) => {
    const plants = db.getAll(TABLES.PLANTS);
    if (role === 'SUPER_ADMIN') {
      return plants;
    }
    const mappings = db.getAll(TABLES.PLANT_USERS);
    const assignedIds = mappings
      .filter(m => m.user_id === Number(userId))
      .map(m => m.plant_id);
    return plants.filter(p => assignedIds.includes(p.id));
  },

  assignPlantToUser: (userId, plantId) => {
    const mappings = db.getAll(TABLES.PLANT_USERS);
    const exists = mappings.some(m => m.user_id === Number(userId) && m.plant_id === Number(plantId));
    if (!exists) {
      mappings.push({ user_id: Number(userId), plant_id: Number(plantId) });
      writeTable(TABLES.PLANT_USERS, mappings);
    }
  },

  removePlantFromUser: (userId, plantId) => {
    const mappings = db.getAll(TABLES.PLANT_USERS);
    const filtered = mappings.filter(m => !(m.user_id === Number(userId) && m.plant_id === Number(plantId)));
    writeTable(TABLES.PLANT_USERS, filtered);
  },

  getTelemetryForPlant: (plantId, limit = 24) => {
    const telemetry = db.getAll(TABLES.TELEMETRY);
    return telemetry
      .filter(t => t.plant_id === Number(plantId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .reverse();
  },

  logAudit: (userId, action, entityType, entityId) => {
    db.insert(TABLES.AUDIT_LOGS, {
      user_id: userId ? Number(userId) : null,
      action,
      entity_type: entityType,
      entity_id: entityId
    });
  },

  TABLES
};
