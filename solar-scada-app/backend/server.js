import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './src/routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());

// Parse JSON and form-url-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Solar SCADA Backend is running' });
});

// Main API Router
app.use('/api', apiRouter);

// Background Scraper Workers & Scheduler Initialization
import { initWorkers } from './src/services/worker.js';
import { tick } from './src/services/scheduler.js';
import cron from 'node-cron';

// Initialize the queue workers on startup
initWorkers();

// Background Cron Scheduler (Ticks every minute to queue due scrapers using jitter offsets)
cron.schedule('* * * * *', async () => {
  console.log('--- [Cron] Running scheduler tick... ---');
  await tick();
});

// Start server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Solar SCADA Backend listening on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}/api`);
  console.log(`=================================================`);
});
