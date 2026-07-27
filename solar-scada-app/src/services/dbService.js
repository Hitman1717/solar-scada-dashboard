// dbService.js - Database Service with JWT Authentication & Backend Persistence
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
  COMPANY_VARIABLES: 'company_variables'
};

// Local in-memory cache
let cache = {
  [TABLES.COMPANIES]: [],
  [TABLES.USERS]: [],
  [TABLES.PLANTS]: [],
  [TABLES.PLANT_USERS]: [],
  [TABLES.WEBSITE_PROVIDERS]: [],
  [TABLES.WEBSITE_ACCOUNTS]: [],
  [TABLES.PLANT_TABLES]: [],
  [TABLES.TELEMETRY]: [],
  [TABLES.PLANT_ISSUES]: [],
  [TABLES.AUDIT_LOGS]: [],
  [TABLES.COMPANY_VARIABLES]: []
};

// Initial Seed Data (Excel data based, Polycab/Solis/Solax providers)
const INITIAL_DATA = {
  [TABLES.COMPANIES]: [
    { id: 1, company_name: 'msl', address: '123 Tech Park, Chennai', contact_person: 'Super Admin', contact_email: 'superadmin@msl.com', contact_phone: '+91 98765 43210', status: 'Active', created_at: '2025-01-10T10:00:00Z', updated_at: '2025-01-10T10:00:00Z' },
    { id: 2, company_name: 'test', address: 'Gaddiannaram Road, Hyderabad', contact_person: 'Test Admin', contact_email: 'admin@test.com', contact_phone: '+91 98765 11111', status: 'Active', created_at: '2025-02-15T11:30:00Z', updated_at: '2025-02-15T11:30:00Z' }
  ],
  [TABLES.USERS]: [
    { id: 1, company_id: 2, name: 'Test Admin', email: 'admin@test.com', password: 'password', role: 'ADMIN', is_active: true, last_login: '2026-07-06T21:10:00Z', created_at: '2025-01-10T10:05:00Z', updated_at: '2025-01-10T10:05:00Z' },
    { id: 2, company_id: 2, name: 'Test Management', email: 'mgmt@test.com', password: 'password', role: 'MANAGEMENT', is_active: true, last_login: '2026-07-06T21:05:00Z', created_at: '2025-01-12T09:15:00Z', updated_at: '2025-01-12T09:15:00Z' },
    { id: 4, company_id: 1, name: 'Super Admin', email: 'superadmin@msl.com', password: 'password', role: 'SUPER_ADMIN', is_active: true, last_login: '2026-07-06T20:50:00Z', created_at: '2025-01-01T09:00:00Z', updated_at: '2025-01-01T09:00:00Z' }
  ],
  [TABLES.PLANTS]: [],
  [TABLES.PLANT_USERS]: [],
  [TABLES.WEBSITE_PROVIDERS]: [
    { id: 1, provider_name: 'Polycab', login_url: 'https://polycab.com', description: 'Polycab monitoring API' },
    { id: 2, provider_name: 'Solis', login_url: 'https://solisinverters.com', description: 'Solis Cloud API portal' },
    { id: 3, provider_name: 'Solax', login_url: 'https://solaxcloud.com', description: 'Solax portal scraper' }
  ],
  [TABLES.WEBSITE_ACCOUNTS]: [],
  [TABLES.PLANT_TABLES]: [
    { id: 1, plant_id: 1, table_number: 'T-01', panels_count: 10, panel_model: 'Oaksun-100W', inverter_model: 'Oaksun Inv 1', gateway_id: 'GW-01', mac_address: '00:1A:2B:3C:4D:5E', degrade_pct: 1, age_years: 0.5, power_w: 3870 },
    { id: 2, plant_id: 1, table_number: 'T-02', panels_count: 15, panel_model: 'Oaksun-100W', inverter_model: 'Oaksun Inv 1', gateway_id: 'GW-01', mac_address: '00:1A:2B:3C:4D:5F', degrade_pct: 2, age_years: 0.5, power_w: 5820 },
    { id: 3, plant_id: 1, table_number: 'T-03', panels_count: 15, panel_model: 'Oaksun-100W', inverter_model: 'Oaksun Inv 2', gateway_id: 'GW-02', mac_address: '00:1A:2B:3C:4D:60', degrade_pct: 1, age_years: 0.5, power_w: 8950 }
  ],
  [TABLES.TELEMETRY]: [],
  [TABLES.PLANT_ISSUES]: [
    { id: 1, plant_id: 1, telemetry_id: null, issue_type: 'Low Generation', severity: 'Moderate', message: 'String T-01 output is 5% below expected capacity.', status: 'Active', started_at: '2026-07-06T10:00:00Z', resolved_at: null, created_at: '2026-07-06T10:00:00Z' }
  ],
  [TABLES.AUDIT_LOGS]: [
    { id: 1, user_id: 4, action: 'Created Company', entity_type: 'Company', entity_id: 2, created_at: '2025-02-15T11:30:00Z' },
    { id: 2, user_id: 1, action: 'Updated Website Password', entity_type: 'WebsiteAccount', entity_id: 1, created_at: '2026-07-06T09:00:00Z' }
  ],
  [TABLES.COMPANY_VARIABLES]: []
};

