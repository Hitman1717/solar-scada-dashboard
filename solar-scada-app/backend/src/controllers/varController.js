import prisma from '../config/prisma.js';

export const varController = {
  // Get all variables, optionally filtered by company and/or plant
  getVariables: async (req, res) => {
    const { company_id, plant_id } = req.query;
    try {
      const where = {};
      if (company_id) {
        where.company_id = Number(company_id);
      }
      if (plant_id) {
        where.plant_id = Number(plant_id);
      }

      const variables = await prisma.company_variables.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        }
      });

      res.json({ success: true, data: variables });
    } catch (err) {
      console.error('Error fetching company variables:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Save a company variable
  saveVariable: async (req, res) => {
    const { company_id, plant_id, variable_name, variable_value, timestamp } = req.body;
    try {
      if (!company_id || !variable_name) {
        return res.status(400).json({ success: false, error: 'company_id and variable_name are required' });
      }

      const timeVal = timestamp ? new Date(timestamp) : new Date();

      const newVar = await prisma.company_variables.create({
        data: {
          company_id: Number(company_id),
          plant_id: plant_id ? Number(plant_id) : null,
          variable_name,
          variable_value: variable_value !== undefined && variable_value !== null ? String(variable_value) : null,
          timestamp: timeVal
        }
      });
      
      res.json({ success: true, data: newVar });
    } catch (err) {
      console.error('Error saving company variable:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
};
