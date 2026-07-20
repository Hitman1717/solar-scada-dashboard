const fs = require('fs');
const path = require('path');

// Resolve XLSX from one of the node_modules to avoid installing it at root
const xlsxPath = path.resolve(__dirname, 'polycab', 'node_modules', 'xlsx');
let XLSX;
try {
    XLSX = require(xlsxPath);
} catch (e) {
    try {
        XLSX = require(path.resolve(__dirname, 'solax', 'node_modules', 'xlsx'));
    } catch (err) {
        XLSX = require(path.resolve(__dirname, 'solis', 'node_modules', 'xlsx'));
    }
}

const EXCEL_FILE = path.resolve(__dirname, 'solar_data.xlsx');

const PLANT_COORDINATES = {
    1: { lat: 17.4065, lng: 78.4772 },  // MY SPACE STUDY HALL 1
    2: { lat: 17.4065, lng: 78.4772 },  // MY SPACE STUDY HALL
    3: { lat: 17.4065, lng: 78.4772 },  // VASUDEV BLUE FLIED SITE
    4: { lat: 17.4065, lng: 78.4772 },  // VILLA NUM 111
    5: { lat: 17.4065, lng: 78.4772 },  // RV2
    6: { lat: 17.4065, lng: 78.4772 },  // RV1
    7: { lat: 17.3887, lng: 78.4975 },  // MELGIRI ENTERPRISES HOUSE 3
    8: { lat: 17.3887, lng: 78.4975 },  // MELGIRI ENTERPRISES
    9: { lat: 17.3887, lng: 78.4975 },  // MELGIRI ENTERPRISES HOUSE 2
    10: { lat: 17.4089, lng: 77.9407 }, // MELGIRI FARM 02
    11: { lat: 17.4089, lng: 77.9407 }, // MELGIRI FARMS 01
    12: { lat: 17.4527, lng: 78.3073 }, // MAGNA VILLA 15
    13: { lat: 17.4527, lng: 78.3073 }, // ABHILASH REDDY INCRIBLE HALLMARK VILLA NO.24
    14: { lat: 15.3486, lng: 78.1384 }, // ARYA VYSYA ANNA SATRAM
    15: { lat: 28.2562, lng: 76.1264 }, // CENTRAL UNIVERSITY OF HARYANA
    16: { lat: 17.4527, lng: 78.3073 }  // MAGNA VILLA 41
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchHourlyRadiation(lat, lng, dateStr) {
    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&hourly=shortwave_radiation`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&hourly=shortwave_radiation`;

    for (const url of [archiveUrl, forecastUrl]) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (data && data.hourly && data.hourly.shortwave_radiation) {
                return data.hourly.shortwave_radiation; 
            }
        } catch (e) {
            // Silently try next URL fallback
        }
    }
    return null;
}

async function main() {
    console.log("=================================================");
    console.log("POST-PROCESSING: UPDATING IRRADIANCE VALUES...");
    console.log("=================================================");

    if (!fs.existsSync(EXCEL_FILE)) {
        console.error(`Error: Excel file '${EXCEL_FILE}' not found!`);
        return;
    }

    let workbook;
    try {
        workbook = XLSX.readFile(EXCEL_FILE);
    } catch (e) {
        console.error("Error reading Excel file:", e.message);
        return;
    }

    if (!workbook.SheetNames.includes('Telemetry')) {
        console.error("Error: Telemetry sheet not found in the Excel file!");
        return;
    }

    const sheet = workbook.Sheets['Telemetry'];
    const rows = XLSX.utils.sheet_to_json(sheet);

    // Find rows that lack irradiance data
    const emptyRows = rows.filter(r => r.irradiance === undefined || r.irradiance === null || r.irradiance === "");
    console.log(`Found ${rows.length} total rows. ${emptyRows.length} rows are missing irradiance.`);

    if (emptyRows.length === 0) {
        console.log("No update required. Irradiance is already up to date.");
        return;
    }

    // Cache requests for the same date and coordinates
    const cache = {};
    let updatedCount = 0;

    for (const row of emptyRows) {
        const plantId = parseInt(row.plant_id);
        const coords = PLANT_COORDINATES[plantId];
        if (!coords) {
            console.log(`No coordinates mapped for plant_id: ${plantId}. Skipping.`);
            continue;
        }

        if (!row.timestamp) continue;
        const parts = row.timestamp.split(' ');
        if (parts.length < 2) continue;

        const dateStr = parts[0]; 
        const timePart = parts[1]; 
        const hour = parseInt(timePart.split(':')[0]);

        const cacheKey = `${plantId}|||${dateStr}`;
        let hourlyData = cache[cacheKey];

        if (hourlyData === undefined) {
            console.log(`Fetching solar radiation for Plant ${plantId} on ${dateStr}...`);
            hourlyData = await fetchHourlyRadiation(coords.lat, coords.lng, dateStr);
            cache[cacheKey] = hourlyData;
            await delay(1000); // 1s delay to respect Open-Meteo rates
        }

        if (hourlyData && hourlyData[hour] !== undefined) {
            row.irradiance = hourlyData[hour];
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        console.log(`\nSuccessfully fetched irradiance for ${updatedCount} rows.`);

        const newWb = XLSX.utils.book_new();
        
        const colsOrder = ["id", "plant_id", "timestamp", "power", "voltage", "current", "frequency", 
                          "irradiance", "daily_generation", "total_generation", "temperature", "status", "raw_json", "created_at"];
        
        const finalRows = rows.map(r => {
            const row = {};
            for (const col of colsOrder) {
                row[col] = r[col] !== undefined ? r[col] : null;
            }
            return row;
        });

        const newWs = XLSX.utils.json_to_sheet(finalRows);
        XLSX.utils.book_append_sheet(newWb, newWs, 'Telemetry');

        for (const name of workbook.SheetNames) {
            if (name !== 'Telemetry') {
                XLSX.utils.book_append_sheet(newWb, workbook.Sheets[name], name);
            }
        }

        try {
            XLSX.writeFile(newWb, EXCEL_FILE);
            console.log(`SUCCESS! Excel file updated with new irradiance values.`);
        } catch (e) {
            console.error("Error writing Excel file:", e.message);
            if (e.code === 'EBUSY' || e.message.includes('permission')) {
                const dir = path.dirname(EXCEL_FILE);
                const backup = path.join(dir, `solar_data_irradiance_backup_${Math.floor(Date.now() / 1000)}.xlsx`);
                console.log(`\nERROR: Permission denied writing to '${EXCEL_FILE}'.`);
                console.log(`Is the Excel file open in another program (like Microsoft Excel)?`);
                console.log(`Saving data to backup file '${backup}' instead to protect your fetched radiation data.`);
                try {
                    XLSX.writeFile(newWb, backup);
                    console.log(`Backup saved to ${backup}`);
                } catch (backupErr) {
                    console.error("Failed to write backup Excel file:", backupErr.message);
                }
            }
        }
    } else {
        console.log("\nNo irradiance values could be updated.");
    }
}

main();
