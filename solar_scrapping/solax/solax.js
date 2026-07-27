const puppeteer = require('puppeteer');
// const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const LOGIN_URL = "https://www.solaxcloud.com/user-center/";
const JSON_FILE = path.resolve(__dirname, "..", "solar_data.json");
const CREDENTIALS_FILE = path.resolve(__dirname, "..", "credentials.json");

let USERNAME = "oaksun";
let PASSWORD = "Oaksun@1006@";

if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
        if (creds.solax && creds.solax.username && creds.solax.password) {
            USERNAME = creds.solax.username;
            PASSWORD = creds.solax.password;
            console.log("Loaded Solax credentials from credentials.json");
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

// Universal parser for numbers with units
function parseValueWithUnit(valStr) {
    if (valStr === undefined || valStr === null) return null;
    const s = String(valStr).trim().toLowerCase();
    if (s === '' || s === '--') return null;
    
    let multiplier = 1;
    let clean = s;
    if (s.endsWith('mwh')) {
        multiplier = 1000;
        clean = s.slice(0, -3).trim();
    } else if (s.endsWith('kwh')) {
        clean = s.slice(0, -3).trim();
    } else if (s.endsWith('wh')) {
        multiplier = 0.001;
        clean = s.slice(0, -2).trim();
    } else if (s.endsWith('kwp')) {
        clean = s.slice(0, -3).trim();
    } else if (s.endsWith('kw')) {
        clean = s.slice(0, -2).trim();
    } else if (s.endsWith('w')) {
        multiplier = 0.001;
        clean = s.slice(0, -1).trim();
    } else if (s.endsWith('h')) {
        clean = s.slice(0, -1).trim();
    } else if (s.endsWith('°c') || s.endsWith('c')) {
        clean = s.endsWith('°c') ? s.slice(0, -2).trim() : s.slice(0, -1).trim();
    }
    const val = parseFloat(clean);
    return isNaN(val) ? null : val * multiplier;
}

// Set to true to run in headless mode
const HEADLESS = true;

const delay = ms => new Promise(res => setTimeout(res, ms));

async function safeGoto(page, url) {
    try {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    } catch (e) {
        if (e.message.includes('net::ERR_ABORTED') || e.message.includes('Timeout') || e.message.includes('timeout')) {
            console.log(`Navigation to ${url} timed out or aborted (${e.message}), but proceeding...`);
        } else {
            throw e;
        }
    }
}

async function handleLogin(page) {
    console.log(`Navigating to login page: ${LOGIN_URL}`);
    await safeGoto(page, LOGIN_URL);
    await delay(3000);

    console.log("Locating credentials input fields...");
    const usernameField = await page.waitForSelector("xpath///input[@placeholder='Please enter your user name/email/mobile number']", { timeout: 20000 });
    const passwordField = await page.waitForSelector("xpath///input[@placeholder='Enter Password']", { timeout: 20000 });

    console.log("Entering credentials...");
    await usernameField.click({ clickCount: 3 });
    await usernameField.type(USERNAME);
    await page.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })), usernameField);
    await delay(500);

    await passwordField.click({ clickCount: 3 });
    await passwordField.type(PASSWORD);
    await page.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })), passwordField);
    await delay(500);

    console.log("Checking Privacy Policy agreement checkbox...");
    try {
        const checkbox = await page.waitForSelector("xpath///span[contains(text(), 'Privacy Policy') or contains(text(), 'agree to')]/ancestor::label//input[@type='checkbox']", { timeout: 5000 });
        const isChecked = await page.evaluate(el => el.checked, checkbox);
        if (!isChecked) {
            console.log("Agreement checkbox not selected, clicking it...");
            await page.evaluate(el => el.click(), checkbox);
            await delay(500);
        } else {
            console.log("Agreement checkbox is already selected.");
        }
    } catch (e) {
        console.log(`Warning/Note while checking agreement checkbox: ${e.message}`);
    }

    console.log("Clicking Login button...");
    const loginBtn = await page.waitForSelector("xpath///*[contains(@class, 'submit-button') or contains(@class, 'login-btn')]", { visible: true, timeout: 15000 });
    await loginBtn.click();

    console.log("Waiting for page redirect and dashboard load...");
    await page.waitForFunction(() => window.location.href.includes('/green/#/'), { timeout: 30000 });
    console.log("Login successful!");
    await delay(3000);
}

async function goToPlantsPage(page) {
    console.log("Navigating to Plants section...");
    const plantsTab = await page.waitForSelector("xpath///span[text()='Plants']", { timeout: 40000 });
    await plantsTab.click();

    console.log("Waiting for Plants table data to load...");
    try {
        await page.waitForFunction(() => !document.documentElement.classList.contains('nprogress-busy'), { timeout: 40000 });
        await page.waitForSelector('.arco-table-td', { timeout: 20000 });
        await delay(3000); // Extra render buffer
    } catch (e) {
        console.log(`Warning: Timed out waiting for table to load: ${e.message}`);
    }
}

async function scrapePlantsTable(page) {
    console.log("Scraping Plants overview table...");
    return await page.evaluate(() => {
        try {
            const headers = Array.from(document.querySelectorAll('.arco-table-th')).map(th => th.innerText.trim().replace(/\n/g, ' '));
            const rows = document.querySelectorAll('.arco-table-tr');
            const results = [];
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('.arco-table-td'));
                if (cells.length > 0) {
                    const rowData = {};
                    cells.forEach((cell, idx) => {
                        const header = headers[idx] || `Column_${idx}`;
                        rowData[header] = cell.innerText.trim().replace(/\n/g, ' ');
                    });
                    results.push(rowData);
                }
            });
            return results;
        } catch (e) {
            return [];
        }
    });
}

