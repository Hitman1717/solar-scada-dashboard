# Solar SCADA & Scraping Platform

Welcome to the **Solar SCADA & Scraping Platform**, an enterprise-grade, multi-tenant monitoring and diagnostics web application designed for solar power plant operators, managers, and system administrators. 

The application features a hybrid, double-layered database fallback system (PostgreSQL backend with local storage simulation mode), background browser automation scrapers utilizing **Playwright**, and a **Geographical Anomaly Detection Engine** to analyze and correlate solar plant outputs in real-time.

---

## 🏗️ System Architecture

The platform operates on a modular, decoupled architecture consisting of an interactive dashboard client and a background-processing backend service:

```mermaid
graph TD
    subgraph Frontend Client (React + Vite)
        UI["React 19 SPA & Tailwind v4"]
        DB_Serv["dbService (Data Broker)"]
        ExcelData["excel_data.json (Seed Data)"]
        SimLoop["Simulation Loop (Fallback Mode)"]
    end

    subgraph Backend Server (Express + Node.js)
        API["Express API Server"]
        JWT_Auth["JWT Authentication Middleware"]
        CronSched["node-cron Scheduler (1 min ticks)"]
        MQueue["Custom In-Memory Queue"]
        Workers["Playwright Worker Pool"]
        SyncEng["Opportunistic Sync Engine"]
        AnomalyDet["Geographical Anomaly Detector"]
    end

    subgraph Database Layer
        PrismaClient["Prisma Client ORM"]
        PG["PostgreSQL Database"]
    end

    subgraph External OEM Portals
        WebPortal["Huawei FusionSolar / Solis / Solax Web Apps"]
    end

    %% Frontend Interactions
    UI --> DB_Serv
    DB_Serv -- "JWT-Auth API Requests" --> API
    DB_Serv -- "Bypass Mode Fallback" --> ExcelData
    DB_Serv -- "Simulates Telemetry" --> SimLoop

    %% Backend Interactions
    API --> JWT_Auth
    JWT_Auth --> PrismaClient
    PrismaClient --> PG

    %% Scraping & Automation Pipelines
    CronSched -- "1. Spawns Scrape Jobs" --> MQueue
    MQueue -- "2. Distributes Task" --> Workers
    Workers -- "3. Playwright Browser Scrapes" --> WebPortal
    WebPortal -- "4. Returns JSON Telemetry" --> Workers
    Workers -- "5. Updates cache & JSON" --> SyncEng
    SyncEng -- "6. Bulk Inserts DB" --> PG
    SyncEng -- "7. Triggers Checks" --> AnomalyDet
    AnomalyDet -- "8. Raises/Resolves Alarms" --> PG
```

---

## 📊 System Component Breakdown

| Component | Technology Stack | Key Responsibilities |
| :--- | :--- | :--- |
| **Frontend UI Client** | React 19, Vite, Tailwind CSS v4, Recharts, Lucide React, React Router Dom | Interactive charts, multi-role widgets, manual scraper triggering, company configuration, and alarm management. |
| **Data Broker (`dbService`)** | JavaScript (ES6+), LocalStorage | Transparently switches between live API calls and LocalStorage backup depending on backend server availability. |
| **Backend REST API** | Node.js, Express, JSON Web Tokens (JWT), Cors, Dotenv, Bcryptjs | Exposes secure endpoints for multi-tenant data access, manual job pushes, user assignment, and config parameters. |
| **Scraper Scheduler** | `node-cron`, Jitter algorithm | Periodically parses active portal accounts, computes load-balanced execution minutes, and pushes tasks into queues. |
| **Automation Pipeline** | Playwright, Browser Instance Pool, Storage Session Caching | Manages headless browser sessions, logs in to solar OEM portals, bypasses duplicate logins using cached state, and parses metrics. |
| **Sync Engine** | Node Child Processes, File System (JSON) | Aggregates raw scraped telemetry, performs auto-onboarding of new stations, normalizes units, and performs bulk upserts into PostgreSQL. |
| **Anomaly Engine** | Geospatial algorithms, daylight filters | Runs correlation checks, analyzes neighboring plant outputs, generates irregularity warnings, and logs station offline alarms. |

---

## 🗄️ Database Schema Reference (PostgreSQL via Prisma ORM)

The PostgreSQL schema is structured around a multi-tenant model. Access to data is restricted dynamically at the API level based on the requesting user's tenant constraints.

