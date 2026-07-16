import time
import json
import os
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service

# Configuration
LOGIN_URL = "https://pv.polycabmonitoring.com/dist/#/login/index"
USERNAME = "oaksun"
PASSWORD = "Solar@123"
EXCEL_FILE = "solar_data.xlsx"

# Targets we want to capture
TARGET_ENDPOINTS = ["GetMemberData", "getAllAllMember", "GroupList", "MemberMonitor", "logsearch"]

def inject_xhr_hook(driver):
    """
    Injects a script into the page to intercept and record all future XMLHttpRequest 
    and fetch requests, saving their URLs, request bodies, and responses.
    """
    hook_script = """
    window.capturedRequests = window.capturedRequests || [];
    
    // Hook XMLHttpRequest
    if (!window.xhrHooked) {
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url) {
            this._url = url;
            this._method = method;
            return originalXHROpen.apply(this, arguments);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            this.addEventListener('load', function() {
                try {
                    window.capturedRequests.push({
                        url: this._url,
                        method: this._method,
                        requestBody: body,
                        response: this.responseText,
                        status: this.status,
                        type: 'xhr'
                    });
                } catch (e) {
                    console.error("Error capturing XHR:", e);
                }
            });
            return originalXHRSend.apply(this, arguments);
        };
        window.xhrHooked = true;
        console.log("XHR Interceptor Hooked.");
    }
    
    // Hook fetch
    if (!window.fetchHooked) {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const response = await originalFetch(...args);
            const clone = response.clone();
            try {
                const text = await clone.text();
                window.capturedRequests.push({
                    url: args[0],
                    method: (args[1] && args[1].method) || 'GET',
                    requestBody: args[1] && args[1].body,
                    response: text,
                    status: response.status,
                    type: 'fetch'
                });
            } catch (e) {
                console.error("Error capturing fetch:", e);
            }
            return response;
        };
        window.fetchHooked = true;
        console.log("Fetch Interceptor Hooked.");
    }
    """
    driver.execute_script(hook_script)

def parse_json_response(endpoint_name, raw_response):
    """
    Intelligently parses the raw JSON response into a Pandas DataFrame.
    Can handle lists of dictionaries, single objects (profile data), or nested structures.
    """
    try:
        data = json.loads(raw_response)
    except Exception as e:
        print(f"Failed to parse JSON for {endpoint_name}: {e}")
        return pd.DataFrame({"Raw Response": [raw_response]})

    # 1. If it's a list, load it directly
    if isinstance(data, list):
        return pd.DataFrame(data)

    # 2. If it's a dictionary
    if isinstance(data, dict):
        # Look for standard keys containing list data
        for list_key in ["data", "list", "rows", "results", "members", "groups"]:
            if list_key in data and isinstance(data[list_key], list):
                if len(data[list_key]) > 0:
                    return pd.DataFrame(data[list_key])
        
        # Check any key containing list of dicts
        for key, val in data.items():
            if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                return pd.DataFrame(val)
                
        # If no nested list is found, check if there is a single data dict to flatten
        if "data" in data and isinstance(data["data"], dict):
            data = data["data"]
            
        # Convert single dictionary to Key-Value DataFrame
        keys = list(data.keys())
        values = list(data.values())
        # Convert any dict/list values to strings for cleaner display in Excel
        values_str = [json.dumps(v) if isinstance(v, (dict, list)) else v for v in values]
        return pd.DataFrame({"Field Name": keys, "Value": values_str})

    return pd.DataFrame({"Response": [str(data)]})