let isUsingBackend = false;
let authToken = null;

// Load initial token from localStorage if present
try {
  const saved = localStorage.getItem('solar_scada_session');
  if (saved) {
    const session = JSON.parse(saved);
    if (session && session.token) {
      authToken = session.token;
    }
  }
} catch (e) {
  // Ignore
}

// Fallback to LocalStorage if backend fails
function readTable(tableName) {
  const val = localStorage.getItem(DB_KEY_PREFIX + tableName);
  return val ? JSON.parse(val) : null;
}

function writeTable(tableName, data) {
  localStorage.setItem(DB_KEY_PREFIX + tableName, JSON.stringify(data));
}

// Fetch helper that automatically injects secure token
function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return fetch(url, {
    ...options,
    headers
  });
}

function loadLocalStorageFallback() {
  const localTelemetry = readTable(TABLES.TELEMETRY) || [];
  const localPlants = readTable(TABLES.PLANTS) || [];
  const excelTelemetry = excelData.telemetry || [];
  const excelPlants = excelData.plants || [];

  const needsReinit = localTelemetry.length !== excelTelemetry.length || 
                      localPlants.length !== excelPlants.length ||
                      !localStorage.getItem(DB_KEY_PREFIX + 'initialized_excel_v3'); // Increment version to force re-init

  if (needsReinit) {
    localStorage.clear();

    Object.keys(INITIAL_DATA).forEach(table => {
      if (table !== TABLES.PLANTS && table !== TABLES.TELEMETRY && table !== TABLES.PLANT_USERS && table !== TABLES.WEBSITE_ACCOUNTS) {
        writeTable(table, INITIAL_DATA[table]);
      }
    });

    // Make all seeded plants belong to company ID 2 ('test') and distribute statuses matching the dashboard breakdown
    const mappedPlants = excelPlants.map((p, index) => {
      let status = 'Normal';
      if (index % 4 === 1) status = 'Offline';
      else if (index % 4 === 2) status = 'Under Maintenance';
      else if (index % 4 === 3) status = 'Decommissioned';
      return { ...p, company_id: 2, status };
    });
    writeTable(TABLES.PLANTS, mappedPlants);

    // Adjust telemetry timestamps from 2026-07-16/17 to 2026-07-26/27 (+10 days)
    const adjustedTelemetry = excelTelemetry.map(t => {
      const origDate = new Date(t.timestamp);
      const newDate = new Date(origDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      return {
        ...t,
        timestamp: newDate.toISOString().replace('T', ' ').substring(0, 19)
      };
    });
    writeTable(TABLES.TELEMETRY, adjustedTelemetry);

    const plantUsers = [];
    excelPlants.forEach(p => {
      plantUsers.push({ user_id: 1, plant_id: p.id });
      plantUsers.push({ user_id: 2, plant_id: p.id });
    });
    writeTable(TABLES.PLANT_USERS, plantUsers);

    const websiteAccounts = [];
    excelPlants.forEach(p => {
      let providerId = 2; // Solis default for id >= 5
      if (p.id === 1 || p.id === 2) {
        providerId = 3; // Solax (interchanged)
      } else if (p.id === 3 || p.id === 4) {
        providerId = 1; // Polycab (interchanged)
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

    localStorage.setItem(DB_KEY_PREFIX + 'initialized_excel_v3', 'true');
  }

  // Load from local storage into cache
  Object.keys(cache).forEach(table => {
    cache[table] = readTable(table) || INITIAL_DATA[table] || [];
  });
  
  if (cache[TABLES.PLANTS].length === 0) {
    cache[TABLES.PLANTS] = excelPlants.map((p, index) => {
      let status = 'Normal';
      if (index % 4 === 1) status = 'Offline';
      else if (index % 4 === 2) status = 'Under Maintenance';
      else if (index % 4 === 3) status = 'Decommissioned';
      return { ...p, company_id: 2, status };
    });
  }
  if (cache[TABLES.TELEMETRY].length === 0) {
    const adjustedTelemetry = excelTelemetry.map(t => {
      const origDate = new Date(t.timestamp);
      const newDate = new Date(origDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      return {
        ...t,
        timestamp: newDate.toISOString().replace('T', ' ').substring(0, 19)
      };
    });
    cache[TABLES.TELEMETRY] = adjustedTelemetry;
  }
}

// Initialize Database in Offline/Demo Mode Unconditionally
export async function initializeDB() {
  console.log('Starting in offline/demo mode (Unconditional).');
  loadLocalStorageFallback();
  return false;
}

export const db = {
  getAll: (tableName) => {
    return cache[tableName] || [];
  },

  getById: (tableName, id) => {
    const list = db.getAll(tableName);
    return list.find(item => item.id === Number(id) || item.id === id);
  },

  insert: (tableName, item) => {
    const list = cache[tableName] || [];
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
    const newItem = { 
      id: newId, 
      ...item, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    };
    list.push(newItem);

    if (isUsingBackend) {
      fetchWithAuth('http://localhost:5000/api/db/insert', {
        method: 'POST',
        body: JSON.stringify({ table: tableName, item: newItem })
      }).catch(err => console.error(`Failed to sync insert for ${tableName}:`, err));
    } else {
      writeTable(tableName, list);
    }
    return newItem;
  },

  update: (tableName, id, updates) => {
    const list = cache[tableName] || [];
    const index = list.findIndex(item => item.id === Number(id) || item.id === id);
    if (index !== -1) {
      list[index] = { 
        ...list[index], 
        ...updates, 
        updated_at: new Date().toISOString() 
      };
      
      if (isUsingBackend) {
        fetchWithAuth('http://localhost:5000/api/db/update', {
          method: 'POST',
          body: JSON.stringify({ table: tableName, id, updates })
        }).catch(err => console.error(`Failed to sync update for ${tableName}:`, err));
      } else {
        writeTable(tableName, list);
      }
      return list[index];
    }
    return null;
  },

  delete: (tableName, id) => {
    cache[tableName] = (cache[tableName] || []).filter(item => item.id !== Number(id) && item.id !== id);
    
    if (isUsingBackend) {
      fetchWithAuth('http://localhost:5000/api/db/delete', {
        method: 'POST',
        body: JSON.stringify({ table: tableName, id })
      }).catch(err => console.error(`Failed to sync delete for ${tableName}:`, err));
    } else {
      writeTable(tableName, cache[tableName]);
    }
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
    const mappings = cache[TABLES.PLANT_USERS] || [];
    const exists = mappings.some(m => m.user_id === Number(userId) && m.plant_id === Number(plantId));
    if (!exists) {
      mappings.push({ user_id: Number(userId), plant_id: Number(plantId) });
      cache[TABLES.PLANT_USERS] = mappings;

      if (isUsingBackend) {
        fetchWithAuth('http://localhost:5000/api/db/assign-plant', {
          method: 'POST',
          body: JSON.stringify({ user_id: Number(userId), plant_id: Number(plantId) })
        }).catch(err => console.error('Failed to sync assign-plant:', err));
      } else {
        writeTable(TABLES.PLANT_USERS, mappings);
      }
    }
  },

  removePlantFromUser: (userId, plantId) => {
    const mappings = cache[TABLES.PLANT_USERS] || [];
    const filtered = mappings.filter(m => !(m.user_id === Number(userId) && m.plant_id === Number(plantId)));
    cache[TABLES.PLANT_USERS] = filtered;

    if (isUsingBackend) {
      fetchWithAuth('http://localhost:5000/api/db/remove-plant', {
        method: 'POST',
        body: JSON.stringify({ user_id: Number(userId), plant_id: Number(plantId) })
      }).catch(err => console.error('Failed to sync remove-plant:', err));
    } else {
      writeTable(TABLES.PLANT_USERS, filtered);
    }
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

  // Secure Authentication API Operations (Offline/Demo Mode)
  login: async (companyName, email, password, role) => {
    loadLocalStorageFallback();
    const users = cache[TABLES.USERS];
    const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.role === role);
    if (matched) {
      const companyObj = db.getById(TABLES.COMPANIES, matched.company_id);
      if (companyObj && companyObj.company_name.toLowerCase() === companyName.toLowerCase()) {
        isUsingBackend = false;
        return { success: true, token: 'mock-local-token', user: matched };
      } else {
        return { success: false, error: `Company mismatch. User belongs to '${companyObj ? companyObj.company_name : 'no company'}'.` };
      }
    }
    return { success: false, error: 'Invalid credentials.' };
  },

  bypassLogin: async (email, role) => {
    loadLocalStorageFallback();
    let matched = null;
    if (email) {
      matched = cache[TABLES.USERS].find(u => u.email.toLowerCase() === email.toLowerCase());
    } else if (role) {
      matched = cache[TABLES.USERS].find(u => u.role === role);
    }
    if (matched) {
      isUsingBackend = false;
      return { success: true, token: 'mock-local-token', user: matched };
    }
    return { success: false, error: 'Bypass user not found.' };
  },

  setToken: (token) => {
    authToken = token;
    isUsingBackend = !!token && token !== 'mock-local-token';
  },

  // Dynamic Variable Operations
  getVariables: async (companyId, plantId) => {
    if (isUsingBackend) {
      try {
        let url = 'http://localhost:5000/api/variables';
        const params = new URLSearchParams();
        if (companyId) params.append('company_id', companyId);
        if (plantId) params.append('plant_id', plantId);
        if (companyId || plantId) {
          url += `?${params.toString()}`;
        }
        const response = await fetchWithAuth(url);
        const result = await response.json();
        return result.success ? result.data : [];
      } catch (err) {
        console.error('Failed to fetch variables from backend:', err);
      }
    }
    let vars = cache[TABLES.COMPANY_VARIABLES] || [];
    if (companyId) vars = vars.filter(v => v.company_id === Number(companyId));
    if (plantId) vars = vars.filter(v => v.plant_id === Number(plantId));
    return vars;
  },

  saveVariable: async (variable) => {
    if (isUsingBackend) {
      try {
        const response = await fetchWithAuth('http://localhost:5000/api/variables', {
          method: 'POST',
          body: JSON.stringify(variable)
        });
        const result = await response.json();
        if (result.success) {
          cache[TABLES.COMPANY_VARIABLES].unshift(result.data);
          return result.data;
        }
      } catch (err) {
        console.error('Failed to save variable to backend:', err);
      }
    }
    const list = cache[TABLES.COMPANY_VARIABLES] || [];
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
    const newVar = {
      id: newId,
      ...variable,
      timestamp: variable.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    list.unshift(newVar);
    writeTable(TABLES.COMPANY_VARIABLES, list);
    return newVar;
  },

  onboardScraperAccount: async (providerId, username, password, scrapeIntervalMinutes) => {
    if (isUsingBackend) {
      try {
        const response = await fetchWithAuth('http://localhost:5000/api/scrape/onboard', {
          method: 'POST',
          body: JSON.stringify({ providerId, username, password, scrapeIntervalMinutes })
        });
        const result = await response.json();
        
        // Fetch fresh database snapshot to reload new plants in the client cache
        if (result.success) {
          const freshDbResponse = await fetchWithAuth('http://localhost:5000/api/db');
          const freshDbResult = await freshDbResponse.json();
          if (freshDbResult.success && freshDbResult.data) {
            cache = freshDbResult.data;
          }
        }
        return result;
      } catch (err) {
        console.error('Failed to trigger onboarding scrape:', err);
        return { success: false, error: err.message };
      }
    } else {
      // Mock onboarding fallback
      const excelPlants = excelData.plants || [];
      const newPlants = excelPlants.filter(ep => {
        const existing = cache[TABLES.PLANTS].find(p => p.plant_name === ep.plant_name);
        return !existing;
      });

      newPlants.forEach(np => {
        cache[TABLES.PLANTS].push({ ...np, company_id: 2 });
      });
      writeTable(TABLES.PLANTS, cache[TABLES.PLANTS]);

      return { success: true, message: `Successfully simulated onboarding of ${newPlants.length} plants offline.` };
    }
  },

  triggerScrape: async (plantId) => {
    if (isUsingBackend) {
      try {
        const response = await fetchWithAuth(`http://localhost:5000/api/scrape/${plantId}`, {
          method: 'POST'
        });
        const result = await response.json();
        if (result.success) {
          await initializeDB();
        }
        return result;
      } catch (err) {
        console.error('Failed to trigger backend scraper:', err);
        return { success: false, error: 'Scraper server is offline.' };
      }
    }
    return { success: true, message: 'Local storage mock mode. Telemetry updated.' };
  },

  TABLES
};
