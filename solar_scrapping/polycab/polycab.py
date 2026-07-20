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
EXCEL_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "solar_data.xlsx"))

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
                    
        # Check if we captured anything and have GroupList
        if "GroupList" not in sheets_data or sheets_data["GroupList"].empty:
            print("\nWARNING: GroupList API response was not captured or was empty!")
            print("Here are all the URLs that were captured:")
            for req in captured_data:
                print(f"- [{req.get('method')}] {req.get('url')}")
            
            # Dump raw requests for inspection
            with open("captured_raw.json", "w", encoding="utf-8") as f:
                json.dump(captured_data, f, indent=4)
            print("All raw captured data dumped to captured_raw.json for debugging.")
            return

        print("Mapping Polycab GroupList data to unified Telemetry schema...")
        df_group = sheets_data["GroupList"]
        new_rows = []
        for _, row in df_group.iterrows():
            plant_name = row.get("GoodsTypeName")
            if not plant_name or pd.isna(plant_name):
                continue
            
            plant_id = get_plant_id(plant_name)
            ts = clean_timestamp(row.get("LastUpdate"))
            
            # Parse status from InverterStatus dict or Light fallback
            status = 'Normal'
            inv_status = row.get("InverterStatus")
            if inv_status and not pd.isna(inv_status):
                try:
                    status_str = str(inv_status).replace("'", '"')
                    status_obj = json.loads(status_str)
                    if status_obj.get("red", 0) > 0:
                        status = 'Offline'
                    elif status_obj.get("yellow", 0) > 0:
                        status = 'Warning'
                    elif status_obj.get("gray", 0) > 0:
                        status = 'Offline'
                except Exception as e:
                    light = row.get("Light")
                    if light == 4:
                        status = 'Offline'
                    elif light == 3:
                        status = 'Warning'
            
            # Power in kW (CurrPac is in Watts, divide by 1000)
            power = float(row.get("CurrPac")) / 1000.0 if row.get("CurrPac") is not None and not pd.isna(row.get("CurrPac")) else None
            
            # Daily generation in kWh (EToday is in Wh, divide by 1000)
            daily_gen = float(row.get("EToday")) / 1000.0 if row.get("EToday") is not None and not pd.isna(row.get("EToday")) else None
            
            # Total generation in kWh (ETotal is in Wh, divide by 1000)
            total_gen = float(row.get("ETotal")) / 1000.0 if row.get("ETotal") is not None and not pd.isna(row.get("ETotal")) else None
            
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
                "status": status,
                "raw_json": json.dumps(row.to_dict(), default=str),
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            })

        if new_rows:
            df_new = pd.DataFrame(new_rows)
            df_existing = pd.DataFrame()
            if os.path.exists(EXCEL_FILE):
                try:
                    excel_file = pd.ExcelFile(EXCEL_FILE)
                    if "Telemetry" in excel_file.sheet_names:
                        df_existing = pd.read_excel(EXCEL_FILE, sheet_name="Telemetry")
                except Exception as e:
                    print(f"Warning: Could not read existing Telemetry sheet ({e}).")
            
            if not df_existing.empty:
                df_existing['plant_id'] = df_existing['plant_id'].astype(int)
                df_existing['timestamp'] = df_existing['timestamp'].astype(str)
                df_new['plant_id'] = df_new['plant_id'].astype(int)
                df_new['timestamp'] = df_new['timestamp'].astype(str)
                df_combined = pd.concat([df_existing, df_new], ignore_index=True)
            else:
                df_combined = df_new
                
            # Deduplicate by plant_id and timestamp, keeping the last scrape
            df_combined = df_combined.sort_values(by="timestamp", ascending=False)
            df_combined = df_combined.drop_duplicates(subset=["plant_id", "timestamp"], keep="first")
            df_combined = df_combined.sort_values(by=["timestamp", "plant_id"]).reset_index(drop=True)
            
            # Re-assign id
            df_combined["id"] = df_combined.index + 1
            
            # Ensure columns order
            cols_order = ["id", "plant_id", "timestamp", "power", "voltage", "current", "frequency", 
                          "irradiance", "daily_generation", "total_generation", "temperature", "status", "raw_json", "created_at"]
            for col in cols_order:
                if col not in df_combined.columns:
                    df_combined[col] = None
            df_combined = df_combined[cols_order]
            
            # Write back
            try:
                with pd.ExcelWriter(EXCEL_FILE, engine="openpyxl") as writer:
                    df_combined.to_excel(writer, sheet_name="Telemetry", index=False)
                    
                    plants_data = [{"id": pid, "plant_name": name.upper()} for name, pid in PLANT_MAPPING.items()]
                    df_plants = pd.DataFrame(plants_data).sort_values(by="id")
                    df_plants.to_excel(writer, sheet_name="Plants", index=False)
                print(f"SUCCESS! Telemetry sheet updated. Total {len(df_combined)} rows written.")
            except PermissionError:
                backup = f"solar_data_backup_{int(time.time())}.xlsx"
                print(f"\nERROR: Permission denied when writing to '{EXCEL_FILE}'. Saving to '{backup}' instead.")
                try:
                    with pd.ExcelWriter(backup, engine="openpyxl") as writer:
                        df_combined.to_excel(writer, sheet_name="Telemetry", index=False)
                except Exception as e:
                    print(f"Could not write backup either: {e}")


        
    except Exception as e:
        print(f"\nAn error occurred during scraping: {e}")
    finally:
        print("Closing browser in 5 seconds...")
        time.sleep(5)
        driver.quit()


if __name__ == "__main__":
    main()
