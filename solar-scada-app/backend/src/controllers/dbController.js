import prisma from '../config/prisma.js';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const ALLOWED_TABLES = [
  'companies',
  'users',
  'plants',
  'plant_users',
  'website_providers',
  'website_accounts',
  'plant_tables',
  'telemetry',
  'plant_issues',
  'audit_logs',
  'company_variables'
];

function validateTable(table) {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Unauthorized or invalid table name: ${table}`);
  }
}

// Helper to recursively convert Prisma.Decimal and Date objects for JSON serialization
function serializePrisma(data) {
  if (data === null || data === undefined) return data;
  if (data instanceof Prisma.Decimal) return parseFloat(data.toString());
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(serializePrisma);
  if (typeof data === 'object') {
    const obj = {};
    for (const key of Object.keys(data)) {
      obj[key] = serializePrisma(data[key]);
    }
    return obj;
  }
  return data;
}

export const dbController = {
  // Dumps all tables for frontend initialization
  getDatabase: async (req, res) => {
    try {
      const data = {};
      
      // Multi-tenant access control setup
      let allowedPlantIds = null;
      let userCompanyId = req.user?.company_id ? Number(req.user.company_id) : null;
      
      if (req.user?.role !== 'SUPER_ADMIN') {
        const userPlantUsers = await prisma.plant_users.findMany({
          where: { user_id: Number(req.user.id) }
        });
        allowedPlantIds = userPlantUsers.map(pu => pu.plant_id);
      }

      // Fetch each allowed table
      for (const table of ALLOWED_TABLES) {
        const hasIdColumn = !['plant_users'].includes(table);
        const orderBy = table === 'telemetry' ? { timestamp: 'desc' } :
                        table === 'audit_logs' ? { created_at: 'desc' } :
                        table === 'plant_users' ? [{ user_id: 'asc' }, { plant_id: 'asc' }] :
                        (hasIdColumn ? { id: 'asc' } : undefined);

        const where = {};
        
        if (allowedPlantIds !== null) {
          // Limit standard user access to their assigned plants
          if (['plants', 'plant_users', 'website_accounts', 'plant_tables', 'telemetry', 'plant_issues', 'company_variables'].includes(table)) {
            where.plant_id = { in: allowedPlantIds };
            if (table === 'plants') {
              // 'plants' table primary key is 'id', not 'plant_id'
              delete where.plant_id;
              where.id = { in: allowedPlantIds };
            }
          } else if (table === 'companies') {
            if (userCompanyId !== null) {
              where.id = userCompanyId;
            } else {
              where.id = -1; // No company access
            }
          } else if (table === 'users') {
            if (userCompanyId !== null) {
              where.company_id = userCompanyId;
            } else {
              where.id = Number(req.user.id); // Only see self
            }
          } else if (table === 'audit_logs') {
            if (userCompanyId !== null) {
              const companyUsers = await prisma.users.findMany({
                where: { company_id: userCompanyId },
                select: { id: true }
              });
              const companyUserIds = companyUsers.map(u => u.id);
              where.user_id = { in: companyUserIds };
            } else {
              where.user_id = Number(req.user.id);
            }
          }
        }

        const rows = await prisma[table].findMany({
          where,
          orderBy
        });

        let serializedRows = serializePrisma(rows);

        // Backward compatibility mapping for Telemetry
        if (table === 'telemetry') {
          serializedRows = serializedRows.map(row => ({
            ...row,
            power: parseFloat(row.present_power || 0.00),
            pv_power: parseFloat(row.present_power || 0.00),
            // Parse raw_json back to object if it was a string
            raw_json: row.raw_json ? JSON.parse(row.raw_json) : null
          }));
        }

        data[table] = serializedRows;
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error('Error fetching database:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Inserts a record
  insertRecord: async (req, res) => {
    const { table, item } = req.body;
    try {
      validateTable(table);
      
      const payload = { ...item };

      // Hash user password if creating a new user
      if (table === 'users' && payload.password) {
        payload.password = bcrypt.hashSync(payload.password, 10);
      }
      
      // Map frontend fields for telemetry table
      if (table === 'telemetry') {
        if (payload.present_power === undefined) {
          payload.present_power = payload.power !== undefined ? payload.power : payload.pv_power || 0.00;
        }
        delete payload.power;
        delete payload.pv_power;
        
        if (payload.raw_json && typeof payload.raw_json === 'object') {
          payload.raw_json = JSON.stringify(payload.raw_json);
        }
      }

      // Convert Date string values back to Date objects for timestamptz columns
      const dateFields = ['created_at', 'updated_at', 'last_login', 'timestamp', 'started_at', 'resolved_at', 'commission_date'];
      dateFields.forEach(field => {
        if (payload[field]) {
          payload[field] = new Date(payload[field]);
        }
      });

      // Delete updated_at if the table doesn't have this column
      const tablesWithUpdatedAt = ['companies', 'users', 'plants', 'website_accounts', 'plant_issues'];
      if (!tablesWithUpdatedAt.includes(table)) {
        delete payload.updated_at;
      }

      // Delete created_at if the table doesn't have this column
      const tablesWithCreatedAt = ['companies', 'users', 'plants', 'plant_users', 'website_accounts', 'telemetry', 'plant_issues', 'audit_logs', 'company_variables'];
      if (!tablesWithCreatedAt.includes(table)) {
        delete payload.created_at;
      }

      // Filter out auto-generated fields if they are null/undefined
      if (payload.id === null || payload.id === undefined) {
        delete payload.id;
      } else if (table !== 'plant_users') {
        // If the ID is specified but already exists in the database, delete it so the database can auto-generate a unique ID
        const existing = await prisma[table].findUnique({
          where: { id: Number(payload.id) }
        });
        if (existing) {
          delete payload.id;
        }
      }

      const inserted = await prisma[table].create({
        data: payload
      });

      // Synchronize database sequence to prevent future auto-increment conflicts
      if (table !== 'plant_users') {
        await prisma.$executeRawUnsafe(`
          SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1))
        `).catch(err => console.error(`Failed to sync sequence for ${table}:`, err));
      }

      let serialized = serializePrisma(inserted);

      if (table === 'telemetry') {
        serialized = {
          ...serialized,
          power: parseFloat(serialized.present_power || 0.00),
          pv_power: parseFloat(serialized.present_power || 0.00),
          raw_json: serialized.raw_json ? JSON.parse(serialized.raw_json) : null
        };
      }

      res.json({ success: true, data: serialized });
    } catch (err) {
      console.error(`Error inserting into ${table}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Updates a record
  updateRecord: async (req, res) => {
    const { table, id, updates } = req.body;
    try {
      validateTable(table);
      
      const payload = { ...updates };

      // Hash user password if updating password
      if (table === 'users' && payload.password) {
        payload.password = bcrypt.hashSync(payload.password, 10);
      }
      
      // Map frontend fields for telemetry table
      if (table === 'telemetry') {
        if (payload.present_power === undefined && (payload.power !== undefined || payload.pv_power !== undefined)) {
          payload.present_power = payload.power !== undefined ? payload.power : payload.pv_power;
        }
        delete payload.power;
        delete payload.pv_power;

        if (payload.raw_json && typeof payload.raw_json === 'object') {
          payload.raw_json = JSON.stringify(payload.raw_json);
        }
      }

      // Remove auto-generated timestamp updates to let DB handle them or set explicitly
      delete payload.id;
      delete payload.created_at;

      // Update updated_at automatically if table has it, otherwise delete it
      const tablesWithUpdatedAt = ['companies', 'users', 'plants', 'website_accounts', 'plant_issues'];
      if (tablesWithUpdatedAt.includes(table)) {
        payload.updated_at = new Date();
      } else {
        delete payload.updated_at;
      }

      // Convert Date string values back to Date objects for timestamptz columns
      const dateFields = ['created_at', 'updated_at', 'last_login', 'timestamp', 'started_at', 'resolved_at', 'commission_date'];
      dateFields.forEach(field => {
        if (payload[field]) {
          payload[field] = new Date(payload[field]);
        }
      });

      const updated = await prisma[table].update({
        where: { id: Number(id) },
        data: payload
      });

      let serialized = serializePrisma(updated);

      if (serialized && table === 'telemetry') {
        serialized = {
          ...serialized,
          power: parseFloat(serialized.present_power || 0.00),
          pv_power: parseFloat(serialized.present_power || 0.00),
          raw_json: serialized.raw_json ? JSON.parse(serialized.raw_json) : null
        };
      }

      res.json({ success: true, data: serialized });
    } catch (err) {
      console.error(`Error updating table ${table}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Deletes a record
  deleteRecord: async (req, res) => {
    const { table, id } = req.body;
    try {
      validateTable(table);
      
      await prisma[table].delete({
        where: { id: Number(id) }
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error(`Error deleting from ${table}:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Assign user to plant mapping
  assignPlant: async (req, res) => {
    const { user_id, plant_id } = req.body;
    try {
      await prisma.plant_users.upsert({
        where: {
          user_id_plant_id: {
            user_id: Number(user_id),
            plant_id: Number(plant_id)
          }
        },
        create: {
          user_id: Number(user_id),
          plant_id: Number(plant_id)
        },
        update: {}
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Error assigning plant:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Remove user from plant mapping
  removePlant: async (req, res) => {
    const { user_id, plant_id } = req.body;
    try {
      await prisma.plant_users.delete({
        where: {
          user_id_plant_id: {
            user_id: Number(user_id),
            plant_id: Number(plant_id)
          }
        }
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Error removing plant assignment:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
};