def main():
    print("Initializing Chrome browser...")
    # Set up Chrome options
    options = webdriver.ChromeOptions()
    # We run in normal mode so you can see Chrome logging in and loading the dashboard
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    
    # Initialize the Chrome driver (Selenium 4 manages chromedriver automatically)
    driver = webdriver.Chrome(options=options)
    
    try:
        print(f"Navigating to login page: {LOGIN_URL}")
        driver.get(LOGIN_URL)
        time.sleep(3) # Wait for page structure to load
        
        print("Injecting network request interceptor hooks...")
        inject_xhr_hook(driver)
        
        # Find username, password, and login button dynamically
        print("Locating login form elements...")
        username_field = None
        password_field = None
        
        inputs = driver.find_elements(By.TAG_NAME, "input")
        for inp in inputs:
            type_attr = inp.get_attribute("type")
            placeholder = (inp.get_attribute("placeholder") or "").lower()
            id_attr = (inp.get_attribute("id") or "").lower()
            name_attr = (inp.get_attribute("name") or "").lower()
            
            if type_attr == "password" or "pass" in placeholder or "pass" in id_attr or "pass" in name_attr:
                password_field = inp
            elif type_attr == "text" or "user" in placeholder or "member" in placeholder or "mail" in placeholder or "user" in id_attr or "member" in id_attr:
                username_field = inp

        if not username_field or not password_field:
            print("Could not find input fields dynamically. Trying standard inputs...")
            # Fallback
            username_field = driver.find_element(By.XPATH, "//input[@type='text']")
            password_field = driver.find_element(By.XPATH, "//input[@type='password']")

        # Enter credentials
        print("Entering credentials...")
        username_field.clear()
        username_field.send_keys(USERNAME)
        time.sleep(0.5)
        password_field.clear()
        password_field.send_keys(PASSWORD)
        time.sleep(0.5)
        
        # Find and click login button
        login_btn = None
        buttons = driver.find_elements(By.TAG_NAME, "button")
        for btn in buttons:
            text = (btn.text or "").lower()
            if "login" in text or "log in" in text or "sign in" in text or "submit" in text:
                login_btn = btn
                break
                
        if not login_btn:
            # Fallback
            login_btn = driver.find_element(By.XPATH, "//*[@type='submit'] | //button")

        print("Clicking login button...")
        login_btn.click()
        
        # Inject hook again in case navigation/SPA routing cleared it (normally not in SPAs but safe-keeping)
        time.sleep(2)
        inject_xhr_hook(driver)
        
        print("Waiting for page transition to dashboard and API requests to complete (10 seconds)...")
        for i in range(10):
            time.sleep(1)
            # Re-inject the hook script periodically to catch late-loading elements
            try:
                inject_xhr_hook(driver)
            except:
                pass
                
        # Navigate to logs page to trigger the logsearch API
        print("Navigating to device logs page...")
        driver.get("https://pv.polycabmonitoring.com/dist/#/device/logs")
        time.sleep(2)
        inject_xhr_hook(driver)
        
        print("Waiting for device logs API requests to complete (8 seconds)...")
        for i in range(8):
            time.sleep(1)
            try:
                inject_xhr_hook(driver)
            except:
                pass
                
        # Also navigate to generic logs page just in case
        print("Navigating to general logs page...")
        driver.get("https://pv.polycabmonitoring.com/dist/#/logs")
        time.sleep(2)
        inject_xhr_hook(driver)
        
        print("Waiting for general logs API requests to complete (8 seconds)...")
        for i in range(8):
            time.sleep(1)
            try:
                inject_xhr_hook(driver)
            except:
                pass
                
        print("Retrieving captured network requests...")
        captured_data = driver.execute_script("return window.capturedRequests || [];")
        print(f"Captured {len(captured_data)} API requests total.")
        
        # Separate captured responses by our target endpoints
        sheets_data = {}
        for req in captured_data:
            url_str = str(req.get("url", ""))
            response_text = req.get("response", "")
            
            # Find if this URL contains any of our target endpoint names
            for ep in TARGET_ENDPOINTS:
                if ep in url_str:
                    print(f"Found request match: {ep} (Type: {req.get('type')}, Status: {req.get('status')})")
                    df = parse_json_response(ep, response_text)
                    # Save the latest response if multiple are found
                    sheets_data[ep] = df
                    
        # Check if we captured anything
        if not sheets_data:
            print("\nWARNING: None of the target API responses were captured!")
            print("Here are all the URLs that were captured:")
            for req in captured_data:
                print(f"- [{req.get('method')}] {req.get('url')}")
            
            # Dump raw requests for inspection
            with open("captured_raw.json", "w", encoding="utf-8") as f:
                json.dump(captured_data, f, indent=4)
            print("All raw captured data dumped to captured_raw.json for debugging.")
            return

        # Read existing sheets if the file exists to append/merge data
        existing_sheets = {}
        if os.path.exists(EXCEL_FILE):
            print(f"Found existing file '{EXCEL_FILE}'. Reading current sheets to append new data...")
            try:
                excel_file = pd.ExcelFile(EXCEL_FILE)
                for sheet in excel_file.sheet_names:
                    existing_sheets[sheet] = pd.read_excel(EXCEL_FILE, sheet_name=sheet)
            except Exception as e:
                print(f"Warning: Could not read existing Excel file ({e}). Will create a new one.")

        # Combine new data with existing data
        final_sheets = {}
        for ep_name, df_new in sheets_data.items():
            sheet_name = ep_name[:31]
            
            # We ONLY append/merge for MemberMonitor and GroupList
            if sheet_name in ["MemberMonitor", "GroupList"] and sheet_name in existing_sheets:
                df_old = existing_sheets[sheet_name]
                print(f"Merging new data with existing rows for sheet '{sheet_name}'...")
                
                # Combine old and new DataFrames
                df_combined = pd.concat([df_old, df_new], ignore_index=True)
                
                # Ensure nested dicts/lists are converted to strings so they are hashable for deduplication
                try:
                    for col in df_combined.columns:
                        if df_combined[col].apply(lambda x: isinstance(x, (dict, list))).any():
                            df_combined[col] = df_combined[col].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)
                except Exception as e:
                    print(f" - Warning during column cleaning: {e}")
                
                # Drop exact duplicate rows
                try:
                    initial_len = len(df_combined)
                    df_combined = df_combined.drop_duplicates().reset_index(drop=True)
                    duplicates_removed = initial_len - len(df_combined)
                    if duplicates_removed > 0:
                        print(f" - Removed {duplicates_removed} duplicate rows.")
                except Exception as e:
                    print(f" - Warning: Could not drop duplicates: {e}")
                
                final_sheets[sheet_name] = df_combined
            else:
                # For logsearch, GetMemberData, and getAllAllMember, we overwrite (use df_new directly)
                print(f"Overwriting data for sheet '{sheet_name}' with new capture...")
                try:
                    for col in df_new.columns:
                        if df_new[col].apply(lambda x: isinstance(x, (dict, list))).any():
                            df_new[col] = df_new[col].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)
                except:
                    pass
                final_sheets[sheet_name] = df_new

        # Preserve any sheets that exist in the file but weren't in the new capture
        for sheet_name, df_old in existing_sheets.items():
            if sheet_name not in final_sheets:
                final_sheets[sheet_name] = df_old

        # Write all sheets back to the Excel file
        print(f"\nWriting merged data to {EXCEL_FILE}...")
        try:
            with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl") as writer:
                for sheet_name, df in final_sheets.items():
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
                    print(f" - Sheet '{sheet_name}': Total {len(df)} rows written.")
            print(f"\nSUCCESS! Scraping complete. Excel file '{EXCEL_FILE}' updated successfully.")
        except PermissionError:
            backup_file = f"solar_data_backup_{int(time.time())}.xlsx"
            print(f"\nERROR: Permission denied when writing to '{EXCEL_FILE}'.")
            print(f"Is the Excel file open in another program (like Microsoft Excel)?")
            print(f"Saving data to backup file '{backup_file}' instead to protect your scraped data.")
            try:
                with pd.ExcelWriter(backup_file, engine="openpyxl") as writer:
                    for sheet_name, df in final_sheets.items():
                        df.to_excel(writer, sheet_name=sheet_name, index=False)
                print(f"Backup file '{backup_file}' saved successfully! Please close '{EXCEL_FILE}' before running next time.")
            except Exception as e:
                print(f"Could not write backup file either: {e}")


        
    except Exception as e:
        print(f"\nAn error occurred during scraping: {e}")
    finally:
        print("Closing browser in 5 seconds...")
        time.sleep(5)
        driver.quit()


if __name__ == "__main__":
    main()
