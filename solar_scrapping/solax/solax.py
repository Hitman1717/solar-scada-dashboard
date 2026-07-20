import os
import time
import json
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Configuration
LOGIN_URL = "https://www.solaxcloud.com/user-center/"
USERNAME = "oaksun"
PASSWORD = "Oaksun@1006@"
EXCEL_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "solar_data.xlsx"))

# Set to True if running in background without a screen
HEADLESS = True

PLANT_MAPPING = {
    "my space study hall 1": 1,
    "my space study hall": 2,
    "vasudev blue flied site": 3,
    "villa num 111": 4,
    "rv2": 5,
    "rv1": 6,
    "melgiri enterprises house 3": 7,
    "melgiri enterprises": 8,
    "melgiri enterprises house 2": 9,
    "melgiri farm 02": 10,
    "melgiri farms 01": 11,
    "magna villa 15": 12,
    "abhilash reddy incrible hallmark villa no.24": 13,
    "arya vysya anna satram": 14,
    "central university of haryana": 15,
    "magna villa 41": 16
}

def get_plant_id(plant_name):
    key = str(plant_name).strip().lower()
    if key in PLANT_MAPPING:
        return PLANT_MAPPING[key]
    new_id = max(PLANT_MAPPING.values()) + 1 if PLANT_MAPPING else 1
    PLANT_MAPPING[key] = new_id
    print(f"Warning: Dynamic plant mapping created for '{plant_name}' -> ID {new_id}")
    return new_id

def clean_timestamp(date_str):
    if pd.isna(date_str) or not date_str:
        return None
    s = str(date_str).strip()
    s = s.split('(')[0].strip()
    
    parts = s.split(' ')
    if len(parts) >= 2:
        date_part = parts[0]
        time_part = parts[1]
        for sep in ['/', '-']:
            if sep in date_part:
                date_pieces = date_part.split(sep)
                if len(date_pieces) == 3:
                    if len(date_pieces[0]) == 4:
                        return f"{date_pieces[0]}-{date_pieces[1].zfill(2)}-{date_pieces[2].zfill(2)} {time_part}"
                    else:
                        day = date_pieces[0].zfill(2)
                        month = date_pieces[1].zfill(2)
                        year = date_pieces[2]
                        return f"{year}-{month}-{day} {time_part}"
    try:
        dt = pd.to_datetime(s)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except:
        return s

def parse_value_with_unit(val_str):
    if pd.isna(val_str) or val_str is None:
        return None
    s = str(val_str).strip().lower()
    if s == "" or s == "--":
        return None
    
    multiplier = 1.0
    clean = s
    if s.endswith('mwh'):
        multiplier = 1000.0
        clean = s[:-3].strip()
    elif s.endswith('kwh'):
        clean = s[:-3].strip()
    elif s.endswith('wh'):
        multiplier = 0.001
        clean = s[:-2].strip()
    elif s.endswith('kwp'):
        clean = s[:-3].strip()
    elif s.endswith('kw'):
        clean = s[:-2].strip()
    elif s.endswith('w'):
        multiplier = 0.001
        clean = s[:-1].strip()
    elif s.endswith('h'):
        clean = s[:-1].strip()
    elif s.endswith('°c') or s.endswith('c'):
        clean = s[:-2].strip() if s.endswith('°c') else s[:-1].strip()
        
    try:
        return float(clean) * multiplier
    except:
        try:
            return float(clean)
        except:
            return None

def init_driver():
    print("Initializing Chrome browser...")
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    
    if HEADLESS:
        print("Running in headless mode...")
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36")
        
    driver = webdriver.Chrome(options=options)
    return driver