| Model / Table | Primary Key | Foreign Key Relations | Key Columns & Types | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`companies`** | `id` (Int) | None | `company_name` (String), `status` (String) | Represents parent client companies that own solar plant assets. |
| **`users`** | `id` (Int) | `company_id` ➔ `companies` | `email` (String, Unique), `password` (String, Hash), `role` (String) | Application accounts with specific system capabilities. |
| **`plants`** | `id` (Int) | `company_id` ➔ `companies` | `plant_name` (String), `plant_capacity` (String), `latitude` / `longitude` (Decimal) | Represents physical solar power generation fields. |
| **`plant_users`** | `(user_id, plant_id)` | `user_id` ➔ `users`, `plant_id` ➔ `plants` | Composite Join Key | Explicitly maps standard users to the specific plants they are authorized to view. |
| **`plant_tables`** | `id` (Int) | `plant_id` ➔ `plants` | `table_number` (String), `panels_count` (Int), `degrade_pct` (Decimal), `power_w` (Decimal) | Hardware metadata defining specific inverter tables and modules under a plant. |
| **`telemetry`** | `id` (Int) | `plant_id` ➔ `plants` | `timestamp` (DateTime), `present_power` (Decimal), `daily_generation` (Decimal), `irradiance` (Decimal), `raw_json` (String) | System log storing granular electrical, weather, and thermodynamic records. |
| **`plant_issues`** | `id` (Int) | `plant_id` ➔ `plants`, `telemetry_id` ➔ `telemetry` | `issue_type` (String), `severity` (String), `status` (String), `started_at` / `resolved_at` (DateTime) | Alarm tracking system for underperformance, communication failures, and scraping errors. |
| **`website_accounts`** | `id` (Int) | `plant_id` ➔ `plants`, `provider_id` ➔ `website_providers` | `username` (String), `password` (String), `scrape_interval_minutes` (Int), `last_scraped_at` (DateTime) | Holds credentials needed by background scrapers to access OEM solar portals. |
| **`website_providers`** | `id` (Int) | None | `provider_name` (String), `oem_key` (String, Unique), `login_url` (String) | OEM configuration lookup (e.g., Polycab, Solis, Solax). |
| **`company_variables`** | `id` (Int) | `company_id` ➔ `companies`, `plant_id` ➔ `plants` | `variable_name` (String), `variable_value` (String), `timestamp` (DateTime) | Dynamic variables, key metrics targets, calculation coefficients, and constants. |
| **`audit_logs`** | `id` (Int) | `user_id` ➔ `users` | `action` (String), `entity_type` (String), `entity_id` (Int), `created_at` (DateTime) | Cryptographic verification and action tracing for administrative events. |

---

## 🔐 User Authorization Matrix

Access control lists (ACL) are enforced inside backend controllers and parsed by React routing views to present tailored control panels.

| Feature Area / Capability | SUPER_ADMIN | ADMIN | MANAGEMENT |
| :--- | :---: | :---: | :---: |
| **System-wide Audit Logs** | 👁️ Full Access | ❌ Blocked | ❌ Blocked |
| **Company & Plant Creation** | ⚙️ Write | ❌ Blocked | ❌ Blocked |
| **User Onboarding / Deletion** | ⚙️ Write (All Companies) | ⚙️ Write (Own Company only) | ❌ Blocked |
| **Assign Users to Plants** | ⚙️ Write | ⚙️ Write | ❌ Blocked |
| **Edit Plant Hardware Tables** | ❌ Blocked | ⚙️ Write (Assigned Plants) | ❌ Blocked |
| **Manage OEM Scraper Credentials** | ❌ Blocked | ⚙️ Write (Assigned Plants) | ❌ Blocked |
| **Manual Scraper Trigger** | ❌ Blocked | ⚙️ Trigger (Assigned Plants) | ❌ Blocked |
| **Configure Operational Variables** | ⚙️ Write | ⚙️ Write | ❌ Blocked |
| **Aggregate Reports & KPIs** | 👁️ View (All) | 👁️ View (Own Plants) | 👁️ View & Analyze (Own Plants) |

---

## 🔄 Core System Workflows

### 1. Automated Scraper Pipeline Workflow
Background workers scrape telemetry metrics recursively. The system is designed to minimize spike loads on external servers and cache session cookies to avoid redundant logins:

