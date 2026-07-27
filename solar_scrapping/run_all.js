const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log("=================================================");
console.log("STARTING ALL SOLAR SCADA SCRAPERS SEQUENTIALLY...");
console.log("=================================================");

const scrapers = [
    { name: "Polycab", dir: "polycab", file: "polycab.js" },
    { name: "Solax", dir: "solax", file: "solax.js" },
    { name: "Solis", dir: "solis", file: "solis.js" }
];

scrapers.forEach(scraper => {
    console.log(`\n-------------------------------------------------`);
    console.log(`[+] Running ${scraper.name} scraper...`);
    console.log(`-------------------------------------------------`);
    try {
        execSync(`node ${scraper.file}`, {
            cwd: path.resolve(__dirname, scraper.dir),
            stdio: 'inherit'
        });
        console.log(`[✔] ${scraper.name} completed successfully.`);
    } catch (error) {
        console.error(`[❌] Error running ${scraper.name} scraper:`, error.message);
    }
});

console.log("\n=================================================");
console.log("RUNNING IRRADIANCE POST-PROCESSOR...");
console.log("=================================================");
try {
    execSync(`node update_irradiance.js`, {
        cwd: __dirname,
        stdio: 'inherit'
    });
} catch (error) {
    console.error(`[❌] Error running irradiance post-processor:`, error.message);
}
console.log("\n=================================================");
console.log("ALL SCRAPERS COMPLETED!");
console.log("=================================================");