def handle_login(driver):
    print(f"Navigating to login page: {LOGIN_URL}")
    driver.get(LOGIN_URL)
    
    # Wait for input fields to be visible
    wait = WebDriverWait(driver, 15)
    print("Locating credentials input fields...")
    
    # User name field
    username_field = wait.until(
        EC.presence_of_element_located((By.XPATH, "//input[@placeholder='Please enter your user name/email/mobile number']"))
    )
    # Password field
    password_field = wait.until(
        EC.presence_of_element_located((By.XPATH, "//input[@placeholder='Enter Password']"))
    )
    
    # Enter credentials
    print("Entering credentials...")
    username_field.clear()
    username_field.send_keys(USERNAME)
    time.sleep(0.5)
    password_field.clear()
    password_field.send_keys(PASSWORD)
    time.sleep(0.5)
    
    # Find and handle Privacy Agreement checkbox
    print("Checking Privacy Policy agreement checkbox...")
    try:
        # Search for checkbox within the label containing 'Privacy Policy'
        agree_checkbox = driver.find_element(By.XPATH, "//span[contains(text(), 'Privacy Policy') or contains(text(), 'agree to')]/ancestor::label//input[@type='checkbox']")
        if not agree_checkbox.is_selected():
            print("Agreement checkbox not selected, clicking it via JS...")
            driver.execute_script("arguments[0].click();", agree_checkbox)
            time.sleep(0.5)
        else:
            print("Agreement checkbox is already selected.")
    except Exception as e:
        print(f"Warning/Note while checking agreement checkbox: {e}")
        
    # Click Login button
    print("Clicking Login button...")
    login_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//*[contains(@class, 'submit-button') or contains(@class, 'login-btn')]"))
    )
    login_btn.click()
    
    # Wait for dashboard transition
    print("Waiting for page redirect and dashboard load...")
    wait.until(EC.url_contains("/green/#/"))
    print("Login successful!")
    time.sleep(3)

def go_to_plants_page(driver):
    print("Navigating to Plants section...")
    wait = WebDriverWait(driver, 40)
    
    # Find Plants in sidebar and click it
    plants_tab = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//span[text()='Plants']"))
    )
    plants_tab.click()
    
    print("Waiting for Plants table data to load...")
    try:
        # Wait for global progress bar to complete
        wait.until(
            lambda d: "nprogress-busy" not in (d.find_element(By.TAG_NAME, "html").get_attribute("class") or "")
        )
        # Wait for at least one data cell to render
        wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "arco-table-td"))
        )
        time.sleep(3) # Extra render buffer
    except Exception as e:
        print(f"Warning: Timed out waiting for table to load: {e}")

def scrape_plants_table(driver):
    print("Scraping Plants overview table...")
    
    # Inject JavaScript to extract the table columns and rows dynamically
    js_scrape_table = """
    try {
        const headers = Array.from(document.querySelectorAll('.arco-table-th')).map(th => th.innerText.trim().replace(/\\n/g, ' '));
        const rows = document.querySelectorAll('.arco-table-tr');
        const results = [];
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('.arco-table-td'));
            if (cells.length > 0) {
                const rowData = {};
                cells.forEach((cell, idx) => {
                    const header = headers[idx] || `Column_${idx}`;
                    rowData[header] = cell.innerText.trim().replace(/\\n/g, ' ');
                });
                results.push(rowData);
            }
        });
        return results;
    } catch (e) {
        return [];
    }
    """
    table_data = driver.execute_script(js_scrape_table)
    print(f"Found {len(table_data)} plants in the table.")
    return table_data

