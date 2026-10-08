# Solar Plant Manager

## Overview

**Solar Plant Manager** is a role-based web application used to monitor solar plants by collecting telemetry data from multiple solar monitoring websites. The system supports three user roles:

* **Super Admin**
* **Admin**
* **Management**

The application follows Role-Based Access Control (RBAC), ensuring every user can access only the features and plants assigned to them.

---

# Authentication

## Login Page

A simple role-based login page.

### Fields

* Company Name
* Email
* Password
* Login Button
* Forget Password

### Features

* Validate credentials.
* Identify user role after successful login.
* Redirect user to the appropriate dashboard.
* Display error message for invalid credentials.

---

# User Roles

## 1. Super Admin

### Responsibilities

* Onboard new companies.
* Manage company information.
* Assign company administrators.
* View all registered companies.

---

## Sidebar

```
Dashboard
Companies
Onboard Company
Profile
Logout
```

---

## Companies Page

Displays all onboarded companies.

### Company Information

* Company Name
* Contact Person
* Contact Email
* Contact Number
* Number of Plants
* Number of Users
* Status
* Created Date

### Actions

* View Company
* Edit Company
* Delete Company
* Search Company
* Filter by Status

---

## Onboard Company Page

Create a new company.

### Fields

* Company Name
* Address
* Contact Person
* Contact Email
* Contact Number

### Admin Details

* Admin Name
* Admin Email
* Password

### Actions

* Save Company
* Cancel

---

# 2. Admin

The Admin manages plants, website credentials, and monitors plant telemetry.

---

## Sidebar

```
Dashboard
Plants
Manage Accounts
Profile
Logout
```

---

# Dashboard

Displays a quick overview of all assigned plants.

### Cards

* Total Plants
* Online Plants
* Offline Plants
* Active Alerts
* Total Generation Today
* Current Power Generation

---

# Plants Page

Displays every plant assigned to the logged-in admin.

### Table Columns

* Plant Name
* Plant Capacity
* Location
* Website Provider
* Current Power
* Daily Generation
* Plant Status
* Last Updated

### Actions

* View
* Edit
* Delete

### Features

* Search Plant
* Filter by Status
* Sort by Name
* Sort by Capacity
* Pagination

---

# Plant Details Page

This page contains complete information about a selected plant.

---

## Plant Information

* Plant Name
* Plant Capacity
* Plant Location
* Commission Date
* Website Provider
* Scrape Interval
* Last Scraped Time
* Current Status

---

## Live Telemetry

Display latest telemetry values.

Example:

* Current Power
* Today's Generation
* Total Generation
* Voltage
* Current
* Frequency
* Temperature
* Plant Status
* Last Updated Timestamp

---

## Historical Data

Display telemetry history.

Features

* Date Filter
* Time Filter
* Export CSV

---

## Alerts / Issues

Display all detected issues.

Example

* Communication Lost
* Plant Offline
* Grid Failure
* High Temperature
* Low Generation
* Inverter Fault

Columns

* Issue
* Severity
* Start Time
* End Time
* Status

---

## Website Account Details

Display scraping configuration.

Fields

* Website Provider
* Username
* Scrape Interval
* Last Successful Scrape
* Account Status

Actions

* Edit Website Credentials
* Change Password
* Change Scrape Interval
* Enable Scraping
* Disable Scraping

---

## Plant Actions

* Edit Plant
* Delete Plant
* Refresh Data
* View Telemetry History

---

# Manage Accounts

Manage users belonging to the company.

### Display

* Name
* Email
* Role
* Assigned Plants
* Status

### Actions

* Add User
* Edit User
* Delete User
* Activate User
* Deactivate User
* Assign Plants
* Remove Plant Access
* Reset Password

---

## Add User

Fields

* Name
* Email
* Password
* Role

Role

* Admin
* Management

Assign Plants

* Multi-select Plants

---

# Profile

Display logged-in user's profile.

Fields

* Name
* Email
* Company
* Role

Actions

* Change Password
* Update Profile

---

# 3. Management

Management users have **read-only** access.

They cannot modify any data.

---

## Sidebar

```
Dashboard
Plants
Profile
Logout
```

---

# Dashboard

Display

* Total Assigned Plants
* Online Plants
* Offline Plants
* Total Generation Today
* Active Alerts

---

# Plants

Displays assigned plants.

### Actions

* View

No Edit.

No Delete.

No Add.

---

# Plant Details

Management users can view:

## Plant Information

* Plant Name
* Capacity
* Location
* Website Provider
* Status

---

## Live Telemetry

* Current Power
* Daily Generation
* Total Generation
* Voltage
* Current
* Frequency
* Temperature
* Last Updated

---

## Alerts

View only.

No modification allowed.

---

## Historical Data

View only.

Date filters available.

---

# Profile

View profile.

Change password.

Update profile information.

---

# General Features

## Search

* Search Plants
* Search Users
* Search Companies

---

## Filters

* Plant Status
* Company
* Website Provider

---

## Export

* Export Telemetry as CSV
* Export Plant Report

---

## Notifications

* Plant Offline
* Communication Failure
* Scraping Failed
* High Temperature
* Low Generation

---

## Audit

Record important actions such as:

* Company Created
* Plant Added
* Plant Deleted
* User Added
* User Removed
* Website Credentials Updated
* Scrape Interval Changed

---

# Workflow

## Super Admin Workflow

```
Login
    ↓
Companies
    ↓
Onboard Company
    ↓
Create Company
    ↓
Create Company Admin
    ↓
Admin Receives Credentials
```

---

## Admin Workflow

```
Login
    ↓
Dashboard
    ↓
Manage Accounts (Optional)
    ↓
Create Admin / Management Users
    ↓
Assign Plants
    ↓
Open Plant
    ↓
View Live Telemetry
    ↓
View Alerts
    ↓
Update Website Credentials
    ↓
Modify Plant Information
```

---

## Management Workflow

```
Login
    ↓
Dashboard
    ↓
Plants
    ↓
Select Plant
    ↓
View Live Data
    ↓
View Historical Data
    ↓
View Alerts
```

---

# Permission Matrix

| Feature                    | Super Admin | Admin | Management |
| -------------------------- | ----------- | :---: | :--------: |
| Login                      | ✓           |   ✓   |      ✓     |
| View Dashboard             | ✓           |   ✓   |      ✓     |
| Manage Companies           | ✓           |   ✗   |      ✗     |
| Onboard Company            | ✓           |   ✗   |      ✗     |
| View Plants                | ✓           |   ✓   |      ✓     |
| Add Plant                  | ✗           |   ✓   |      ✗     |
| Edit Plant                 | ✗           |   ✓   |      ✗     |
| Delete Plant               | ✗           |   ✓   |      ✗     |
| View Plant Telemetry       | ✓           |   ✓   |      ✓     |
| Manage Website Credentials | ✗           |   ✓   |      ✗     |
| Manage User Accounts       | ✗           |   ✓   |      ✗     |
| Assign Plants              | ✗           |   ✓   |      ✗     |
| View Alerts                | ✓           |   ✓   |      ✓     |
| Export Reports             | ✓           |   ✓   |      ✓     |
| Update Profile             | ✓           |   ✓   |      ✓     |
| Change Password            | ✓           |   ✓   |      ✓     |
| Logout                     | ✓           |   ✓   |      ✓     |
