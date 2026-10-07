# MSLogic Solar SCADA Platform: UI Architecture & Component Documentation

This document provides a comprehensive extraction and specification of the user interface (UI) components, layouts, pages, and interactive states of the **Solar Panel SCADA Solutions** application. 

The application is structured as a multi-role, responsive dashboard built with **React**, **React Router**, **TailwindCSS**, **Recharts** (for data visualizations), and **Radix UI/Vaul** (for accessible tooltips and drawers).

---

## Table of Contents
1. [Landing & Authentication (Role Selector)](#1-landing--authentication-role-selector)
2. [Global Layout Components](#2-global-layout-components)
3. [Technician Dashboard](#3-technician-dashboard)
4. [Management Dashboard](#4-management-dashboard)
5. [Admin Dashboard](#5-admin-dashboard)
6. [Super Admin Dashboard](#6-super-admin-dashboard)
7. [Design Tokens & UI Styles](#7-design-tokens--ui-styles)

---

## 1. Landing & Authentication (Role Selector)
**File Location:** [RoleSelector.jsx](file:///c:/Users/Rohit/OneDrive/Documents/SOLARPANELS_MSL/src/features/auth/components/RoleSelector.jsx)

The authentication system operates in two visual modes: a welcome screen and a detailed credentials form. It acts as the routing gateway based on user roles.

### A. Welcome Screen Mode
- **Layout:** Centered card interface styled with a soft gray background (`#f8fafc`).
- **Elements:**
  - **MSLogic Logo:** Top-centered branding image (`/logo.webp`).
  - **Platform Title:** `Solar Panel SCADA Solutions` styled in a bold, prominent blue (`#2563eb`).
  - **Login Call-to-Action:** A rounded-full button with a gold border (`#d4af37`), gold text (`#b8860b`), and a shield icon (`Shield` from `lucide-react`). On hover, it transitions to a light amber background (`#fffbeb`).
  - **Copyright Footer:** Sticky bottom copyright label (`© 2025 Microsyslogic. All rights reserved.`) in muted slate gray.

### B. Form Input Mode
- **Layout:** Sleek card outline with light borders (`border-slate-100`) containing a structured vertical form.
- **Fields & Controls:**
  - **Company Name Input:** Text field with full width, thin borders, and a shadow-sm effect.
  - **Email Address Input:** Standard text field with helper placeholder `Enter your email address`.
  - **Password Input:** Password field containing a toggleable show/hide button (`Eye` / `EyeOff` icons) absolute-positioned on the right.
  - **Category (Role) Select:** A dropdown select field containing options:
    - `Select category` (Default validation fallback)
    - `Technician`
    - `Admin`
    - `Mgmt.`
  - **Keep me signed in:** Small checkbox paired with a label.
  - **Submit Button:** Full-width bold blue button (`#1e3a8a`, hover: `#172554`) labeled `OK`.
- **Validation Rules (Zod Schema):**
  - Company Name must be $\ge 2$ characters.
  - Email/Login must be $\ge 2$ characters.
  - Password must be $\ge 4$ characters.
  - **Super Admin Bypass:** If the typed email or company name is `msl` (case-insensitive), category selection requirements are bypassed, routing directly to the **Super Admin** dashboard (`/superadmin`). Otherwise, standard validation requires selecting a valid category.

---

## 2. Global Layout Components

Once authenticated, users are routed to a dashboard wrapped in a standard master-detail split layout consisting of a **TopBanner** and a **Sidebar**.

### A. Top Banner
**File Location:** [TopBanner.jsx](file:///c:/Users/Rohit/OneDrive/Documents/SOLARPANELS_MSL/src/components/layout/TopBanner.jsx)

A multi-tiered header banner containing global status and navigation options.

- **Primary Tier (Top Bar - Dark Blue `#1e3a8a`):**
  - **Mobile Menu Button:** A hamburger menu icon (`Menu`) visible only on mobile screens to toggle the sidebar drawer.
  - **Plant Label:** Displays the active plant name or branding prefix (e.g., `UTL | Chennai 3MW Plant` or `MSL Management`).
  - **User Role Label:** Displays the logged-in role in capitalized blue-accented text.
  - **Logout Button:** Rounded white button (`#0f172a` text, hover: `#f1f5f9` background) with a `LogOut` icon. Clicking triggers a custom confirmation modal.
- **Secondary Tier (Telemetry Feed - Darker Blue `#1e3a8a` / `#1e3a8a` border - Visible only to Technician & Management):**
  - A horizontal, scroll-friendly bar providing real-time feed metrics:
    - **Status:** Nominal status flag with a pulsing green indicator.
    - **Generation (MW):** Displays active generated power (e.g., `2.41 MW`).
    - **Faults:** Red-highlighted count of currently active critical faults.
    - **Today Yield (MWh):** Dynamically calculated yield (calculated as $\text{livePower} \times 5.145$).
- **Logout Confirmation Modal:**
  - Standard backdrop blur overlay (`bg-slate-900/40 backdrop-blur-sm`).
  - Warning card displaying an `AlertTriangle` icon, warning text, and action buttons (`Cancel` vs. `Log Out` styled in warning red).

### B. Sidebar Navigation
**File Location:** [Sidebar.jsx](file:///c:/Users/Rohit/OneDrive/Documents/SOLARPANELS_MSL/src/components/layout/Sidebar.jsx)

A fixed left navigation sidebar on desktop (`w-56`), converting to a sliding drawer panel on mobile layout.

- **Status & Info Headers:**
  - **Plant Dropdown:** Present only for Admin & Management roles, allowing on-the-fly switching between available plants (e.g., `Chennai 3MW Plant`, `Mumbai 1000kW Plant`, `Hyderabad 5MW Plant`).
  - **System Online Indicator:** Blinking green status dot (`animate-ping`) confirming SCADA connectivity.
  - **Digital Clock:** Real-time clock displaying localized time in Indian Standard Time (`IST`, `Asia/Kolkata` zone).
- **Navigation Tabs (Role-Based Routing):**
  - **Technician:** Panel Data, Defects, Tickets (with badge counter for open tickets).
  - **Management:** Panel Data, Power Gen, Graphs, Defects, Tickets (with badge counter).
  - **Admin:** Plants, Staff, Tables.
  - **Super Admin:** Monitor, Onboard, Panel Models, Inverters, Admin Access.

---

## 3. Technician Dashboard
**File Location:** [TechnicianApp.jsx](file:///c:/Users/Rohit/OneDrive/Documents/SOLARPANELS_MSL/src/app/roles/technician/TechnicianApp.jsx)

Tailored for hands-on diagnostics and ticket resolution in the field.

### A. Monitor Tab (Panel Data View)
Displays real-time telemetry metrics and panel status.
- **KPI Metrics Cards (Grid of 4):**
  1. **Open Faults (Blue):** Count of tickets not in 'Closed' status.
  2. **Critical (Red):** Open Ground Fault tickets.
  3. **Moderate (Amber):** Open tickets with non-ground-fault anomalies (e.g., Dirty Surface, Overheating).
  4. **Resolved (Green):** Count of tickets marked resolved or closed.
- **Search and Filter Bar:** Search input by Table/Panel ID with instant query-filter buttons (`All`, `Moderate`, `Bad`).
- **Telemetry Grid:** Renders a list of solar string tables.
  - **Table View Card:** Displays Table ID (e.g. `T-081`), Average Efficiency ratio (`% EFF` styled dynamically by value: red $< 80\%$, amber $< 90\%$, gray $\ge 90\%$), and total panels.
  - **Panel Card (Cell):** Individual vertical cell buttons. Color represents status:
    - **Healthy:** Bright blue (`bg-blue-400`).
    - **Moderate Degraded:** Amber (`bg-amber-500`).
    - **Critical / Bad:** Flashing warning red (`bg-red-600 animate-pulse`).
    - **Tooltip Popover:** Radix Tooltip showing Panel ID, Status, Voltage (V), Current (A), Temperature (°C), and Power Loss (%).
- **Panel Details Drawer:**
  - Slide-out panel (powered by Vaul) showing diagnostics: Voltage, Current, Temperature, and Power Loss.
  - Status checklists (Inverter Link, Ground Isolation, Surface Condition).
  - **Performance Line Chart:** A Recharts line graph showing historical power output performance.
  - **Interactive Actions:** `Remote Inverter Reset` (Action Button) and `Log Service Request`.

### B. Defects Tab (Defects View)
Provides power loss calculations.
- **Loss Statistics Summary Cards:** Expected Amperage, Actual Amperage, Energy Lost (kW), and Loss Ratio (%).
- **Defects Table:** Columns: Table, Expected A, Actual A, Tracking ID, Duration (hours active), and Loss (kW). Row borders are color-accented (red for Critical/Ground Fault, amber for Moderate).

### C. Tickets Tab (Tickets View)
- **Active Tickets Table:** Columns for Ticket ID, Table, Category (Bad/Moderate), Duration (Hrs), Status, and Action.
- **Action Workflow:**
  - Status: `Open` $\rightarrow$ click `Start Progress` $\rightarrow$ status changes to `In Progress`.
  - Status: `In Progress` $\rightarrow$ click `Resolve` $\rightarrow$ opens **Resolution Modal**.
  - **Resolution Modal:** Allows selected categorization (e.g., Loose Cable, Broken Connector, Dust, Damage, Scratches) and text comments. Clicking submit changes status to `Resolved`.
  - **Auto-Close:** If a ticket is marked `Resolved`, a 3-second background timer automatically transitions the ticket to `Closed`, triggering a toast confirmation ("Panel health verified. Tickets closed automatically.").

---

## 4. Management Dashboard
**File Location:** [ManagementApp.jsx](file:///c:/Users/Rohit/OneDrive/Documents/SOLARPANELS_MSL/src/app/roles/management/ManagementApp.jsx)

Provides high-level analytical tools and reports for plant oversight.

### A. Power Gen Tab (Power Generation Analysis)
- **Date Selector Form:** Start Date & End Date calendars with a "Get Report" query action.
- **Metrics Displays:** Actual Power (Green box) and Power Loss (Red box) computed dynamically based on tickets logged during the range.

### B. Graphs Tab (Performance Analysis Graphs)
- **Time Filters:** Toggle bar for `Today`, `Past Week`, `Past Month`, `3 Months`, and `Custom` (triggers modal to choose start/end dates).
- **Executive Summary KPIs:** Yield (MW), Performance Ratio (%), Active Alarms, Peak Thermal Loss (W).
- **Sub-Tab Visualizations:**
  1. **Power Curve Yield:** Multi-line chart (Blue line = Expected Yield, Orange line = Actual Yield).
  2. **Thermal Degradation:** Bar chart correlating temperature brackets (e.g., 25-35°C, 35-45°C) to Average Power Loss (W).
  3. **Loss Pareto Breakdown:** A red bar chart showing the frequency and impact of defect categories (Dirty Surface, Voltage Drop, Overheating, Ground Fault, Communication Error).
  4. **Health Distribution:** Pie chart dividing the plant panels into Healthy (Green), Moderate (Amber), and Bad (Red) states, with an adjacent details table.

### C. Defects Tab (Defects Report View)
- An advanced query generator allowing filters by Date Range, Category (All/Bad/Moderate), and Ticket Status (All/Open/In Progress/Resolved/Closed).
- **Results Table:** Pulls a list of all matching tickets with columns: Ticket ID, Table ID, Category, Loss, Created Date, and Status.

---

## 5. Admin Dashboard
**File Location:** [AdminApp.jsx](file:///c:/Users/Rohit/OneDrive/Documents/SOLARPANELS_MSL/src/app/roles/admin/AdminApp.jsx)

Enables administrative management of plants, staff members, and infrastructure tables.

### A. Plants Tab (Your Plants)
- Grid layout displaying cards for all plants managed by the administrator.
- **Card Contents:** Plant name, admin email, country/location, operational status, installation date, and shortcut buttons to navigate directly to the **Staff** or **Tables** tabs.

### B. Staff Tab (Staff Management)
- **Tab 1: Existing Staff:**
  - Search bar to filter staff profiles.
  - Team Table: Columns for Company, Staff Name, Role badge (Technician, Mgmt, Admin), Email, Phone Number, Status (Active pulsing dot), and Joined Date.
  - Action tray (enabled when a row is clicked): `Edit Details`, `Delete Entry`, `Reset Password`.
- **Tab 2: Add Staff Form:**
  - Form containing: Login/Email, Phone Number, Role Category dropdown, and Plant Access dropdown (disabled for Admin role).

### C. Tables Tab (Infrastructure Management)
- **Tab 1: View Tables & Panels:**
  - Summary metrics: Active plant power (kW) and total tables.
  - Table: Columns for Table Number, Panels Count, Panel Model, Inverter Model, Gateway ID, Degrade %, Age (yr), Table Power (W), and a delete option (`Remove`).
- **Tab 2: Add New Table Form:**
  - Fields: Table Number, Number of Panels (max 20), Panel Model, Inverter Model.
  - Hardware Assignment Section: Gateway ID, Table MAC Address, Table Power (W), Degrade %, and Panel Age.

---

## 6. Super Admin Dashboard
**File Location:** [SuperAdminApp.jsx](file:///c:/Users/Rohit/OneDrive/Documents/SOLARPANELS_MSL/src/app/roles/superadmin/SuperAdminApp.jsx)

The master administration console for system-wide control and onboarding.

### A. Monitor Tab (Registered Companies)
- **List View:** Cards for each onboarded client company detailing company name, admin email, plants count, users count, online nodes, and status (Active/Suspended).
- **Detailed View (on click):** Slides open to show admin email, phone, office address, created date, and quick stats (Plants, Users, Online Nodes) with Edit and Delete options.

### B. Onboard Tab (Onboard New Client)
- **Onboarding Form:** Fields for Company Name, Email ID, Phone, Office Address, and Notes.
- **Plant Configurations:** Dynamic list allowing the creation of multiple plant blocks. Each block can configure the Plant Name, Power Capacity (kW/MW), and assign specific Plant Admins (with custom emails/passwords).
- **Provisioning Screen:** Once submitted, displays an interactive loading animation simulating server processes:
  - Phase 1: `Allocating Dedicated Cloud Space...` (25% progress)
  - Phase 2: `Creating Base SQL Tables...` (50% progress)
  - Phase 3: `Configuring Cloud Permissions...` (75% progress)
  - Phase 4: `Generating Admin Account...` (100% progress)
- **Success Screen:** Displays a checkmark confirming configuration details have been emailed.

### C. Panel Models Tab
- Catalog lists for registered solar panel specifications showing manufacturers, models, $P_{max}$, $V_{oc}$, $I_{sc}$, $V_{mp}$, and $I_{mp}$ values with Edit/Delete buttons.

### D. Inverters Tab
- Catalog of inverter configurations listing manufacturer, model, MPPT count, maximum nodes support, maximum node power capacity, and total capacity.

### E. Admin Access Tab
- Lists platform Super Admin accounts and provides an unblock tray to unblock locked administrator accounts.

---

## 7. Design Tokens & UI Styles

### Colors
- **Primary Blues:** `#1e3a8a` (Navy Blue), `#2563eb` (Royal Blue), `#f0f7ff` (Light Blue background), `#bfd4f2` (Accent Blue).
- **Status Indicators:**
  - **Healthy/Nominal:** Green (`#16a34a` / `#emerald-650`).
  - **Moderate Degraded:** Amber/Yellow (`#d97706` / `#amber-500`).
  - **Bad/Critical:** Red (`#dc2626` / `#red-600`).
- **Grays:** `#f8fafc` (Background Slate), `#e2e8f0` (Borders), `#64748b` (Muted text).

### Typography
- Font family: `font-sans` (System UI default, Inter/Outfit styled).
- Monospace styling (`font-mono`) is utilized for numeric values (voltages, current, yield, capacity, IDs) to ensure alignment.

### Custom Scrollbars
- Styled thin scrollbars (`width: 6px`) with translucent sliders (`rgba(0, 0, 0, 0.05)` changing to `rgba(0, 0, 0, 0.1)` on hover) to preserve layout width on scrollable elements.
