import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './src/routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Restrict CORS origin in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : '*';

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// In production, verify JWT secret is not the default development one
if (process.env.NODE_ENV === 'production') {
  const defaultSecret = 'super-secure-scada-jwt-secret-key-123!';
  const currentSecret = process.env.JWT_SECRET;
  if (!currentSecret || currentSecret === defaultSecret) {
    console.warn('\x1b[31m%s\x1b[0m', '=====================================================');
    console.warn('\x1b[31m%s\x1b[0m', 'SECURITY WARNING: Using default or empty JWT_SECRET in production!');
    console.warn('\x1b[31m%s\x1b[0m', 'Please set a secure JWT_SECRET environment variable.');
    console.warn('\x1b[31m%s\x1b[0m', '=====================================================');
  }
}

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

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));

  // Frontend client routing fallback (ignore API routes)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Solar SCADA Backend listening on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}/api`);
  console.log(`=================================================`);
});
