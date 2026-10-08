# Solar SCADA & Scraping Platform: Technical Summary & Code Audit

This document provides a blunt, precise analysis of the **Solar SCADA & Scraping Platform** codebase. It delineates what features are fully implemented and functional versus what is only documented or simulated.

---

## 1. ACTUAL TECH STACK

Below is the list of frameworks and libraries actually imported and utilized in the code:

### Frontend Client
*   **Core:** React 19 (`react` and `react-dom` @ `^19.2.7`)
*   **Routing:** **None (In-Memory State Routing).** Although `react-router-dom` is declared in `package.json`, it is not imported or used. Navigation is managed via simple React component state toggles (`currentTab` and `currentUser` in [App.jsx](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/src/App.jsx)).
*   **Styling:** Tailwind CSS v4 (`tailwindcss` @ `^4.3.2` and `@tailwindcss/vite` @ `^4.3.2`)
*   **Icons:** Lucide React (`lucide-react` @ `^1.23.0`)
*   **Visualizations & Charts:** Recharts (`recharts` @ `^3.9.2`)
*   **Compilation / Bundling:** Vite 8 (`vite` @ `^8.1.1` and `@vitejs/plugin-react` @ `^6.0.3`)
*   **Linter:** Oxlint (`oxlint` @ `^1.71.0`)

### Backend Server
*   **Web Framework:** Express (`express` @ `^4.19.2`)
*   **ORM:** Prisma ORM (`prisma` @ `^7.9.0` and `@prisma/client` @ `^7.9.0`)
*   **Database Adapter:** Prisma PostgreSQL Adapter (`@prisma/adapter-pg` @ `^7.9.0`)
*   **Database Driver:** pg (`pg` @ `^8.12.0`)
*   **Authentication & Security:** JSON Web Tokens (`jsonwebtoken` @ `^9.0.3`) and bcrypt hashing (`bcryptjs` @ `^3.0.3`)
*   **Task Scheduler:** Node-cron (`node-cron` @ `^4.6.0`)
*   **Scraper / Automation Engine:** Playwright (`playwright` @ `^1.62.1`)
*   **Utility Libraries:** Cors (`cors` @ `^2.8.5`) and Dotenv (`dotenv` @ `^16.4.5`)
*   **Process Management:** PM2 (configured via [ecosystem.config.cjs](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/ecosystem.config.cjs))

---

## 2. WHAT SCRAPERS EXIST

Only three OEM/provider scrapers contain actual, working code. They reside in `backend/src/services/scrapers/`. All other providers mentioned in the documentation (Huawei FusionSolar, SolarEdge, Growatt, Sungrow, FoxESS) do not exist in the code.

### A. Solis Scraper ([solis.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/scrapers/solis.js))
*   **Tool:** Playwright.
*   **Login Handling:** Yes. Navigates to `https://www.soliscloud.com/login`. It dynamically detects username and password fields, automatically clicks the terms and agreement checkbox, and clicks submit. It then waits 10 seconds for the Vue iframe context (`iframe[name="glyun_vue2"]`) to render.
*   **Session Caching:** Yes. Restores and saves the Playwright browser storage state (cookies/local storage) to `sessions/${accountId}.json` to bypass logins on subsequent runs.
*   **Data Extracted:** Plant Status, Plant Name, Address, Owner, Inverter Online/Total, Daily Yield, Total Yield, Daily Full Load Hours, Power, PV Capacity, Update Time, and Fault Time. It normalizes unit strings (e.g., MWh, kWh, kW, W) to float values before returning.

### B. Solax Scraper ([solax.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/scrapers/solax.js))
*   **Tool:** Playwright.
*   **Login Handling:** Yes. Navigates to `https://www.solaxcloud.com/user-center/`. Enters credentials into inputs with placeholder-matching, checks the Privacy Policy checkbox, clicks submit, and waits for a redirect to the `/green/#/` path.
*   **Session Caching:** Yes. Utilizes the storage state file path `sessions/${accountId}.json`.
*   **Data Extracted:** First pulls overview metrics from the Plants section table. It then loops through the plants, clicks each plant's link to open detailed views (either in a new tab or via redirection), and parses internal gauges for Daily solar, Daily consumption, PV Capacity, PV Power, and Imported energy.

