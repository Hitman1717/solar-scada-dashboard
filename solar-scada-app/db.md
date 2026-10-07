# Solar SCADA Dashboard Database Design

## 1. Company

Purpose:
Stores all companies onboarded by the Super Admin.

Columns:
---------
id (PK)
company_name
address
contact_person
contact_email
contact_phone
status
created_at
updated_at

Relationship:
One Company → Many Plants
One Company → Many Users

------------------------------------------------------------

## 2. Users

Purpose:
Stores login information for all users.

Columns:
---------
id (PK)
company_id (FK -> Company.id)
name
email
password
role
is_active
last_login
created_at
updated_at

Roles:
------
SUPER_ADMIN
ADMIN
MANAGEMENT

Relationship:
One Company → Many Users

------------------------------------------------------------

## 3. Plants

Purpose:
Stores all solar plants belonging to a company.

Columns:
---------
id (PK)
company_id (FK -> Company.id)
plant_name
plant_capacity
location
latitude
longitude
status
commission_date
created_at
updated_at

Relationship:
One Company → Many Plants

------------------------------------------------------------

## 4. PlantUsers

Purpose:
Maps users to plants.

Reason:
- One Admin can access multiple plants.
- One Management user can access multiple plants.
- One Plant can have multiple Admins.
- One Plant can have multiple Management users.

Columns:
---------
user_id (FK -> Users.id)
plant_id (FK -> Plants.id)

Primary Key:
------------
(user_id, plant_id)

------------------------------------------------------------

## 5. WebsiteProviders

Purpose:
Stores all supported websites from which telemetry is scraped.

Columns:
---------
id (PK)
provider_name
login_url
description
created_at

Example:
--------
SolarEdge
Growatt
Huawei
Sungrow
FoxESS

------------------------------------------------------------

## 6. WebsiteAccounts

Purpose:
Stores website login credentials for each plant.

Columns:
---------
id (PK)
plant_id (FK -> Plants.id)
provider_id (FK -> WebsiteProviders.id)
username
password
scrape_interval_minutes
enabled
last_scraped_at
created_at
updated_at

Example:
--------
Plant A
SolarEdge
abc@gmail.com
*******
Every 5 minutes

------------------------------------------------------------

## 7. Telemetry

Purpose:
Stores all live telemetry data collected by the scraper.

Columns:
---------
id (PK)
plant_id (FK -> Plants.id)
timestamp

power
voltage
current
frequency

daily_generation
total_generation

temperature

status

raw_json (optional)

created_at

Note:
-----
This table will become very large.
Every scrape inserts one new row.

------------------------------------------------------------

## 8. PlantIssues

Purpose:
Stores alarms/issues detected from telemetry.

Columns:
---------
id (PK)
plant_id (FK -> Plants.id)
telemetry_id (FK -> Telemetry.id, Nullable)

issue_type
severity

message

status

started_at
resolved_at

created_at

Example Issue Types:
--------------------
Communication Lost
Plant Offline
Grid Failure
Low Generation
High Temperature
Inverter Fault

------------------------------------------------------------

## 9. AuditLogs (Recommended)

Purpose:
Tracks every important action performed in the system.

Columns:
---------
id (PK)
user_id (FK -> Users.id)

action

entity_type

entity_id

created_at

Example:
---------
Created Plant
Updated Website Password
Changed Scrape Interval
Assigned Plant
Removed User
Created Company

------------------------------------------------------------