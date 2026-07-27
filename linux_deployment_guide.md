# Solar SCADA Platform: Linux Deployment & Production Guidelines

This guide details the procedures, system configurations, and best practices to deploy and run the **Solar SCADA Platform** (React frontend, Express API backend, and PostgreSQL database) on a production Linux server (Ubuntu/CentOS/Debian).

---

## 🏗️ 1. Architecture Overview
A production-grade Linux deployment divides the platform into three decoupled components:
1. **Frontend**: React application built to static files, served via a high-performance web server (Nginx).
2. **Backend**: Express API server running continuously in the background managed by a process manager (PM2) or a Systemd service.
3. **Database**: PostgreSQL (either your live Supabase cloud database, or a local system PostgreSQL instance).

---

## 🚀 2. Setting Up the Express API Server (Node.js)

### Step 1: Install Node.js
On Ubuntu/Debian:
```bash
# Install NodeSource PPA for Node 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Install Process Manager (PM2)
PM2 is the industry-standard process manager for Node.js. It manages server clustering, monitors CPU/Memory, auto-restarts on crashes, and runs applications on system reboot.
```bash
sudo npm install -y -g pm2
```

### Step 3: Configure Environment Variables
Create a production `.env` file in `/var/www/solar-scada-app/backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.zyrcpfdzrqntjygcmcwq.supabase.co:5432/postgres
JWT_SECRET=production-grade-random-hex-secret-key-999!
NODE_ENV=production
```

### Step 4: Run Seeding & Start Backend under PM2
```bash
# Navigate to the backend folder
cd /var/www/solar-scada-app/backend

# Install production dependencies
npm install --omit=dev

# Force seed database tables and data on your PostgreSQL/Supabase
npm run seed

# Start server using PM2
pm2 start server.js --name "solar-scada-backend"

# Ensure PM2 starts automatically on server reboot
pm2 startup
pm2 save
```

---

## 🛠️ 3. Deploying Background Scrapers (Linux Cron vs Node-cron)

To keep collecting telemetry 24/7 even when no browsers are open, you need a background scraper. You have two options for Linux:

### Option A: Node-cron (Recommended - Cross-platform)
This runs directly inside the Node Express backend process. We define a cron task in Express that queries the monitoring sites (Growatt, Solax, Solis) periodically and commits to PostgreSQL.
* **Pros**: Simple, cross-platform, shares database pool directly, single service to manage.
* **Code Example**:
  ```javascript
  import cron from 'node-cron';
  
  // Run scraper every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running background telemetry scraper...');
    // Scraper code here
  });
  ```

### Option B: Linux System Cron (`crontab`)
If you want to run your scrapers as independent python/node CLI scripts (e.g. from `/solar_scrapping/run_all.js`), you can hook them directly into the Linux system cron scheduler:
```bash
# Edit crontab configuration
crontab -e
```
Add the following line to run the scrapper script every 15 minutes, directing output logs to a file:
```cron
*/15 * * * * /usr/bin/node /var/www/solar-scada-app/solar_scrapping/run_all.js >> /var/log/solar_scraper.log 2>&1
```

---

## 🛡️ 4. Direct Systemd Service Setup (Alternative to PM2)
If your IT operations prefer native Linux Systemd services instead of PM2, you can configure it easily:

1. Create a systemd service file:
   ```bash
   sudo nano /etc/systemd/system/solar-backend.service
   ```
2. Paste the following configuration:
   ```ini
   [Unit]
   Description=Solar SCADA Express Backend API
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/solar-scada-app/backend
   EnvironmentFile=/var/www/solar-scada-app/backend/.env
   ExecStart=/usr/bin/node server.js
   Restart=on-failure
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```
3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable solar-backend.service
   sudo systemctl start solar-backend.service
   sudo systemctl status solar-backend.service
   ```

---

## 🌐 5. Serving the React Frontend (Nginx Server)

### Step 1: Build the React Application
In the `solar-scada-app` directory:
```bash
# Build React components to optimized static files
npm run build
```
This outputs all assets into the `dist` folder.

### Step 2: Configure Nginx Configuration
Create an Nginx configuration file at `/etc/nginx/sites-available/solar-scada`:
```nginx
server {
    listen 80;
    server_name solar-dashboard.company.com;

    root /var/www/solar-scada-app/dist;
    index index.html;

    # Frontend Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Express backend on Port 5000
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```
Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/solar-scada /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
