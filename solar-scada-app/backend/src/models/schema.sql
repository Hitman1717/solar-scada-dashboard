
DROP TABLE IF EXISTS company_variables, audit_logs, plant_issues, telemetry, plant_tables, website_accounts, website_providers, plant_users, plants, users, companies CASCADE;

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, ADMIN, MANAGEMENT
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plants (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    plant_name VARCHAR(255) NOT NULL,
    plant_capacity VARCHAR(100),
    location VARCHAR(255),
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    status VARCHAR(50) DEFAULT 'Normal',
    commission_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plant_users (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, plant_id)
);

CREATE TABLE IF NOT EXISTS website_providers (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(255) UNIQUE NOT NULL,
    oem_key VARCHAR(100) UNIQUE,
    login_url VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_accounts (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES website_providers(id) ON DELETE RESTRICT,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    scrape_interval_minutes INTEGER DEFAULT 5,
    enabled BOOLEAN DEFAULT TRUE,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plant_tables (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    table_number VARCHAR(100) NOT NULL,
    panels_count INTEGER DEFAULT 10,
    panel_model VARCHAR(255),
    inverter_model VARCHAR(255),
    gateway_id VARCHAR(100),
    mac_address VARCHAR(100),
    degrade_pct NUMERIC(5, 2) DEFAULT 0,
    age_years NUMERIC(5, 2) DEFAULT 0,
    power_w NUMERIC(10, 2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS telemetry (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    present_power NUMERIC(10, 2) DEFAULT 0.00,
    voltage NUMERIC(10, 2) DEFAULT 0.00,
    current NUMERIC(10, 2) DEFAULT 0.00,
    frequency NUMERIC(10, 2) DEFAULT 0.00,
    daily_generation NUMERIC(10, 2) DEFAULT 0.00,
    total_generation NUMERIC(15, 2) DEFAULT 0.00,
    temperature NUMERIC(5, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Normal',
    irradiance NUMERIC(10, 2) DEFAULT 0.00,
    plant_type VARCHAR(50) DEFAULT 'Residential',
    grid_status VARCHAR(50) DEFAULT 'On-grid',
    battery_voltage NUMERIC(10, 2) DEFAULT 0.00,
    daily_charge NUMERIC(10, 2) DEFAULT 0.00,
    daily_discharge NUMERIC(10, 2) DEFAULT 0.00,
    daily_consumed NUMERIC(10, 2) DEFAULT 0.00,
    imported_energy NUMERIC(10, 2) DEFAULT 0.00,
    raw_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plant_issues (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    telemetry_id INTEGER REFERENCES telemetry(id) ON DELETE SET NULL,
    issue_type VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    message TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Extra table for dynamic company variables from custom scrapped websites
CREATE TABLE IF NOT EXISTS company_variables (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    variable_name VARCHAR(255) NOT NULL,
    variable_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
