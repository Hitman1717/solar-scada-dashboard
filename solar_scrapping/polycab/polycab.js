const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const LOGIN_URL = "https://pv.polycabmonitoring.com/dist/#/login/index";
const EXCEL_FILE = path.resolve(__dirname, "..", "solar_data.xlsx");
const CREDENTIALS_FILE = path.resolve(__dirname, "..", "credentials.json");

let USERNAME = "oaksun";
let PASSWORD = "Solar@123";

if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
        if (creds.polycab && creds.polycab.username && creds.polycab.password) {
            USERNAME = creds.polycab.username;
            PASSWORD = creds.polycab.password;
            console.log("Loaded Polycab credentials from credentials.json");
        }
    } catch (e) {
        console.error("Warning: Failed to parse credentials.json, using defaults.", e.message);
    }
}

const PLANT_MAPPING = {
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
};

let maxPlantId = 16;
function getPlantId(plantName) {
    const key = String(plantName).trim().toLowerCase();
    if (PLANT_MAPPING[key]) {
        return PLANT_MAPPING[key];
    }
    maxPlantId++;
    PLANT_MAPPING[key] = maxPlantId;
    console.log(`Warning: Dynamic plant mapping created for '${plantName}' -> ID ${maxPlantId}`);
    return maxPlantId;
}

function cleanTimestamp(dateStr) {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    s = s.split('(')[0].trim();
    
    const parts = s.split(' ');
    if (parts.length >= 2) {
        const datePart = parts[0];
        const timePart = parts[1];
        const separators = ['/', '-'];
        for (const sep of separators) {
            if (datePart.includes(sep)) {
                const datePieces = datePart.split(sep);
                if (datePieces.length === 3) {
                    if (datePieces[0].length === 4) {
                        return `${datePieces[0]}-${datePieces[1].padStart(2, '0')}-${datePieces[2].padStart(2, '0')} ${timePart}`;
                    } else {
                        const day = datePieces[0].padStart(2, '0');
                        const month = datePieces[1].padStart(2, '0');
                        const year = datePieces[2];
                        return `${year}-${month}-${day} ${timePart}`;
                    }
                }
            }
        }
    }
    
    try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
        }
    } catch (e) {}
    
    return s;
}