async function scrapePlantDetails(page) {
    console.log("Scraping plant detailed metrics from dashboard...");
    return await page.evaluate(() => {
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
                        const match = text.match(/(\d+(?:\.\d+)?)\s*(kWh|kWp|kW|%)/i);
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
    });
}

function saveToJson(newRows) {
    console.log(`Saving data to JSON file: ${JSON_FILE}`);
    let existingRows = [];
    let plantsData = [];

    if (fs.existsSync(JSON_FILE)) {
        try {
            const fileData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
            existingRows = fileData.telemetry || [];
        } catch (e) {
            console.error(`Warning: Could not read existing Telemetry from JSON (${e.message}).`);
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

    const scrapedPlantIds = new Set(finalRows.map(r => r.plant_id));
    plantsData = Object.entries(PLANT_MAPPING)
        .map(([name, id]) => ({
            id: id,
            plant_name: name.toUpperCase()
        }))
        .filter(p => scrapedPlantIds.has(p.id))
        .sort((a, b) => a.id - b.id);

    const exportData = {
        plants: plantsData,
        telemetry: finalRows
    };

    try {
        fs.writeFileSync(JSON_FILE, JSON.stringify(exportData, null, 2), 'utf8');
        console.log(`\nSUCCESS! Telemetry updated. Total ${finalRows.length} rows written.`);
    } catch (e) {
        console.error(`Could not write JSON file:`, e);
    }
}

async function main() {
    console.log("Initializing Puppeteer Chrome browser...");
    const browser = await puppeteer.launch({
        headless: HEADLESS,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    const [page] = await browser.pages();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");

    const allRows = [];

    try {
        // 1. Log in
        await handleLogin(page);

        // 2. Navigate to Plants page
        await goToPlantsPage(page);

        // 3. Scrape main plants list table
        const plants = await scrapePlantsTable(page);
        if (!plants || plants.length === 0) {
            throw new Error("No plants data found in the overview table.");
        }
        console.log(`Found ${plants.length} plants in the table.`);

        // Format scrape time
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const scrapeTime = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;

        // 4. Loop through each plant to collect detailed page metrics
        for (let i = 0; i < plants.length; i++) {
            const plant = plants[i];
            let plantName = (plant["Plant Name"] || "").trim();
            if (!plantName) {
                plantName = (plant[Object.keys(plant)[0]] || "").trim();
            }

            console.log(`\n[${i + 1}/${plants.length}] Processing plant: '${plantName}'`);
            console.log(`Navigating to plant details for '${plantName}'...`);

            // Listen for new tab open
            const newTargetPromise = new Promise(resolve => browser.once('targetcreated', target => resolve(target.page())));

            const plantLink = await page.waitForSelector(`xpath///table//tr//td[contains(., "${plantName}")]//*[text()="${plantName}"] | //*[text()="${plantName}"]`, { timeout: 15000 });
            await page.evaluate(el => el.click(), plantLink);

            // Wait for new tab or check if it loaded in the same tab
            let detailPage = page;
            let openedInNewTab = false;
            const newPage = await Promise.race([
                newTargetPromise,
                delay(3000).then(() => null)
            ]);

            if (newPage) {
                detailPage = newPage;
                openedInNewTab = true;
                console.log("Opened in a new tab.");
            } else {
                console.log("Did not open in a new tab (same tab navigation).");
            }

            console.log("Waiting for plant details page to finish loading...");
            try {
                // Wait for loading indicator
                await detailPage.waitForFunction(() => !document.documentElement.classList.contains('nprogress-busy'), { timeout: 25000 });
                // Wait for 'PV Power' label to be present
                await detailPage.waitForSelector("xpath///*[text()='PV Power' or contains(text(), 'PV Power')]", { timeout: 15000 });
                await delay(4000); // Sleep 4 seconds to ensure dynamic numeric values populate
            } catch (e) {
                console.log(`Warning: Timed out waiting for details page elements: ${e.message}`);
            }

            // Scrape detailed metrics
            const details = await scrapePlantDetails(detailPage);

            // Close detail tab or navigate back
            if (openedInNewTab) {
                await detailPage.close();
            } else {
                console.log("Navigating back to Plants overview page...");
                await safeGoto(page, "https://global.solaxcloud.com/green/#/plant/index");
                await delay(4000);
            }

            // Compile merged row data
            const rowData = {
                "plant_id": parseInt(getPlantId(plantName)),
                "timestamp": cleanTimestamp(scrapeTime),
                "power": parseValueWithUnit(details["PV Power"] || plant["PV Capacity(kWp)"] || plant["PV Capacity"]),
                "voltage": null,
                "current": null,
                "frequency": null,
                "irradiance": null,
                "daily_generation": parseValueWithUnit(details["Daily solar"] || plant["Daily Yield(kWh)"] || plant["Daily Yield"]),
                "total_generation": null,
                "temperature": null,
                "status": plant["Plant Status"] || "Normal",
                "raw_json": JSON.stringify({...plant, ...details}),
                "created_at": new Date().toISOString().replace('T', ' ').substring(0, 19)
            };
            allRows.push(rowData);
        }

        // 5. Export compiled dataset to JSON
        if (allRows.length > 0) {
            saveToJson(allRows);
        }

    } catch (e) {
        console.error(`\nAn error occurred during scraping:`, e);
        try {
            console.log(`Current URL at error: ${page.url()}`);
            const screenshotPath = path.join(__dirname, "error_screenshot.png");
            await page.screenshot({ path: screenshotPath });
            console.log(`Saved error screenshot to: ${screenshotPath}`);
        } catch (se) {
            console.log(`Could not save screenshot: ${se.message}`);
        }
    } finally {
        console.log("\nClosing Chrome browser...");
        await browser.close();
    }
}

main();
