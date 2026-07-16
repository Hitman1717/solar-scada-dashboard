import time
import os
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
EXCEL_FILE = os.path.join(SCRIPT_DIR, "solar_data.xlsx")

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
    """
    Appends new data to the existing excel file and deduplicates rows.
    """
    df_new = pd.DataFrame(new_data)
    
    # Check if file exists to read and append
    if os.path.exists(filename):
        print(f"Found existing excel file '{filename}'. Reading and appending new data...")
        try:
            df_existing = pd.read_excel(filename)
            df_combined = pd.concat([df_existing, df_new], ignore_index=True)
        except Exception as e:
            print(f"Warning: Could not read existing file ({e}). Starting fresh.")
            df_combined = df_new
    else:
        print(f"No existing file found. Creating new file '{filename}'...")
        df_combined = df_new
        
    # Deduplicate rows by Plant Name and Update Time (keeping the latest scrape)
    initial_count = len(df_combined)
    df_combined = df_combined.drop_duplicates(subset=["Plant Name", "Update Time"], keep="last").reset_index(drop=True)
    duplicates_removed = initial_count - len(df_combined)
    
    if duplicates_removed > 0:
        print(f"Removed {duplicates_removed} duplicate rows.")
        
    # Save back to Excel
    try:
        df_combined.to_excel(filename, index=False)
        print(f"Successfully saved {len(df_combined)} total rows to '{filename}'.")
    except PermissionError:
        backup = f"solar_data_backup_{int(time.time())}.xlsx"
        print(f"\nERROR: Permission denied when writing to '{filename}'.")
        print("Is the Excel file currently open in another program?")
        print(f"Saving data to backup file '{backup}' instead to prevent data loss.")
        df_combined.to_excel(backup, index=False)
        print(f"Backup file '{backup}' saved successfully.")

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