function saveToUnifiedExcel(newRows) {
    let existingRows = [];
    if (fs.existsSync(EXCEL_FILE)) {
        try {
            const workbook = XLSX.readFile(EXCEL_FILE);
            if (workbook.SheetNames.includes('Telemetry')) {
                const worksheet = workbook.Sheets['Telemetry'];
                existingRows = XLSX.utils.sheet_to_json(worksheet);
            }
        } catch (e) {
            console.error(`Warning: Could not read existing Telemetry sheet (${e}).`);
        }
    }

    const combined = [...existingRows, ...newRows];

    combined.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
    });

    const seen = new Set();
    const unique = [];
    for (const record of combined) {
        const key = `${record.plant_id}|||${record.timestamp}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(record);
        }
    }

    unique.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.plant_id - b.plant_id;
    });

    unique.forEach((record, idx) => {
        record.id = idx + 1;
    });

    const colsOrder = ["id", "plant_id", "timestamp", "power", "voltage", "current", "frequency", 
                      "irradiance", "daily_generation", "total_generation", "temperature", "status", "raw_json", "created_at"];
    
    const finalRows = unique.map(r => {
        const row = {};
        for (const col of colsOrder) {
            row[col] = r[col] !== undefined ? r[col] : null;
        }
        return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(finalRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Telemetry');

    const plantsData = Object.entries(PLANT_MAPPING).map(([name, id]) => ({
        id: id,
        plant_name: name.toUpperCase()
    })).sort((a, b) => a.id - b.id);
    const wsPlants = XLSX.utils.json_to_sheet(plantsData);
    XLSX.utils.book_append_sheet(wb, wsPlants, 'Plants');

    try {
        XLSX.writeFile(wb, EXCEL_FILE);
        console.log(`\nSUCCESS! Telemetry updated. Total ${finalRows.length} rows written.`);
    } catch (e) {
        if (e.code === 'EBUSY' || e.message.includes('permission')) {
            const backupFile = `solar_data_backup_${Math.floor(Date.now() / 1000)}.xlsx`;
            console.log(`\nERROR: Permission denied when writing to '${EXCEL_FILE}'. Saving to '${backupFile}' instead.`);
            try {
                XLSX.writeFile(wb, backupFile);
            } catch (backupError) {
                console.error(`Could not write backup file either:`, backupError);
            }
        } else {
            console.error(`Could not write Excel file:`, e);
        }
    }
}

// Targets we want to capture
const TARGET_ENDPOINTS = ["GetMemberData", "getAllAllMember", "GroupList", "MemberMonitor", "logsearch"];

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Intelligently parses the raw JSON response into an array of objects.
 * Handles lists of objects, single objects, or nested structures.
 */
function parseJsonResponse(endpointName, rawResponse) {
    let data;
    try {
        data = JSON.parse(rawResponse);
    } catch (e) {
        console.error(`Failed to parse JSON for ${endpointName}:`, e);
        return [{ "Raw Response": rawResponse }];
    }

    // 1. If it's a list, return it directly
    if (Array.isArray(data)) {
        return data;
    }

    // 2. If it's a dictionary/object
    if (typeof data === 'object' && data !== null) {
        // Look for standard keys containing list data
        const listKeys = ["data", "list", "rows", "results", "members", "groups"];
        for (const key of listKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                return data[key];
            }
        }

        // Check any key containing list of objects
        for (const key of Object.keys(data)) {
            const val = data[key];
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
                return val;
            }
        }

        // If no nested list is found, check if there is a single data dict to flatten
        let targetData = data;
        if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
            targetData = data.data;
        }

        // Convert single dictionary to Key-Value list
        return Object.keys(targetData).map(key => {
            const val = targetData[key];
            const valStr = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
            return { "Field Name": key, "Value": valStr };
        });
    }

    return [{ "Response": String(data) }];
}

/**
 * Preprocesses rows to convert any nested object/array values to JSON strings.
 */
function preprocessData(data) {
    return data.map(row => {
        const cleanRow = {};
        for (const key of Object.keys(row)) {
            const val = row[key];
            if (typeof val === 'object' && val !== null) {
                cleanRow[key] = JSON.stringify(val);
            } else {
                cleanRow[key] = val;
            }
        }
        return cleanRow;
    });
}

async function safeGoto(page, url) {
    try {
        await page.goto(url, { waitUntil: 'load' });
    } catch (e) {
        if (e.message.includes('net::ERR_ABORTED')) {
            console.log(`Navigation to ${url} was aborted, but proceeding...`);
        } else {
            throw e;
        }
    }
}


async function main() {
    console.log("Initializing Puppeteer Chrome browser...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const [page] = await browser.pages();
    const capturedData = {};

    // Enable Network response interception natively in Puppeteer
    page.on('response', async (response) => {
        const url = response.url();
        for (const ep of TARGET_ENDPOINTS) {
            if (url.includes(ep)) {
                try {
                    const text = await response.text();
                    capturedData[ep] = text;
                    console.log(`Captured API response for endpoint: ${ep}`);
                } catch (e) {
                    // Ignore response reading errors (e.g. 204 No Content)
                }
            }
        }
    });

    try {
        console.log(`Navigating to login page: ${LOGIN_URL}`);
        await safeGoto(page, LOGIN_URL);
        await delay(3000);

        console.log("Locating login form elements...");
        await page.waitForSelector('input');
        const inputs = await page.$$('input');
        let usernameField = null;
        let passwordField = null;

        for (const inp of inputs) {
            const typeAttr = await (await inp.getProperty('type')).jsonValue();
            const placeholder = (await (await inp.getProperty('placeholder')).jsonValue() || '').toLowerCase();
            const idAttr = (await (await inp.getProperty('id')).jsonValue() || '').toLowerCase();
            const nameAttr = (await (await inp.getProperty('name')).jsonValue() || '').toLowerCase();

            if (typeAttr === 'password' || placeholder.includes('pass') || idAttr.includes('pass') || nameAttr.includes('pass')) {
                passwordField = inp;
            } else if (typeAttr === 'text' || placeholder.includes('user') || placeholder.includes('member') || placeholder.includes('mail') || idAttr.includes('user') || idAttr.includes('member')) {
                usernameField = inp;
            }
        }

        if (!usernameField || !passwordField) {
            console.log("Could not find input fields dynamically. Trying standard inputs...");
            usernameField = await page.$("input[type='text']");
            passwordField = await page.$("input[type='password']");
        }

        if (!usernameField || !passwordField) {
            throw new Error("Username or Password input fields could not be found.");
        }

        console.log("Entering credentials...");
        await usernameField.click({ clickCount: 3 });
        await usernameField.type(USERNAME);
        await page.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })), usernameField);
        await delay(500);

        await passwordField.click({ clickCount: 3 });
        await passwordField.type(PASSWORD);
        await page.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })), passwordField);
        await delay(500);

        // Find and click login button
        let loginBtn = null;
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = (await page.evaluate(el => el.textContent, btn) || '').toLowerCase();
            if (text.includes('login') || text.includes('log in') || text.includes('sign in') || text.includes('submit')) {
                loginBtn = btn;
                break;
            }
        }

        if (!loginBtn) {
            loginBtn = await page.$("[type='submit']");
        }
        if (!loginBtn) {
            loginBtn = await page.$("button");
        }

        if (!loginBtn) {
            throw new Error("Login button not found.");
        }

        console.log("Clicking login button...");
        await loginBtn.click();

        console.log("Waiting for page transition to dashboard and API requests to complete (10 seconds)...");
        await delay(10000);

        // Navigate to device logs page to trigger logsearch API
        console.log("Navigating to device logs page...");
        await safeGoto(page, "https://pv.polycabmonitoring.com/dist/#/device/logs");
        console.log("Waiting for device logs API requests to complete (8 seconds)...");
        await delay(8000);

        // Navigate to general logs page
        console.log("Navigating to general logs page...");
        await safeGoto(page, "https://pv.polycabmonitoring.com/dist/#/logs");
        console.log("Waiting for general logs API requests to complete (8 seconds)...");
        await delay(8000);

        console.log(`Captured ${Object.keys(capturedData).length} target API responses.`);

        // Separate captured responses by our target endpoints
        const sheetsData = {};
        for (const ep of TARGET_ENDPOINTS) {
            if (capturedData[ep]) {
                const df = parseJsonResponse(ep, capturedData[ep]);
                sheetsData[ep] = df;
            }
        }

        if (!sheetsData["GroupList"] || sheetsData["GroupList"].length === 0) {
            console.log("\nWARNING: GroupList API response was not captured or was empty!");
            fs.writeFileSync("captured_raw.json", JSON.stringify(capturedData, null, 2), "utf8");
            console.log("All raw captured data dumped to captured_raw.json for debugging.");
            return;
        }

        console.log("Mapping Polycab GroupList data to unified Telemetry schema...");
        const dfGroup = sheetsData["GroupList"];
        const newRows = [];
        for (const row of dfGroup) {
            const plantName = row.GoodsTypeName;
            if (!plantName) continue;
            
            const plantId = getPlantId(plantName);
            const ts = cleanTimestamp(row.LastUpdate);
            
            // Parse status from InverterStatus dict or Light fallback
            let status = 'Normal';
            if (row.InverterStatus) {
                try {
                    const statusStr = String(row.InverterStatus).replace(/'/g, '"');
                    const statusObj = JSON.parse(statusStr);
                    if (statusObj.red > 0) status = 'Offline';
                    else if (statusObj.yellow > 0) status = 'Warning';
                    else if (statusObj.gray > 0) status = 'Offline';
                } catch (e) {
                    if (row.Light === 4) status = 'Offline';
                    else if (row.Light === 3) status = 'Warning';
                }
            }
            
            const power = row.CurrPac !== undefined ? parseFloat(row.CurrPac) / 1000.0 : null;
            const dailyGen = row.EToday !== undefined ? parseFloat(row.EToday) / 1000.0 : null;
            const totalGen = row.ETotal !== undefined ? parseFloat(row.ETotal) / 1000.0 : null;
            
            newRows.push({
                plant_id: plantId,
                timestamp: ts,
                power: isNaN(power) ? null : power,
                voltage: null,
                current: null,
                frequency: null,
                irradiance: null,
                daily_generation: isNaN(dailyGen) ? null : dailyGen,
                total_generation: isNaN(totalGen) ? null : totalGen,
                temperature: null,
                status: status,
                raw_json: JSON.stringify(row),
                created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
            });
        }

        if (newRows.length > 0) {
            saveToUnifiedExcel(newRows);
        }

    } catch (e) {
        console.error(`\nAn error occurred during scraping:`, e);
    } finally {
        console.log("Closing browser in 5 seconds...");
        await delay(5000);
        await browser.close();
    }
}

main();
