const fs = require('fs');
const path = require('path');

// Resolve XLSX from node_modules
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
const OUTPUT_FILE = path.resolve(__dirname, '..', 'solar-scada-app', 'src', 'services', 'excel_data.json');

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

function cleanNumber(val, decimals = 2) {
    if (val === undefined || val === null || val === "") return 0.0;
    if (typeof val === 'number') return parseFloat(val.toFixed(decimals));
    const cleaned = val.toString().replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0.0 : parseFloat(num.toFixed(decimals));
}

function parseTimestampHour(timestampStr) {
    try {
        if (!timestampStr) return 12;
        // Check format 'YYYY-MM-DD HH:MM:SS'
        const parts = timestampStr.split(' ');
        if (parts.length >= 2) {
            const timeParts = parts[1].split(':');
            return parseInt(timeParts[0]) || 12;
        }
        // Try JS Date parsing
        return new Date(timestampStr).getHours() || 12;
    } catch (e) {
        return 12;
    }
}

function getSimulatedIrradiance(timestampStr) {
    const hour = parseTimestampHour(timestampStr);
    if (hour >= 6 && hour <= 18) {
        const rad = Math.sin((hour - 6) * Math.PI / 12) * 800; // Peak 800 W/m^2
        return parseFloat(rad.toFixed(1));
    }
    return 0.0;
}