### C. Polycab Scraper ([polycab.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/scrapers/polycab.js))
*   **Tool:** Playwright.
*   **Login Handling:** Yes. Navigates to `https://pv.polycabmonitoring.com/dist/#/login/index` and inputs credentials.
*   **Session Caching:** Yes. Caches storage state in `sessions/${accountId}.json`.
*   **Data Extracted:** Instead of scraping DOM elements, it enables network response interception on the page. It navigates to the log pages to trigger API calls and extracts JSON payloads directly from intercepted endpoints: `GetMemberData`, `getAllAllMember`, `GroupList`, `MemberMonitor`, and `logsearch`. Specifically, it parses the `GroupList` JSON response for plant names, statuses, capacity, and generation figures.

---

## 3. SCHEDULING & QUEUE — HOW IT ACTUALLY WORKS

### Cron Job Trigger
The background scheduler is initiated in [server.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/server.js) using `node-cron`. It ticks **every minute**:
```javascript
cron.schedule('* * * * *', async () => {
  console.log('--- [Cron] Running scheduler tick... ---');
  await tick();
});
```

### Jitter Calculation
When the cron triggers, `tick()` in [scheduler.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/scheduler.js) queries all enabled website accounts. To avoid hammering OEM portals simultaneously, it calculates a jitter offset using the account's database ID and interval:
```javascript
const interval = account.scrape_interval_minutes || 5;
const offset = account.id % interval;
const dueNow = (nowMinutes - offset) % interval === 0;
```
If `dueNow` is true, the job is pushed into the queue.

### Queue & Worker Concurrency
The queue and worker mechanism is a **custom, in-memory implementation** written in [queues.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/queues.js). **It does NOT use Redis or DB persistence.** If the Node process restarts, all queued tasks are destroyed.

```javascript
// In-memory queue storage
const queues = {};

class CustomQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.workers = [];
  }
  // ...
```

Workers in [worker.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/worker.js) process the queued jobs. It uses the following concurrency settings:
*   **Solis:** Max 5 concurrent jobs (rate-limited to 5 jobs per 10 seconds).
*   **Polycab & Solax:** Max 3 concurrent jobs (rate-limited to 3 jobs per 10 seconds).

The workers run the Playwright scrapers, save results to a local `solar_data.json` file, and call `syncTelemetryFromJson()` in [scraperRunner.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/scraperRunner.js) to import records into the PostgreSQL database.

---

## 4. DATABASE — WHAT'S REALLY THERE

The database schema (PostgreSQL via Prisma in [schema.prisma](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/prisma/schema.prisma)) contains the following 11 models:

1.  **`companies`:** Client companies onboarded by the Super Admin.
2.  **`users`:** Accounts containing hashed passwords, names, emails, roles, and status.
3.  **`plants`:** Solar power plants containing capacities, coordinates, and commission dates.
4.  **`plant_users`:** Composite join table mapping standard users to their authorized plants.
5.  **`plant_tables`:** Metadata defining individual inverter tables (MAC addresses, panel counts, degradation metrics, active power).
6.  **`telemetry`:** Granular electrical, weather, and battery telemetry.
7.  **`plant_issues`:** Open and resolved alarms (Offline, Irregularity, ScrapeFailure).
8.  **`website_accounts`:** Scraper accounts holding credentials, enabled flags, and scrape intervals.
9.  **`website_providers`:** Lookup containing provider names (Polycab, Solis, Solax) and login URLs.
10. **`company_variables`:** Dynamic parameters (e.g., target performance multipliers, calculation coefficients).
11. **`audit_logs`:** Security and action tracing logs.