def scrape_plant_details(driver):
    print("Scraping plant detailed metrics from dashboard...")
    
    # Inject JavaScript to find values associated with specific metric labels dynamically
    js_scrape_details = """
    try {
        const metrics = {};
        const elements = Array.from(document.querySelectorAll('*'));
        
        const findValue = (label) => {
            const candidates = elements.filter(el => {
                const txt = (el.innerText || "").trim().toLowerCase();
                return txt.includes(label.toLowerCase());
            });
            
            if (candidates.length === 0) return "";
            
            // Sort by children count ascending to get the deepest element containing the label first
            candidates.sort((a, b) => a.getElementsByTagName('*').length - b.getElementsByTagName('*').length);
            
            for (const labelEl of candidates) {
                let current = labelEl;
                for (let i = 0; i < 4; i++) {
                    if (!current) break;
                    const text = current.innerText;
                    const match = text.match(/(\\d+(?:\\.\\d+)?)\\s*(kWh|kWp|kW|%)/i);
                    if (match) {
                        return match[0];
                    }
                    current = current.parentElement;
                }
            }
            return "";
        };
        
        metrics['Daily solar'] = findValue('Daily solar');
        metrics['Daily consumption'] = findValue('Daily consumption');
        metrics['PV Capacity'] = findValue('PV Capacity');
        metrics['PV Power'] = findValue('PV Power');
        metrics['Imported energy'] = findValue('Imported energy today') || findValue('Imported energy');
        
        return metrics;
    } catch (e) {
        return {};
    }
    """
    details = driver.execute_script(js_scrape_details)
    print(f"Scraped details: {details}")
    return details

def save_to_excel(df_new):
    print(f"Saving data to Excel file: {EXCEL_FILE}")
    
    df_existing = pd.DataFrame()
    if os.path.exists(EXCEL_FILE):
        try:
            excel_file = pd.ExcelFile(EXCEL_FILE)
            if "Telemetry" in excel_file.sheet_names:
                df_existing = pd.read_excel(EXCEL_FILE, sheet_name="Telemetry")
        except Exception as e:
            print(f"Warning: Could not read existing Excel file ({e}).")
            
    if not df_existing.empty:
        df_existing['plant_id'] = df_existing['plant_id'].astype(int)
        df_existing['timestamp'] = df_existing['timestamp'].astype(str)
        df_new['plant_id'] = df_new['plant_id'].astype(int)
        df_new['timestamp'] = df_new['timestamp'].astype(str)
        df_combined = pd.concat([df_existing, df_new], ignore_index=True)
    else:
        df_combined = df_new
        
    # Deduplicate rows by plant_id and timestamp
    df_combined = df_combined.sort_values(by="timestamp", ascending=False)
    df_combined = df_combined.drop_duplicates(subset=["plant_id", "timestamp"], keep="first")
    df_combined = df_combined.sort_values(by=["timestamp", "plant_id"]).reset_index(drop=True)
    
    # Re-assign id
    df_combined["id"] = df_combined.index + 1
    
    # Ensure correct columns order
    cols_order = ["id", "plant_id", "timestamp", "power", "voltage", "current", "frequency", 
                  "irradiance", "daily_generation", "total_generation", "temperature", "status", "raw_json", "created_at"]
    for col in cols_order:
        if col not in df_combined.columns:
            df_combined[col] = None
    df_combined = df_combined[cols_order]
    
    try:
        with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl") as writer:
            df_combined.to_excel(writer, sheet_name="Telemetry", index=False)
            
            plants_data = [{"id": pid, "plant_name": name.upper()} for name, pid in PLANT_MAPPING.items()]
            df_plants = pd.DataFrame(plants_data).sort_values(by="id")
            df_plants.to_excel(writer, sheet_name="Plants", index=False)
        print(f"SUCCESS! Unified Telemetry sheet updated. Total {len(df_combined)} rows written.")
    except PermissionError:
        backup = os.path.join(os.path.dirname(EXCEL_FILE), f"solar_data_backup_{int(time.time())}.xlsx")
        print(f"\nERROR: Permission denied writing to '{EXCEL_FILE}'. Saving to backup '{backup}' instead.")
        try:
            with pd.ExcelWriter(backup, engine="openpyxl") as writer:
                df_combined.to_excel(writer, sheet_name="Telemetry", index=False)
        except Exception as e:
            print(f"Could not write backup: {e}")

