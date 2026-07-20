import time
import os
import json
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOGIN_URL = "https://www.soliscloud.com/login"
USERNAME = "oaksuncorp"
PASSWORD = "Solar123"
EXCEL_FILE = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "solar_data.xlsx"))

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

# Headless configuration - Set to True if running on a remote server with no screen
HEADLESS = True

def get_first_plant_name_via_js(driver):
    """
    Returns the first plant name from the table inside the iframe using JS.
    """
    js_code = """
    try {
        const iframe = document.querySelector('iframe[name="glyun_vue2"]');
        if (!iframe) return '';
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return '';
        
        const firstRow = doc.querySelector('.el-table__body-wrapper .el-table__row');
        if (firstRow) {
            const cells = firstRow.querySelectorAll('td');
            if (cells.length >= 2) {
                const nameAddr = cells[1].innerText.trim();
                return nameAddr.split('\\n')[0].trim();
            }
        }
    } catch (e) {}
    return '';
    """
    return driver.execute_script(js_code)

def scrape_table_via_js(driver):
    """
    Queries the table rows inside the iframe and returns structured data using JS.
    """
    js_code = """
    try {
        const iframe = document.querySelector('iframe[name="glyun_vue2"]');
        if (!iframe) return [];
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return [];
        
        const rows = doc.querySelectorAll('.el-table__body-wrapper .el-table__row');
        const data = [];
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 10) {
                const status = cells[0].innerText.trim();
                
                // Plant Name & Address
                const nameAddrText = cells[1].innerText.trim();
                const lines = nameAddrText.split('\\n').map(l => l.trim()).filter(l => l);
                const name = lines[0] || '';
                const address = lines[1] || '';
                
                const owner = cells[2].innerText.trim();
                const inverter = cells[3].innerText.trim();
                const dailyYield = cells[4].innerText.trim();
                const totalYield = cells[5].innerText.trim();
                const fullLoadHours = cells[6].innerText.trim();
                const power = cells[7].innerText.trim();
                const pvCapacity = cells[8].innerText.trim();
                
                // Clean Update Time
                let updateTime = cells[9].innerText.trim();
                updateTime = updateTime.replace(/\\(Offline\\)|\\(Online\\)/g, '').trim();
                
                const faultTime = cells[10] ? cells[10].innerText.trim() : '';
                
                data.push({
                    "Plant Status": status,
                    "Plant Name": name,
                    "Address": address,
                    "Owner": owner,
                    "Inverter Online/Total": inverter,
                    "Daily Yield": dailyYield,
                    "Total Yield": totalYield,
                    "Daily Full Load Hours": fullLoadHours,
                    "Power": power,
                    "PV Capacity": pvCapacity,
                    "Update Time": updateTime,
                    "Fault Time": faultTime
                });
            }
        });
        return data;
    } catch (e) {
        return [];
    }
    """
    return driver.execute_script(js_code)

def go_to_page_2_via_js(driver):
    """
    Finds and clicks the page 2 pagination button inside the iframe using JS.
    """
    js_code = """
    try {
        const iframe = document.querySelector('iframe[name="glyun_vue2"]');
        if (!iframe) return false;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return false;
        
        // Find pagination buttons
        const pageBtns = Array.from(doc.querySelectorAll('.el-pager li'));
        const page2Btn = pageBtns.find(btn => btn.innerText.trim() === '2');
        if (page2Btn) {
            page2Btn.click();
            return true;
        }
        
        const nextBtn = doc.querySelector('.btn-next');
        if (nextBtn) {
            nextBtn.click();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
    """
    return driver.execute_script(js_code)

def save_to_excel(new_data, filename):
    new_rows = []
    for row in new_data:
        plant_name = row.get("Plant Name")
        if not plant_name or pd.isna(plant_name):
            continue
            
        plant_id = get_plant_id(plant_name)
        ts = clean_timestamp(row.get("Update Time"))
        
        power = parse_value_with_unit(row.get("Power"))
        daily_gen = parse_value_with_unit(row.get("Daily Yield"))
        total_gen = parse_value_with_unit(row.get("Total Yield"))
        
        new_rows.append({
            "plant_id": int(plant_id),
            "timestamp": str(ts),
            "power": power,
            "voltage": None,
            "current": None,
            "frequency": None,
            "irradiance": None,
            "daily_generation": daily_gen,
            "total_generation": total_gen,
            "temperature": None,
            "status": row.get("Plant Status", "Normal"),
            "raw_json": json.dumps(row, default=str),
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        })
        
    df_new = pd.DataFrame(new_rows)
    
    df_existing = pd.DataFrame()
    if os.path.exists(filename):
        try:
            excel_file = pd.ExcelFile(filename)
            if "Telemetry" in excel_file.sheet_names:
                df_existing = pd.read_excel(filename, sheet_name="Telemetry")
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
        with pd.ExcelWriter(filename, engine="openpyxl") as writer:
            df_combined.to_excel(writer, sheet_name="Telemetry", index=False)
            
            plants_data = [{"id": pid, "plant_name": name.upper()} for name, pid in PLANT_MAPPING.items()]
            df_plants = pd.DataFrame(plants_data).sort_values(by="id")
            df_plants.to_excel(writer, sheet_name="Plants", index=False)
        print(f"SUCCESS! Unified Telemetry sheet updated. Total {len(df_combined)} rows written.")
    except PermissionError:
        backup = os.path.join(os.path.dirname(filename), f"solar_data_backup_{int(time.time())}.xlsx")
        print(f"\nERROR: Permission denied writing to '{filename}'. Saving to backup '{backup}' instead.")
        try:
            with pd.ExcelWriter(backup, engine="openpyxl") as writer:
                df_combined.to_excel(writer, sheet_name="Telemetry", index=False)
        except Exception as e:
            print(f"Could not write backup: {e}")