### Discrepancies vs. `db.md`
*   **Naming Conventions:** `db.md` documents all tables in PascalCase (e.g., `PlantUsers`, `WebsiteAccounts`), whereas the database actually implements them in snake_case (e.g., `plant_users`, `website_accounts`).
*   **Undocumented Tables:** The `plant_tables` and `company_variables` tables are fully functional and present in the database, but they are completely omitted from `db.md`.
*   **Undocumented Telemetry Columns:** `db.md` omits 9 columns present in `telemetry`: `present_power` (docs list `power`), `irradiance`, `plant_type`, `grid_status`, `battery_voltage`, `daily_charge`, `daily_discharge`, `daily_consumed`, and `imported_energy`.

---

## 5. ANOMALY DETECTION

This feature **actually exists** in the code inside [anomalyDetector.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/anomalyDetector.js). It runs automatically whenever new telemetry data is synchronized into the database.

### Detection Logic & Algorithms:
1.  **Geographical Clustering:**
    Plants are grouped into clusters if their latitude and longitude coordinates are within a delta of **0.01** (approximately 1 kilometer):
    ```javascript
    if (Math.abs(lat1 - lat2) <= 0.01 && Math.abs(lng1 - lng2) <= 0.01) { ... }
    ```
2.  **Daylight Offline Alert:**
    During daylight hours (7:00 AM to 6:00 PM), the engine checks if a plant has failed to report telemetry for 2 hours. If so, a critical **`Offline`** alarm is logged:
    ```javascript
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const isDaylight = currentHour >= 7 && currentHour <= 18;
    ```
3.  **Proximity Underperformance Alert (±5% Deviation):**
    For each geographical cluster, the engine calculates the normalized output of each active, reporting plant:
    $$\text{normalized} = \frac{\text{present\_power}}{\text{plant\_capacity}}$$
    It checks if any plant's normalized output is **under 95% of the cluster's maximum normalized output** (representing a deviation of $>5\%$). If so, it raises a warning **`Irregularity`** alarm.
4.  **Auto-Resolution:**
    Active issues are automatically updated to `Resolved` in subsequent execution ticks if the plant starts reporting telemetry or its normalized output returns to the nominal range.

---

## 6. AUTH & ROLES

### Login Implementation
Authentication is implemented via standard **JSON Web Tokens (JWT)**.
*   Standard logins verify credentials in the database (checking bcrypt hashes with plain-text fallback for developer convenience). It signs a token containing the user ID, email, role, and company ID.
*   A development/bypass endpoint `/api/auth/bypass` exists to sign and return a JWT directly for a given email or role without password verification.
*   Access control is enforced at the API level via [authMiddleware.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/middleware/authMiddleware.js) which validates the `Bearer <token>` Authorization header.

### Roles in Code
Only three roles are defined and supported in the code:
1.  **`SUPER_ADMIN`:** Full access to audit logs, company creation, variables, and global statistics.
2.  **`ADMIN`:** Can manage users/staff under their company, onboard website credentials, manually trigger scrapers, and configure inverter tables.
3.  **`MANAGEMENT`:** Has read-only access to dashboards, graphs, alerts, and historical data exports.

### Discrepancy vs. `ui.md` / `Feature_workflow.md`
*   **Technician Role is Missing:** `ui.md` (Section 3) documents a **Technician** role with interactive tickets, defects tabs, checklists, resolution modals, and remote inverter resets. **This role and its views do not exist in the code.**

---

## 7. FRONTEND

