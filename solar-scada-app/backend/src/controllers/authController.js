import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const authController = {
  login: async (req, res) => {
    const { email, password, role } = req.body;
    try {
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      // Query user from database
      const user = await prisma.users.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive'
          }
        }
      });

      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials: User not found' });
      }

      if (!user.is_active) {
        return res.status(403).json({ success: false, error: 'This user account is suspended or inactive.' });
      }

      // Validate role if specified
      if (role && user.role !== role) {
        return res.status(401).json({ success: false, error: 'Invalid credentials: Role mismatch' });
      }

      // Validate password (bcrypt check, with plain-text fallback for development)
      let isMatch = false;
      try {
        isMatch = bcrypt.compareSync(password, user.password);
      } catch (err) {
        // password in db might be plain-text
        isMatch = false;
      }

      if (!isMatch && user.password === password) {
        isMatch = true;
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials: Password incorrect' });
      }

      // Generate JWT Token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          company_id: user.company_id 
        },
        process.env.JWT_SECRET || 'super-secure-scada-jwt-secret-key-123!',
        { expiresIn: '24h' }
      );

      // Update user's last login
      await prisma.users.update({
        where: { id: user.id },
        data: { last_login: new Date() }
      });

      // Log login audit
      await prisma.audit_logs.create({
        data: {
          user_id: user.id,
          action: 'User Logged In',
          entity_type: 'User',
          entity_id: user.id
        }
      });

      // Return token & user details
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company_id: user.company_id
        }
      });

    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  bypassLogin: async (req, res) => {
    const { email, role } = req.body;
    try {
      let user = null;
      
      if (email) {
        user = await prisma.users.findFirst({
          where: {
            email: {
              equals: email,
              mode: 'insensitive'
            }
          }
        });
      } else if (role) {
        user = await prisma.users.findFirst({
          where: {
            role: role
          }
        });
      } else {
        return res.status(400).json({ success: false, error: 'Email or role is required for bypass login' });
      }
      
      if (!user) {
        return res.status(404).json({ success: false, error: 'User for bypass not found' });
      }

      // Generate JWT Token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          company_id: user.company_id 
        },
        process.env.JWT_SECRET || 'super-secure-scada-jwt-secret-key-123!',
        { expiresIn: '24h' }
      );

      // Update user's last login
      await prisma.users.update({
        where: { id: user.id },
        data: { last_login: new Date() }
      });

      // Log login audit
      await prisma.audit_logs.create({
        data: {
          user_id: user.id,
          action: 'User Logged In (Bypass)',
          entity_type: 'User',
          entity_id: user.id
        }
      });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company_id: user.company_id
        }
      });
    } catch (err) {
      console.error('Bypass login error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
};