def main():
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
    all_scraped_data = []
    
    try:
        print(f"Navigating to login page: {LOGIN_URL}")
        driver.get(LOGIN_URL)
        time.sleep(3)
        
        # Locate inputs
        print("Locating credentials input fields...")
        all_inputs = driver.find_elements(By.TAG_NAME, "input")
        username_input = None
        password_input = None
        
        for inp in all_inputs:
            if inp.is_displayed() and inp.is_enabled():
                type_attr = (inp.get_attribute("type") or "").lower()
                placeholder = (inp.get_attribute("placeholder") or "").lower()
                
                if type_attr == "password" or "pass" in placeholder:
                    password_input = inp
                elif type_attr == "text" and ("user" in placeholder or "email" in placeholder or "phone" in placeholder or "account" in placeholder or not placeholder):
                    if "code" not in placeholder and "search" not in placeholder:
                        username_input = inp

        if not username_input:
            print("Fallback: Locating username field by placeholder...")
            for placeholder_text in ["Email/Username", "Email/Username/Phone", "Username", "Email"]:
                try:
                    inp = driver.find_element(By.XPATH, f"//input[@placeholder='{placeholder_text}']")
                    if inp.is_displayed() and inp.is_enabled():
                        username_input = inp
                        break
                except:
                    pass

        if not username_input:
            username_input = driver.find_element(By.XPATH, "//input[@type='text' and not(@disabled) and not(contains(@style, 'display: none'))]")

        if not password_input:
            password_input = driver.find_element(By.XPATH, "//input[@type='password']")
        
        print("Filling credentials...")
        try:
            username_input.clear()
        except Exception as e:
            print(f"Note: could not clear username input: {e}")
        username_input.send_keys(USERNAME)
        time.sleep(0.5)
        
        try:
            password_input.clear()
        except Exception as e:
            print(f"Note: could not clear password input: {e}")
        password_input.send_keys(PASSWORD)
        time.sleep(0.5)
        
        # Agree to terms checkbox click
        print("Clicking terms & agreement checkbox...")
        try:
            checkbox = driver.find_element(By.XPATH, "//span[contains(@class, 'el-checkbox__input')] | //label[contains(., 'Privacy Policy')]")
            checkbox.click()
        except Exception:
            try:
                checkbox_input = driver.find_element(By.XPATH, "//input[@type='checkbox']")
                driver.execute_script("arguments[0].click();", checkbox_input)
            except Exception as e:
                print(f"Warning: Could not check agreement checkbox: {e}")
        time.sleep(0.5)
        
        # Click login button
        print("Clicking Login button...")
        try:
            login_btn = driver.find_element(By.XPATH, "//button[contains(., 'Login') or contains(., 'login')] | //span[contains(text(), 'Login') or contains(text(), 'login')]/.. | //button[@type='submit']")
            login_btn.click()
        except Exception as e:
            print(f"Warning: standard login button click failed: {e}. Trying JavaScript click...")
            try:
                login_btn = driver.find_element(By.XPATH, "//button[contains(., 'Login') or contains(., 'login')] | //span[contains(text(), 'Login') or contains(text(), 'login')]/.. | //button[@type='submit']")
                driver.execute_script("arguments[0].click();", login_btn)
            except Exception as ex:
                raise Exception(f"Could not click Login button: {ex}")
        
        # Wait for redirection to the dashboard
        print("Waiting for dashboard to load...")
        WebDriverWait(driver, 20).until(
            EC.url_contains("/station")
        )
        print("Successfully logged in and reached the dashboard!")
        
        # Wait 10 seconds for initial Vue tables to render inside the iframe
        print("Waiting 10 seconds for table rendering inside iframe...")
        time.sleep(10)
        
        # Scrape Page 1
        print("\n--- Scraping Page 1 ---")
        page_1_data = scrape_table_via_js(driver)
        if page_1_data:
            print(f"Scraped {len(page_1_data)} rows from Page 1.")
            all_scraped_data.extend(page_1_data)
        else:
            print("Failed to scrape Page 1 data.")
        
        # Store the name of the first plant on Page 1 to detect page change
        first_plant_name = page_1_data[0]["Plant Name"] if page_1_data else ""
        
        # Navigate to Page 2
        if go_to_page_2_via_js(driver):
            print("Waiting for Page 2 data to load...")
            if first_plant_name:
                # Poll every 0.5s to see if the first row's plant name changes
                start_time = time.time()
                while time.time() - start_time < 15:
                    current_first_plant = get_first_plant_name_via_js(driver)
                    if current_first_plant and current_first_plant != first_plant_name:
                        print(f"Page 2 loaded! First plant: {current_first_plant}")
                        break
                    time.sleep(0.5)
                else:
                    print("Timed out waiting for Page 2 to load. Falling back to sleep...")
                    time.sleep(3)
            else:
                time.sleep(3)
                
            # Scrape Page 2
            print("\n--- Scraping Page 2 ---")
            page_2_data = scrape_table_via_js(driver)
            if page_2_data:
                print(f"Scraped {len(page_2_data)} rows from Page 2.")
                all_scraped_data.extend(page_2_data)
            else:
                print("Failed to scrape Page 2 data.")
            
        # Save results to Excel
        if all_scraped_data:
            save_to_excel(all_scraped_data, EXCEL_FILE)
        else:
            print("No data was scraped!")
            
    except Exception as e:
        print(f"\nAn error occurred during scraping: {e}")
    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    main()
