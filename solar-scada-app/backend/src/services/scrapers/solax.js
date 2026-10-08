const LOGIN_URL = "https://www.solaxcloud.com/user-center/";

export async function scrape(account, page) {
  const { username, password } = account;

  console.log(`[Solax] Navigating to login page/dashboard...`);
  await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000 + Math.random() * 2000);

  const isLoginPage = page.url().includes('user-center');
  if (isLoginPage) {
    console.log(`[Solax] Session expired or not logged in. Logging in...`);

    const usernameField = await page.waitForSelector("input[placeholder='Please enter your user name/email/mobile number']", { timeout: 20000 });
    const passwordField = await page.waitForSelector("input[placeholder='Enter Password']", { timeout: 20000 });

    await usernameField.click({ clickCount: 3 });
    await usernameField.type(username);
    await page.waitForTimeout(500);

    await passwordField.click({ clickCount: 3 });
    await passwordField.type(password);
    await page.waitForTimeout(500);

    console.log("[Solax] Checking Privacy Policy agreement checkbox...");
    try {
      const checkbox = await page.waitForSelector("span:has-text('Privacy Policy'), span:has-text('agree to'), input[type='checkbox']", { timeout: 5000 });
      const isChecked = await checkbox.evaluate(el => el.checked || el.classList.contains('arco-checkbox-checked'));
      if (!isChecked) {
        await checkbox.click();
        await page.waitForTimeout(500);
      }
    } catch (e) {
      console.log(`Warning/Note checking checkbox: ${e.message}`);
    }

    console.log("[Solax] Clicking Login button...");
    const loginBtn = await page.waitForSelector(".submit-button, .login-btn, button[type='submit']", { state: 'visible', timeout: 15000 });
    await loginBtn.click();

    console.log("[Solax] Waiting for redirection to dashboard...");
    await page.waitForFunction(() => window.location.href.includes('/green/#/'), { timeout: 30000 });
    await page.waitForTimeout(3000);
  } else {
    console.log(`[Solax] Already logged in via session state.`);
  }

  // Go to Plants page
  console.log("[Solax] Navigating to Plants section...");
  const plantsTab = await page.waitForSelector("span:has-text('Plants')", { timeout: 40000 });
  await plantsTab.click();

  console.log("[Solax] Waiting for Plants table data...");
  try {
    await page.waitForSelector('.arco-table-td', { timeout: 20000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log(`Warning: Timed out waiting for table to load: ${e.message}`);
  }

  // Scrape overview table
  console.log("[Solax] Scraping Plants overview table...");
  const plants = await page.evaluate(() => {
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

  if (!plants || plants.length === 0) {
    throw new Error("No plants data found in the overview table.");
  }
  console.log(`Found ${plants.length} plants in the table.`);

  const now = new Date();
  const scrapeTime = now.toISOString().replace('T', ' ').substring(0, 19);
  const results = [];

  // Loop plants
  const context = page.context();
  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i];
    let plantName = (plant["Plant Name"] || "").trim();
    if (!plantName) {
      plantName = (plant[Object.keys(plant)[0]] || "").trim();
    }

    console.log(`\n[${i + 1}/${plants.length}] Processing Solax plant: '${plantName}'`);

    // Listen for new tab/page in context
    const pagePromise = context.waitForEvent('page').catch(() => null);

    // Click link for plant details
    const plantLink = await page.waitForSelector(`xpath///table//tr//td[contains(., "${plantName}")]//*[text()="${plantName}"] | //*[text()="${plantName}"]`, { timeout: 15000 }).catch(() => null);
    if (!plantLink) {
      console.log(`Could not find click link for ${plantName}, skipping.`);
      continue;
    }
    
    await page.evaluate(el => el.click(), plantLink);

    // Wait for new tab or fallback to same page check
    const newPage = await pagePromise;
    let detailPage = page;
    let openedInNewTab = false;

    if (newPage) {
      detailPage = newPage;
      openedInNewTab = true;
      console.log("Opened detail page in a new tab.");
    } else {
      console.log("No new tab opened, staying on current page.");
    }

    console.log("Waiting for details to load...");
    try {
      await detailPage.waitForSelector("xpath///*[text()='PV Power' or contains(text(), 'PV Power')]", { timeout: 15000 });
      await detailPage.waitForTimeout(4000); // 4s render buffer
    } catch (e) {
      console.log(`Warning: details loading timed out or elements not found: ${e.message}`);
    }

    // Scrape details
    const details = await detailPage.evaluate(() => {
      try {
        const metrics = {};
        const elements = Array.from(document.querySelectorAll('*'));
        const findValue = (label) => {
          const candidates = elements.filter(el => {
            const txt = (el.innerText || "").trim().toLowerCase();
            return txt.includes(label.toLowerCase());
          });
          if (candidates.length === 0) return "";
          candidates.sort((a, b) => a.getElementsByTagName('*').length - b.getElementsByTagName('*').length);

          for (const labelEl of candidates) {
            let current = labelEl;
            for (let j = 0; j < 4; j++) {
              if (!current) break;
              const text = current.innerText;
              const match = text.match(/(\d+(?:\.\d+)?)\s*(kWh|kWp|kW|%)/i);
              if (match) return match[0];
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

    if (openedInNewTab) {
      await detailPage.close();
    } else {
      console.log("Navigating back to Plants overview page...");
      await page.goto("https://global.solaxcloud.com/green/#/plant/index", { waitUntil: 'load' });
      await page.waitForTimeout(4000);
    }

    const power = parseValueWithUnit(details["PV Power"] || plant["PV Capacity(kWp)"] || plant["PV Capacity"]);
    const dailyGen = parseValueWithUnit(details["Daily solar"] || plant["Daily Yield(kWh)"] || plant["Daily Yield"]);

    results.push({
      plant_name: plantName,
      timestamp: cleanTimestamp(scrapeTime),
      power: isNaN(power) ? null : power,
      daily_generation: isNaN(dailyGen) ? null : dailyGen,
      total_generation: null,
      status: plant["Plant Status"] || "Normal",
      raw_json: { ...plant, ...details }
    });
  }

  return results;
}

// Helpers
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

function cleanTimestamp(dateStr) {
  if (!dateStr) return null;
  let s = String(dateStr).trim().split('(')[0].trim();
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
            return `${datePieces[2]}-${datePieces[1].padStart(2, '0')}-${datePieces[0].padStart(2, '0')} ${timePart}`;
          }
        }
      }
    }
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace('T', ' ').substring(0, 19);
    }
  } catch (e) {}
  return s;
}