### Existing and Rendering Components
The React application mounts the following views:
*   [RoleSelector.jsx](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/src/features/auth/components/RoleSelector.jsx): Login portal screen containing standard credentials input form and bypass buttons.
*   [Sidebar.jsx](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/src/components/layout/Sidebar.jsx) & [TopBanner.jsx](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/src/components/layout/TopBanner.jsx): Global navigation and header with live-scrolling telemetry banner.
*   [SuperAdminApp.jsx](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/src/app/roles/superadmin/SuperAdminApp.jsx): Super Admin control panel (audit logs, companies list, company variables editor, onboarding form).
*   [AdminApp.jsx](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/src/app/roles/admin/AdminApp.jsx): Administrator dashboard containing the active plants grid, staff management tables, string inverter configurations, and detailed plant sub-tabs (live telemetry, historical CSV export, active incidents, hardware).
*   [ManagementApp.jsx](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/src/app/roles/management/ManagementApp.jsx): Read-only view of plant details, historical queries, and active incidents.

### Built vs. Documented Roles
*   **Built:** `SUPER_ADMIN`, `ADMIN`, `MANAGEMENT` dashboards.
*   **Just Documented:** `TECHNICIAN` (Defects, Panel detailed popups, Vaul drawers, and maintenance tickets are completely unbuilt).

---

## 8. GAPS BETWEEN DOCS AND CODE

1.  **Technician Views are Completely Missing:** Section 3 of `ui.md` detailing Technician features is absent.
2.  **Missing Libraries:** `ui.md` claims Radix UI, Vaul, and Zod are used for UI drawers, tooltips, and schemas. In reality, none of these are in `package.json` (custom HTML elements, CSS, and basic validation are used instead).
3.  **No React Router Routes:** Although `react-router-dom` is declared as a dependency, the app uses in-memory React state for routing.
4.  **Cosmetic Scrapers:** Docs mention Huawei, SolarEdge, Growatt, Sungrow, FoxESS. Working code only exists for Solis, Solax, and Polycab.
5.  **Database Discrepancies:** `db.md` misses the `plant_tables` and `company_variables` tables, omits 9 telemetry columns, and uses PascalCase naming instead of snake_case.
6.  **Cosmetic Auth Pages:** `Feature_workflow.md` specifies a "Forget Password" page. In `RoleSelector.jsx`, the button simply triggers a browser `alert()` stating that default passwords are set to "password".

---

## 9. WHAT'S GENUINELY WORKING END-TO-END RIGHT NOW

### Mock / Fallback Mode (100% Genuinely Functional)
If the backend PostgreSQL database is offline or unreachable on boot, `dbService.js` catches the connection error and switches to LocalStorage fallback.
*   Seeds static records from `excel_data.json` into LocalStorage.
*   Allows login bypass (clicking the dev panel buttons) to access Super Admin, Admin, or Management views.
*   **App.jsx maintains a background loop running every 30 seconds** that executes `runSimulationTick()`. This updates telemetry metrics using a bell-curve generation formula, degrades string table voltages, and randomly spawns incidents/alerts that display dynamically on the React dashboard.
*   Any CRUD operations (adding companies, staff, or string tables) successfully write to and persist in the browser's LocalStorage.

### Live Mode (Partially Functional - Operational Risks)
If the Express backend is booted and mapped to PostgreSQL:
*   JWT authentication and role-based data filtering (multi-tenancy) work correctly.
*   The cron scheduler ticks every minute and queues scrape jobs.
*   **CRITICAL WORKFLOW BREAKPOINT:** The scraper worker scripts in [worker.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/worker.js) and [scraperRunner.js](file:///c:/Users/Rohit/OneDrive/Documents/Solar_dashboard/solar-scada-app/backend/src/services/scraperRunner.js) contain a hardcoded reference to a directory outside the repository:
    ```javascript
    const SCRAPER_DIR = path.resolve(__dirname, '../../../../solar_scrapping');
    ```
    If the folder `solar_scrapping` and its nested scripts (`update_irradiance.js`, `credentials.json`, `solar_data.json`) do not exist at that specific path on the local drive, **scraping and PostgreSQL synchronization will crash with file-not-found errors**, raising critical `ScrapeFailure` alarms in the database.
*   Playwright requires system browser dependencies. If `npx playwright install` is not executed in the server environment, the workers will crash on launch.