def main():
    driver = init_driver()
    all_rows = []
    
    try:
        # 1. Log in
        handle_login(driver)
        
        # 2. Navigate to Plants page
        go_to_plants_page(driver)
        
        # 3. Scrape main plants list table
        plants = scrape_plants_table(driver)
        if not plants:
            print("ERROR: No plants data found. Exiting.")
            return
            
        scrape_time = time.strftime("%Y-%m-%d %H:%M:%S")
        
        # 4. Loop through each plant to collect detailed page metrics
        for index, plant in enumerate(plants):
            plant_name = plant.get("Plant Name", "").strip()
            if not plant_name:
                # Handle cases where header might be slightly different
                plant_name = plant.get(list(plant.keys())[0], "").strip()
                
            print(f"\n[{index+1}/{len(plants)}] Processing plant: '{plant_name}'")
            
            # Click on the plant link
            print(f"Navigating to plant details for '{plant_name}'...")
            original_windows = driver.window_handles[:]
            
            # Locate plant link dynamically using text match
            plant_link = WebDriverWait(driver, 15).until(
                EC.element_to_be_clickable((By.XPATH, f"//table//tr//td[contains(., '{plant_name}')]//*[text()='{plant_name}'] | //*[text()='{plant_name}']"))
            )
            
            # Click it
            driver.execute_script("arguments[0].click();", plant_link)
            time.sleep(3) # Initial short sleep for tab to open
            
            # Handle new tab or same tab navigation
            new_windows = driver.window_handles
            opened_in_new_tab = len(new_windows) > len(original_windows)
            
            if opened_in_new_tab:
                new_tab = [w for w in new_windows if w not in original_windows][0]
                driver.switch_to.window(new_tab)
            
            # Wait for details page to render by waiting for nprogress-busy loading to complete
            print("Waiting for plant details page to finish loading...")
            try:
                # Wait for the HTML tag to no longer have class 'nprogress-busy'
                WebDriverWait(driver, 25).until(
                    lambda d: "nprogress-busy" not in (d.find_element(By.TAG_NAME, "html").get_attribute("class") or "")
                )
                # Wait for 'PV Power' label to be present
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.XPATH, "//*[text()='PV Power' or contains(text(), 'PV Power')]"))
                )
                time.sleep(4) # Sleep 4 seconds to ensure dynamic numeric values populate
            except Exception as e:
                print(f"Warning: Timed out waiting for details page elements: {e}")
                
            # Scrape detailed metrics
            details = scrape_plant_details(driver)
            
            # Close detail window if opened in new tab, or navigate back
            if opened_in_new_tab:
                driver.close()
                driver.switch_to.window(original_windows[0])
            else:
                print("Navigating back to Plants overview page...")
                driver.get("https://global.solaxcloud.com/green/#/plant/index")
                time.sleep(4)
                
            # Compile merged row data
            row_data = {
                "plant_id": int(get_plant_id(plant_name)),
                "timestamp": str(clean_timestamp(scrape_time)),
                "power": parse_value_with_unit(details.get("PV Power") or plant.get("PV Capacity(kWp)") or plant.get("PV Capacity")),
                "voltage": None,
                "current": None,
                "frequency": None,
                "irradiance": None,
                "daily_generation": parse_value_with_unit(details.get("Daily solar") or plant.get("Daily Yield(kWh)") or plant.get("Daily Yield")),
                "total_generation": None,
                "temperature": None,
                "status": plant.get("Plant Status", "Normal"),
                "raw_json": json.dumps({**plant, **details}, default=str),
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            all_rows.append(row_data)
            
        # 5. Export compiled dataset to Excel
        if all_rows:
            df = pd.DataFrame(all_rows)
            save_to_excel(df)
            
    except Exception as e:
        print(f"\nAn error occurred during scraping: {e}")
        try:
            print(f"Current URL at error: {driver.current_url}")
        except Exception:
            pass
        import traceback
        traceback.print_exc()
        try:
            screenshot_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "error_screenshot.png")
            driver.save_screenshot(screenshot_path)
            print(f"Saved error screenshot to: {screenshot_path}")
        except Exception as se:
            print(f"Could not save screenshot: {se}")
    finally:
        print("\nClosing Chrome browser...")
        driver.quit()

if __name__ == "__main__":
    main()
