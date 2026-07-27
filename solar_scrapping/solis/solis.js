const puppeteer = require('puppeteer');
// const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const LOGIN_URL = "https://www.soliscloud.com/login";
const JSON_FILE = path.resolve(__dirname, "..", "solar_data.json");
const CREDENTIALS_FILE = path.resolve(__dirname, "..", "credentials.json");

let USERNAME = "oaksuncorp";
let PASSWORD = "Solar123";

if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
        if (creds.solis && creds.solis.username && creds.solis.password) {
            USERNAME = creds.solis.username;
            PASSWORD = creds.solis.password;
            console.log("Loaded Solis credentials from credentials.json");
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

// Headless configuration
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

async function getIframeFrame(page) {
    const iframeElement = await page.waitForSelector('iframe[name="glyun_vue2"]', { timeout: 20000 });
    const frame = await iframeElement.contentFrame();
    if (!frame) {
        throw new Error("Could not access iframe contentFrame");
    }
    return frame;
}

async function getFirstPlantName(frame) {
    return await frame.evaluate(() => {
        try {
            const firstRow = document.querySelector('.el-table__body-wrapper .el-table__row');
            if (firstRow) {
                const cells = firstRow.querySelectorAll('td');
                if (cells.length >= 2) {
                    const nameAddr = cells[1].innerText.trim();
                    return nameAddr.split('\n')[0].trim();
                }
            }
        } catch (e) {}
        return '';
    });
}

async function scrapeTable(frame) {
    return await frame.evaluate(() => {
        try {
            const rows = document.querySelectorAll('.el-table__body-wrapper .el-table__row');
            const data = [];
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 10) {
                    const status = cells[0].innerText.trim();
                    
                    // Plant Name & Address
                    const nameAddrText = cells[1].innerText.trim();
                    const lines = nameAddrText.split('\n').map(l => l.trim()).filter(l => l);
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
                    updateTime = updateTime.replace(/\(Offline\)|\(Online\)/g, '').trim();
                    
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
    });
}

async function goToPage2(frame) {
    return await frame.evaluate(() => {
        try {
            // Find pagination buttons
            const pageBtns = Array.from(document.querySelectorAll('.el-pager li'));
            const page2Btn = pageBtns.find(btn => btn.innerText.trim() === '2');
            if (page2Btn) {
                page2Btn.click();
                return true;
            }
            
            const nextBtn = document.querySelector('.btn-next');
            if (nextBtn) {
                nextBtn.click();
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    });
}function saveToJson(newData, filename) {
    console.log(`Saving data to JSON file: ${filename}`);
    
    const newRows = [];
    for (const row of newData) {
        const plantName = row["Plant Name"];
        if (!plantName) continue;
        
        const plantId = getPlantId(plantName);
        const ts = cleanTimestamp(row["Update Time"]);
        
        const power = parseValueWithUnit(row["Power"]);
        const dailyGen = parseValueWithUnit(row["Daily Yield"]);
        const totalGen = parseValueWithUnit(row["Total Yield"]);
        
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
            status: row["Plant Status"] || "Normal",
            raw_json: JSON.stringify(row),
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
    }

    let existingRows = [];
    let plantsData = [];

    if (fs.existsSync(filename)) {
        try {
            const fileData = JSON.parse(fs.readFileSync(filename, 'utf8'));
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
        fs.writeFileSync(filename, JSON.stringify(exportData, null, 2), 'utf8');
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

    const allScrapedData = [];

    try {
        console.log(`Navigating to login page: ${LOGIN_URL}`);
        await safeGoto(page, LOGIN_URL);
        await delay(3000);

        console.log("Locating credentials input fields...");
        const allInputs = await page.$$("input");
        let usernameInput = null;
        let passwordInput = null;

        for (const inp of allInputs) {
            const isVisible = await page.evaluate(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
            }, inp);
            
            const isEnabled = await page.evaluate(el => !el.disabled, inp);
            
            if (isVisible && isEnabled) {
                const typeAttr = (await (await inp.getProperty('type')).jsonValue() || '').toLowerCase();
                const placeholder = (await (await inp.getProperty('placeholder')).jsonValue() || '').toLowerCase();

                if (typeAttr === 'password' || placeholder.includes('pass')) {
                    passwordInput = inp;
                } else if (typeAttr === 'text' && (placeholder.includes('user') || placeholder.includes('email') || placeholder.includes('phone') || placeholder.includes('account') || !placeholder)) {
                    if (!placeholder.includes('code') && !placeholder.includes('search')) {
                        usernameInput = inp;
                    }
                }
            }
        }

        if (!usernameInput) {
            console.log("Fallback: Locating username field by placeholder...");
            for (const placeholderText of ["Email/Username", "Email/Username/Phone", "Username", "Email"]) {
                try {
                    const inp = await page.$(`input[placeholder='${placeholderText}']`);
                    if (inp) {
                        const isVisible = await page.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0, inp);
                        if (isVisible) {
                            usernameInput = inp;
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        if (!usernameInput) {
            usernameInput = await page.$("input[type='text']:not([disabled])");
        }

        if (!passwordInput) {
            passwordInput = await page.$("input[type='password']");
        }

        if (!usernameInput || !passwordInput) {
            throw new Error("Could not find username or password inputs.");
        }

        console.log("Filling credentials...");
        await usernameInput.click({ clickCount: 3 });
        await usernameInput.type(USERNAME);
        await page.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })), usernameInput);
        await delay(500);

        await passwordInput.click({ clickCount: 3 });
        await passwordInput.type(PASSWORD);
        await page.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })), passwordInput);
        await delay(500);

        // Agree to terms checkbox click
        console.log("Clicking terms & agreement checkbox...");
        try {
            const checkbox = await page.$("xpath///span[contains(@class, 'el-checkbox__input')] | //label[contains(., 'Privacy Policy')]");
            if (checkbox) {
                await checkbox.click();
            } else {
                throw new Error("Checkbox element not found");
            }
        } catch (e) {
            try {
                const checkboxInput = await page.$("input[type='checkbox']");
                if (checkboxInput) {
                    await page.evaluate(el => el.click(), checkboxInput);
                }
            } catch (ex) {
                console.log(`Warning: Could not check agreement checkbox: ${ex.message}`);
            }
        }
        await delay(500);

        // Click login button
        console.log("Clicking Login button...");
        try {
            const loginBtn = await page.waitForSelector("xpath///button[contains(., 'Login') or contains(., 'login')] | //span[contains(text(), 'Login') or contains(text(), 'login')]/.. | //button[@type='submit']", { timeout: 10000 });
            await loginBtn.click();
        } catch (e) {
            console.log(`Warning: standard login button click failed: ${e.message}. Trying JavaScript click...`);
            try {
                const loginBtn = await page.waitForSelector("xpath///button[contains(., 'Login') or contains(., 'login')] | //span[contains(text(), 'Login') or contains(text(), 'login')]/.. | //button[@type='submit']", { timeout: 5000 });
                await page.evaluate(el => el.click(), loginBtn);
            } catch (ex) {
                throw new Error(`Could not click Login button: ${ex.message}`);
            }
        }

        // Wait for redirection to the dashboard
        console.log("Waiting for dashboard to load...");
        await page.waitForFunction(() => window.location.href.includes('/station'), { timeout: 30000 });
        console.log("Successfully logged in and reached the dashboard!");

        // Wait 10 seconds for initial Vue tables to render inside the iframe
        console.log("Waiting 10 seconds for table rendering inside iframe...");
        await delay(10000);

        // Access iframe frame context
        const frame = await getIframeFrame(page);

        // Scrape Page 1
        console.log("\n--- Scraping Page 1 ---");
        const page1Data = await scrapeTable(frame);
        if (page1Data && page1Data.length > 0) {
            console.log(`Scraped ${page1Data.length} rows from Page 1.`);
            allScrapedData.push(...page1Data);
        } else {
            console.log("Failed to scrape Page 1 data.");
        }

        // Store the name of the first plant on Page 1 to detect page change
        const firstPlantName = (page1Data && page1Data[0]) ? page1Data[0]["Plant Name"] : "";

        // Navigate to Page 2
        if (await goToPage2(frame)) {
            console.log("Waiting for Page 2 data to load...");
            if (firstPlantName) {
                // Poll every 0.5s to see if the first row's plant name changes
                const startTime = Date.now();
                while (Date.now() - startTime < 15000) {
                    const currentFirstPlant = await getFirstPlantName(frame);
                    if (currentFirstPlant && currentFirstPlant !== firstPlantName) {
                        console.log(`Page 2 loaded! First plant: ${currentFirstPlant}`);
                        break;
                    }
                    await delay(500);
                }
            } else {
                await delay(3000);
            }

            // Scrape Page 2
            console.log("\n--- Scraping Page 2 ---");
            const page2Data = await scrapeTable(frame);
            if (page2Data && page2Data.length > 0) {
                console.log(`Scraped ${page2Data.length} rows from Page 2.`);
                allScrapedData.push(...page2Data);
            } else {
                console.log("Failed to scrape Page 2 data.");
            }
        }

        // Save results to JSON
        if (allScrapedData.length > 0) {
            saveToJson(allScrapedData, JSON_FILE);
        } else {
            console.log("No data was scraped!");
        }

    } catch (e) {
        console.error(`\nAn error occurred during scraping:`, e);
    } finally {
        console.log("Closing browser...");
        await browser.close();
    }
}

main();
