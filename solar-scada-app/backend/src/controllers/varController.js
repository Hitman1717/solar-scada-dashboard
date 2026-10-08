import prisma from '../config/prisma.js';

export const varController = {
  // Get all variables, optionally filtered by company and/or plant
  getVariables: async (req, res) => {
    const { company_id, plant_id } = req.query;
    try {
      let allowedPlantIds = null;
      let userCompanyId = req.user?.company_id ? Number(req.user.company_id) : null;
      
      if (req.user?.role !== 'SUPER_ADMIN') {
        const userPlantUsers = await prisma.plant_users.findMany({
          where: { user_id: Number(req.user.id) }
        });
        allowedPlantIds = userPlantUsers.map(pu => pu.plant_id);
      }

      const where = {};
      if (company_id) {
        where.company_id = Number(company_id);
      }
      if (plant_id) {
        where.plant_id = Number(plant_id);
      }

      // Enforce access control constraints
      if (allowedPlantIds !== null) {
        if (where.plant_id) {
          if (!allowedPlantIds.includes(where.plant_id)) {
            return res.status(403).json({ success: false, error: 'Access Denied: Plant not assigned to user' });
          }
        } else {
          where.plant_id = { in: allowedPlantIds };
        }
        
        if (where.company_id) {
          if (userCompanyId !== null && where.company_id !== userCompanyId) {
            return res.status(403).json({ success: false, error: 'Access Denied: Company ID mismatch' });
          }
        } else if (userCompanyId !== null) {
          where.company_id = userCompanyId;
        }
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

      // Enforce access control constraints
      if (req.user?.role !== 'SUPER_ADMIN') {
        let userCompanyId = req.user?.company_id ? Number(req.user.company_id) : null;
        if (userCompanyId !== null && Number(company_id) !== userCompanyId) {
          return res.status(403).json({ success: false, error: 'Access Denied: Cannot save variables for another company' });
        }
        
        if (plant_id) {
          const userPlantUsers = await prisma.plant_users.findMany({
            where: { user_id: Number(req.user.id) }
          });
          const allowedPlantIds = userPlantUsers.map(pu => pu.plant_id);
          if (!allowedPlantIds.includes(Number(plant_id))) {
            return res.status(403).json({ success: false, error: 'Access Denied: Cannot save variables for unassigned plant' });
          }
        }
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
