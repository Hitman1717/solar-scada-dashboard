import express from 'express';
import { dbController } from '../controllers/dbController.js';
import { varController } from '../controllers/varController.js';
import { authController } from '../controllers/authController.js';
import { scrapeController } from '../controllers/scrapeController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public Authentication Endpoint
router.post('/auth/login', authController.login);
router.post('/auth/bypass', authController.bypassLogin);

// Protected SCADA DB Endpoints
router.get('/db', verifyToken, dbController.getDatabase);
router.post('/db/insert', verifyToken, dbController.insertRecord);
router.post('/db/update', verifyToken, dbController.updateRecord);
router.post('/db/delete', verifyToken, dbController.deleteRecord);
router.post('/db/assign-plant', verifyToken, dbController.assignPlant);
router.post('/db/remove-plant', verifyToken, dbController.removePlant);

// Protected Scraper Trigger Endpoint
router.post('/scrape/onboard', verifyToken, scrapeController.onboardScraperAccount);
router.post('/scrape/:plantId', verifyToken, scrapeController.triggerScrape);

// Protected Dynamic Variables Endpoints
router.get('/variables', verifyToken, varController.getVariables);
router.post('/variables', verifyToken, varController.saveVariable);

export default router;
