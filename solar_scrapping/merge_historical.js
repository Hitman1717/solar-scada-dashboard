const XLSX = require('./polycab/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

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

// Clean dates and format to YYYY-MM-DD HH:MM:SS
function cleanTimestamp(dateStr) {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    // Remove (UTC...) if present
    s = s.split('(')[0].trim();
    
    // Check if it's DD/MM/YYYY HH:MM:SS or DD-MM-YYYY HH:MM:SS
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
                        // Assume DD/MM/YYYY
                        const day = datePieces[0].padStart(2, '0');
                        const month = datePieces[1].padStart(2, '0');
                        const year = datePieces[2];
                        return `${year}-${month}-${day} ${timePart}`;
                    }
                }
            }
        }
    }
    
    // Try standard parsing
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

function runMerge() {
    const rootDir = path.resolve(__dirname);
    const polycabFile = path.join(rootDir, 'polycab', 'solar_data.xlsx');
    const solaxFile = path.join(rootDir, 'solax', 'solar_data.xlsx');
    const solisFile = path.join(rootDir, 'solis', 'solar_data.xlsx');
    const outputFile = path.join(rootDir, 'solar_data.xlsx');

    const combinedTelemetry = [];

    // 1. Process Polycab
    if (fs.existsSync(polycabFile)) {
        console.log(`Processing Polycab: ${polycabFile}`);
        try {
            const wb = XLSX.readFile(polycabFile);
            if (wb.SheetNames.includes('GroupList')) {
                const sheet = wb.Sheets['GroupList'];
                const rows = XLSX.utils.sheet_to_json(sheet);
                console.log(`Found ${rows.length} rows in Polycab GroupList.`);
                for (const row of rows) {
                    const plantName = row.GoodsTypeName;
                    if (!plantName) continue;
                    const plantId = getPlantId(plantName);
                    const ts = cleanTimestamp(row.LastUpdate);
                    
                    // Parse InverterStatus
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
                    
                    combinedTelemetry.push({
                        plant_id: plantId,
                        timestamp: ts,
                        power: row.CurrPac !== undefined ? parseFloat(row.CurrPac) / 1000 : null,
                        voltage: null,
                        current: null,
                        frequency: null,
                        irradiance: null,
                        daily_generation: row.EToday !== undefined ? parseFloat(row.EToday) / 1000 : null,
                        total_generation: row.ETotal !== undefined ? parseFloat(row.ETotal) / 1000 : null,
                        temperature: null,
                        status: status,
                        raw_json: JSON.stringify(row),
                        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    });
                }
            } else {
                console.log("Polycab Excel is missing 'GroupList' sheet!");
            }
        } catch (e) {
            console.error(`Error reading Polycab file: ${e.message}`);
        }
    }

    // 2. Process Solax
    if (fs.existsSync(solaxFile)) {
        console.log(`Processing Solax: ${solaxFile}`);
        try {
            const wb = XLSX.readFile(solaxFile);
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            console.log(`Found ${rows.length} rows in Solax.`);
            for (const row of rows) {
                const plantName = row['Plant Name'];
                if (!plantName) continue;
                const plantId = getPlantId(plantName);
                const ts = cleanTimestamp(row['Scrape Time']);
                
                // Parse values
                const power = parseValueWithUnit(row['Detailed PV Power'] || row['Overview PV Capacity']);
                const daily_gen = parseValueWithUnit(row['Detailed Daily Solar'] || row['Overview Daily Yield']);
                const total_gen = null;
                
                combinedTelemetry.push({
                    plant_id: plantId,
                    timestamp: ts,
                    power: power,
                    voltage: null,
                    current: null,
                    frequency: null,
                    irradiance: null,
                    daily_generation: daily_gen,
                    total_generation: total_gen,
                    temperature: null,
                    status: row['Plant Status'] || 'Normal',
                    raw_json: JSON.stringify(row),
                    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                });
            }
        } catch (e) {
            console.error(`Error reading Solax file: ${e.message}`);
        }
    }

    // 3. Process Solis
    if (fs.existsSync(solisFile)) {
        console.log(`Processing Solis: ${solisFile}`);
        try {
            const wb = XLSX.readFile(solisFile);
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            console.log(`Found ${rows.length} rows in Solis.`);
            for (const row of rows) {
                const plantName = row['Plant Name'];
                if (!plantName) continue;
                const plantId = getPlantId(plantName);
                const ts = cleanTimestamp(row['Update Time']);
                
                const power = parseValueWithUnit(row['Power']);
                const daily_gen = parseValueWithUnit(row['Daily Yield']);
                const total_gen = parseValueWithUnit(row['Total Yield']);
                
                combinedTelemetry.push({
                    plant_id: plantId,
                    timestamp: ts,
                    power: power,
                    voltage: null,
                    current: null,
                    frequency: null,
                    irradiance: null,
                    daily_generation: daily_gen,
                    total_generation: total_gen,
                    temperature: null,
                    status: row['Plant Status'] || 'Normal',
                    raw_json: JSON.stringify(row),
                    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                });
            }
        } catch (e) {
            console.error(`Error reading Solis file: ${e.message}`);
        }
    }

    console.log(`Total telemetry records mapped: ${combinedTelemetry.length}`);

    // Deduplicate by plant_id and timestamp
    const seen = new Set();
    const uniqueTelemetry = [];
    
    // Sort combined by timestamp DESC first so that drop duplicate keeps the latest entry
    combinedTelemetry.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
    });

    for (const record of combinedTelemetry) {
        const key = `${record.plant_id}|||${record.timestamp}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTelemetry.push(record);
        }
    }

    // Sort uniqueTelemetry chronologically ascending, then by plant_id
    uniqueTelemetry.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.plant_id - b.plant_id;
    });

    // Re-assign consecutive IDs 1..N
    uniqueTelemetry.forEach((record, index) => {
        record.id = index + 1;
    });

    console.log(`Deduplicated rows: ${uniqueTelemetry.length}`);

    // Create workbook and write out
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(uniqueTelemetry);
    XLSX.utils.book_append_sheet(wb, ws, 'Telemetry');

    // Also write a Plants metadata sheet for convenience so that the IDs are documented
    const plantsData = Object.entries(PLANT_MAPPING).map(([name, id]) => ({
        id: id,
        plant_name: name.toUpperCase()
    })).sort((a, b) => a.id - b.id);
    const wsPlants = XLSX.utils.json_to_sheet(plantsData);
    XLSX.utils.book_append_sheet(wb, wsPlants, 'Plants');

    XLSX.writeFile(wb, outputFile);
    console.log(`SUCCESS! Combined telemetry written to ${outputFile}`);
}

runMerge();