```mermaid
sequenceDiagram
    autonumber
    participant S as scheduler.js (Cron)
    participant Q as queues.js (BullMQ Mock)
    participant W as worker.js (Worker Node)
    participant P as Playwright Pool
    participant OEM as OEM Web Portal
    participant DB as PostgreSQL (Prisma)

    S->>DB: Fetch enabled website_accounts
    DB-->>S: Accounts list (Solis, Polycab, Solax)
    Note over S: Apply Jitter Offset:<br/>Minute offset = Account.id % Interval
    alt Account is due based on jitter
        S->>Q: Queue scrape job (accountId, oemKey)
    end
    Q->>W: Dispatch job to active worker
    W->>P: Acquire browser context
    W->>P: Load cached session cookies (sessions/*.json)
    P->>OEM: Navigate & Scraping Script
    alt Session Cookie Expired
        OEM-->>P: Redirect to login page
        P->>OEM: Inject username/password & Submit
        P->>W: Extract and cache new session state (cookie storage)
    end
    OEM-->>P: Load dashboard telemetry raw values
    P-->>W: Raw HTML/JSON parsed
    W->>P: Release browser context to pool
    W->>DB: Opportunistic Sync: Update telemetry & resolve Scrape Alarms
```

---

### 2. Geographical Anomaly Detection Engine
This engine runs automatically every time telemetry data is synchronized into the database. It compares plants against geographically close neighbors to find irregularities:

```mermaid
graph TD
    Start["1. Sync Finished Trigger"] --> FetchPlants["2. Fetch all registered plants"]
    FetchPlants --> Cluster["3. Geographical Proximity Clustering"]
    
    subgraph Clustering Logic
        Direction["Calculate absolute Lat/Lng delta"]
        Delta{"Delta <= 0.01 (~1km)?"}
        Group["Group into Cluster Group"]
    end
    Cluster --> Direction --> Delta
    Delta -- Yes --> Group
    Delta -- No --> Single["Skip (Standalone Plant)"]

    Group --> daylight{"4. Daylight Hours Check?"}
    daylight -- No (Night/Dawn) --> SkipAlerts["5. Skip Offline Alarms"]
    daylight -- Yes (7 AM - 6 PM) --> OfflineCheck{"6. No telemetry for 2 hours?"}

    OfflineCheck -- Yes --> AlertOffline["7. Trigger CRITICAL: Offline Issue"]
    OfflineCheck -- No --> OutputCheck{"8. Compare Normalized Output vs Neighbors"}

    OutputCheck --> DiffCheck{"Is Plant output < 95% of Cluster Maximum?"}
    DiffCheck -- Yes --> AlertWarning["9. Trigger WARNING: Irregularity Issue"]
    DiffCheck -- No --> ResolveAlerts["10. Resolve any active alerts for Plant"]
```

---

### 3. Double-Layer Database Fallback Flow
If the backend PostgreSQL database goes offline, the frontend client switches smoothly to offline mode without interrupting dashboard displays:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as App.jsx (React)
    participant Broker as dbService.js
    participant API as Express API Server
    participant Local as Client LocalStorage

    User->>App: Launch SCADA Portal
    App->>Broker: initializeDB()
    Broker->>API: GET /api/db (Injects JWT bearer token)
    alt API Server is Online (Success)
        API-->>Broker: Returns PostgreSQL database dump
        Broker->>Broker: Populate cache memory state
        Broker-->>App: Init succeeded (Live backend mode)
    else API Server is Offline / Token Invalid
        API-->>Broker: Error (500 / 401 / Network Timeout)
        Broker->>Broker: Log warning: loading offline fallback
        Broker->>Local: Fetch 'solar_scada_initialized_excel_v1'
        alt Not Initialized
            Broker->>Broker: Read local excel_data.json
            Broker->>Local: Seed data schema into LocalStorage keys
        end
        Broker->>Local: Read all LocalStorage table dumps
        Local-->>Broker: Return tables JSON strings
        Broker->>Broker: Populate cache memory state
        Broker-->>App: Init succeeded (Offline Fallback Simulator Mode)
        Note over App: Starts simulationService.js loops<br/>to insert simulated telemetry rows every 30s
    end