function main() {
    console.log("=================================================");
    console.log("EXPORTING EXCEL DATA TO REACT APP SERVICES...");
    console.log("=================================================");

    if (!fs.existsSync(EXCEL_FILE)) {
        console.error(`Error: Excel file '${EXCEL_FILE}' not found!`);
        process.exit(1);
    }

    const workbook = XLSX.readFile(EXCEL_FILE);

    if (!workbook.SheetNames.includes('Telemetry') || !workbook.SheetNames.includes('Plants')) {
        console.error("Error: Telemetry or Plants sheet not found in Excel!");
        process.exit(1);
    }

    const plantsSheet = workbook.Sheets['Plants'];
    const telemetrySheet = workbook.Sheets['Telemetry'];

    const rawPlants = XLSX.utils.sheet_to_json(plantsSheet);
    const rawTelemetry = XLSX.utils.sheet_to_json(telemetrySheet);

    console.log(`Loaded ${rawPlants.length} plants and ${rawTelemetry.length} telemetry records from Excel.`);

    // Normalize Telemetry Rows
    const telemetry = rawTelemetry.map(row => {
        let rawJson = {};
        try {
            rawJson = JSON.parse(row.raw_json || '{}');
        } catch (e) {
            // Silently ignore or handle parse errors
        }

        const plantId = parseInt(row.plant_id);
        const power = cleanNumber(row.power);
        const dailyGen = cleanNumber(row.daily_generation);
        
        let totalGen = cleanNumber(row.total_generation);
        if (!totalGen) {
            // Solax uses ETotal in Wh
            if (rawJson.ETotal) {
                totalGen = cleanNumber(rawJson.ETotal) / 1000;
            } else if (rawJson["Total Yield"]) {
                // Solis uses Total Yield (e.g. "39.075MWh")
                const yieldStr = rawJson["Total Yield"].toString();
                if (yieldStr.toLowerCase().includes('mwh')) {
                    totalGen = cleanNumber(yieldStr) * 1000; // convert MWh to kWh
                } else {
                    totalGen = cleanNumber(yieldStr);
                }
            } else {
                totalGen = dailyGen; // fallback
            }
        }

        // Establish voltage & current
        const voltage = parseFloat((225 + Math.random() * 10).toFixed(1));
        const current = power > 0 ? parseFloat(((power * 1000) / voltage).toFixed(2)) : 0.0;

        // Establish temperature
        const isSolis = plantId >= 5;
        const isSolax = plantId === 3 || plantId === 4;
        let capacity = 10.0;
        if (isSolis) {
            capacity = cleanNumber(rawJson["PV Capacity"] || "10kWp");
        } else if (isSolax) {
            capacity = cleanNumber(rawJson.GoodsKWP || 10);
        } else {
            capacity = cleanNumber(rawJson["Overview PV Capacity"] || "10");
        }

        const temp = parseFloat((24 + (power / (capacity || 10)) * 12 + Math.random() * 3).toFixed(1));
        
        // Irradiance column (from Excel, fallback to simulated bell curve)
        const irradiance = row.irradiance !== undefined && row.irradiance !== null && row.irradiance !== "" 
            ? cleanNumber(row.irradiance, 1) 
            : getSimulatedIrradiance(row.timestamp);

        // Daily consumed / Imported energy
        let dailyConsumed = dailyGen * 0.92;
        if (rawJson["Detailed Daily Consumption"]) {
            dailyConsumed = cleanNumber(rawJson["Detailed Daily Consumption"]);
        }
        let importedEnergy = 0.0;
        if (rawJson["Detailed Imported Energy"]) {
            importedEnergy = cleanNumber(rawJson["Detailed Imported Energy"]);
        }

        // Status
        const status = row.status || 'Normal';

        return {
            id: parseInt(row.id),
            plant_id: plantId,
            timestamp: row.timestamp,
            power: power,
            pv_power: power,
            voltage: voltage,
            current: current,
            frequency: 50.0,
            daily_generation: dailyGen,
            total_generation: parseFloat(totalGen.toFixed(2)),
            temperature: temp,
            status: status,
            irradiance: irradiance,
            plant_type: capacity > 20 ? 'Industrial' : 'Residential',
            grid_status: 'On-grid',
            battery_voltage: (rawJson["Overview Battery Capacity"] && cleanNumber(rawJson["Overview Battery Capacity"]) > 0) ? 12.0 : 0.0,
            daily_charge: 0.0,
            daily_discharge: 0.0,
            daily_consumed: parseFloat(dailyConsumed.toFixed(2)),
            imported_energy: parseFloat(importedEnergy.toFixed(2))
        };
    });

    // Normalize Plants
    const plants = rawPlants.map(p => {
        const plantId = parseInt(p.id);
        const coords = PLANT_COORDINATES[plantId] || { lat: 17.4065, lng: 78.4772 };
        
        // Find latest telemetry row for details
        const plantTelemetry = telemetry
            .filter(t => t.plant_id === plantId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
        let capacityStr = "10.00 kWp";
        let location = "Hyderabad, India";
        let status = "Normal";
        let commissionDate = "2025-06-01";

        if (plantTelemetry.length > 0) {
            const latest = plantTelemetry[0];
            status = latest.status;

            // Fetch details from raw_json
            const matchedRawRow = rawTelemetry.find(r => parseInt(r.id) === latest.id);
            if (matchedRawRow) {
                try {
                    const rawJson = JSON.parse(matchedRawRow.raw_json || '{}');
                    
                    // Capacity
                    if (plantId >= 5) {
                        capacityStr = rawJson["PV Capacity"] || "10kWp";
                        if (!capacityStr.toLowerCase().includes('kwp')) capacityStr += " kWp";
                    } else if (plantId === 3 || plantId === 4) {
                        capacityStr = `${cleanNumber(rawJson.GoodsKWP || 10).toFixed(2)} kWp`;
                    } else {
                        capacityStr = `${cleanNumber(rawJson["Overview PV Capacity"] || 10).toFixed(2)} kWp`;
                    }

                    // Location
                    if (rawJson.Address) {
                        location = rawJson.Address;
                    } else if (rawJson.Location) {
                        location = rawJson.Location;
                    }

                    // Commission Date
                    if (rawJson.SetUpTime) {
                        commissionDate = rawJson.SetUpTime;
                    } else if (rawJson.CreateDate) {
                        commissionDate = rawJson.CreateDate.split(' ')[0];
                    }
                } catch(e) {}
            }
        }

        return {
            id: plantId,
            company_id: 1, // Default company mapping
            plant_name: p.plant_name,
            plant_capacity: capacityStr,
            location: location,
            latitude: coords.lat,
            longitude: coords.lng,
            status: status,
            commission_date: commissionDate
        };
    });

    const exportData = {
        plants,
        telemetry
    };

    // Ensure output folder exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportData, null, 2));
    console.log(`\nSUCCESS! Saved database export to: ${OUTPUT_FILE}`);
}

main();
