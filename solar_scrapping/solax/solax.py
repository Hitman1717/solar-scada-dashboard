import os
import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Configuration
LOGIN_URL = "https://www.solaxcloud.com/user-center/"
USERNAME = "oaksun"
PASSWORD = "Oaksun@1006@"
EXCEL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "solar_data.xlsx")

# Set to True if running in background without a screen
HEADLESS = True

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
    
    if os.path.exists(EXCEL_FILE):
        print("Reading existing Excel data to merge...")
        try:
            df_old = pd.read_excel(EXCEL_FILE)
            df_combined = pd.concat([df_old, df_new], ignore_index=True)
        except Exception as e:
            print(f"Warning: Could not read existing Excel file ({e}). Writing fresh.")
            df_combined = df_new
    else:
        df_combined = df_new
        
    # Deduplicate rows by Plant Name and Scrape Time
    initial_count = len(df_combined)
    df_combined = df_combined.drop_duplicates(subset=["Plant Name", "Scrape Time"], keep="last").reset_index(drop=True)
    duplicates_removed = initial_count - len(df_combined)
    if duplicates_removed > 0:
        print(f"Removed {duplicates_removed} duplicate rows.")
        
    try:
        df_combined.to_excel(EXCEL_FILE, index=False)
        print(f"SUCCESS! Total {len(df_combined)} rows written to '{EXCEL_FILE}'.")
    except PermissionError:
        backup = os.path.join(os.path.dirname(EXCEL_FILE), f"solar_data_backup_{int(time.time())}.xlsx")
        print(f"\nERROR: Permission denied writing to '{EXCEL_FILE}'. Is it open in Excel?")
        print(f"Saving data to backup file '{backup}' instead to prevent data loss.")
        df_combined.to_excel(backup, index=False)

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
                "Scrape Time": scrape_time,
                "Plant Name": plant_name,
                "Plant Type": plant.get("Plant Type", ""),
                "Plant Status": plant.get("Plant Status", ""),
                "Grid Status": plant.get("Grid Status", ""),
                "User Name": plant.get("User Name", ""),
                "Country/Region": plant.get("Country/Region", ""),
                "Location": plant.get("Location", ""),
                "Zip Code": plant.get("Zip Code", ""),
                "Service Provider": plant.get("Service Provider", ""),
                "Overview PV Capacity": plant.get("PV Capacity(kWp)", "") or plant.get("PV Capacity", ""),
                "Overview Battery Capacity": plant.get("Battery Capacity(kWh)", "") or plant.get("Battery Capacity", ""),
                "Overview Daily Yield": plant.get("Daily Yield(kWh)", "") or plant.get("Daily Yield", ""),
                "Overview Charged Today": plant.get("Charged Today(kWh)", "") or plant.get("Charged Today", ""),
                "Overview Discharged Today": plant.get("Discharged Today(kWh)", "") or plant.get("Discharged Today", ""),
                "Detailed Daily Solar": details.get("Daily solar", ""),
                "Detailed Daily Consumption": details.get("Detailed Daily Consumption", "") or details.get("Daily consumption", ""),
                "Detailed PV Capacity": details.get("PV Capacity", ""),
                "Detailed PV Power": details.get("PV Power", ""),
                "Detailed Imported Energy": details.get("Imported energy", "")
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