```

---

## 📁 Repository Directory Structure

```text
solar-scada-app/
├── backend/                        # Node.js + Express Backend Server
│   ├── .agents/                    # Custom agent parameters
│   ├── prisma/
│   │   └── schema.prisma           # Prisma PostgreSQL Database models
│   ├── src/
│   │   ├── config/
│   │   │   └── prisma.js           # Prisma client initialization
│   │   ├── controllers/
│   │   │   ├── authController.js   # JWT and Bypass authentication handlers
│   │   │   ├── dbController.js     # Centralized multi-tenant CRUD gateway
│   │   │   ├── scrapeController.js # API endpoints to trigger scrapers manually
│   │   │   └── varController.js    # Operational variables editor controllers
│   │   ├── middleware/
│   │   │   └── authMiddleware.js   # JWT extraction & routing route guards
│   │   ├── routes/
│   │   │   └── api.js              # REST endpoints routing map
│   │   └── services/
│   │       ├── scrapers/           # Headless browser scraping actions
│   │       │   ├── polycab.js      # Polycab portal strategy
│   │       │   ├── solax.js        # Solax portal strategy
│   │       │   └── solis.js        # Solis portal strategy
│   │       ├── anomalyDetector.js  # Geographical anomaly correlation logs
│   │       ├── browserPool.js      # Playwright browser pooling controller
│   │       ├── queues.js           # Custom concurrency & rate-limited memory queues
│   │       ├── scheduler.js        # Minute tick-scheduler using jitter calculations
│   │       ├── scraperRunner.js    # Node child executor & post-processor runner
│   │       ├── sessions.js         # Browser session storage persistence
│   │       └── worker.js           # Scraping consumer queues processor
│   ├── ecosystem.config.cjs        # PM2 Configuration for background processes
│   ├── server.js                   # Express application bootstrap & cron setup
│   └── test_onboard.js             # Onboarding testing script
│
├── src/                            # React Frontend SPA
│   ├── app/
│   │   └── roles/                  # Role-based workspace components
│   │       ├── admin/
│   │       │   └── AdminApp.jsx    # Admin metrics dashboard & configuration
│   │       ├── management/
│   │       │   └── ManagementApp.jsx # Management KPIs & aggregation analytics
│   │       └── superadmin/
│   │           └── SuperAdminApp.jsx # Global audit logging, user/company tables
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── CompanyVariablesView.jsx # Operations parameters control sheet
│   │   │   └── DashboardOverview.jsx   # Live plant telemetry charts, layout maps
│   │   └── layout/
│   │       ├── Sidebar.jsx         # Navigation sidebar drawer
│   │       └── TopBanner.jsx       # Header & real-time telemetry feed
│   ├── features/
│   │   └── auth/
│   │       └── components/
│   │           └── RoleSelector.jsx # Custom Login Portal
│   ├── services/
│   │   ├── dbService.js            # Frontend broker layer (API <-> LocalStorage)
│   │   ├── excel_data.json         # Static excel database used as seeds
│   │   └── simulationService.js    # Live generation loops for fallback simulation
│   ├── App.css
│   ├── App.jsx                     # Application viewport Router & simulation hub
│   ├── index.css                   # Custom global styling sheets & variables
│   └── main.jsx                    # Vite SPA entry mounting bootstrap
│
├── dist/                           # Built SPA client assets (Production build output)
├── vite.config.js                  # Vite compiler configurations (React, Tailwind CSS v4)
├── package.json                    # Workspace scripts & dependency manifest
└── README.md                       # Systems overview manual (This document)
```

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js** (v18.x or above)
- **NPM** (v9.x or above)
- **PostgreSQL** Database server (Optional: only needed to run in Live API Mode)

---

### ⚙️ Backend Setup & Configuration
1. Open your terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder and configure the connection string and security secrets:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://username:password@localhost:5432/solar_scada?schema=public"
   JWT_SECRET="your-super-secure-production-jwt-key"
   ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000"
   ```
4. Perform Prisma migration steps to map database schemas to PostgreSQL:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Seed the database with default credentials, companies, and platforms:
   ```bash
   npm run seed
   ```
6. Start the Express backend server:
   * **Development Mode (Auto-restart on edits)**:
     ```bash
     npm run dev
     ```
   * **Production Server (Standard launch)**:
     ```bash
     npm start
     ```

---

### 💻 Frontend Setup & Startup
1. Open a new terminal window and navigate to the root directory:
   ```bash
   cd solar-scada-app
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Run the Vite React development server:
   ```bash
   npm run dev
   ```
4. Access the application in your browser at the default Vite URL:
   * [http://localhost:5173](http://localhost:5173)

---

## 🔑 Default Login Credentials (Bypass Portal Mode)

To explore the dashboard interfaces immediately without registering custom portal configs, navigate to the portal and select one of the following predefined accounts:

1. **Super Admin**:
   * **Email**: `superadmin@msl.com`
   * **Password**: `password`
   * *Provides system logs auditing, site metrics dashboards, and user management portals.*

2. **Company Admin (MSL)**:
   * **Email**: `admin@msl.com`
   * **Password**: `password`
   * *Provides hardware configuration forms, credentials onboarding tables, and manual scraper execution panels.*

3. **Management Reporter**:
   * **Email**: `mgmt@msl.com`
   * **Password**: `password`
   * *Provides high-level analytical diagrams, plant performance indexes, and KPI metrics comparisons.*
