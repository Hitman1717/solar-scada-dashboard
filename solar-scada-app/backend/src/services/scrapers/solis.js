const LOGIN_URL = "https://www.soliscloud.com/login";

export async function scrape(account, page) {
  const { username, password } = account;

  console.log(`[Solis] Navigating to login page/dashboard...`);
  await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000 + Math.random() * 2000);

  const isLoginPage = page.url().includes('login');
  if (isLoginPage) {
    console.log(`[Solis] Session expired or not logged in. Logging in...`);
    
    // Find inputs
    const allInputs = await page.$$("input");
    let usernameInput = null;
    let passwordInput = null;

    for (const inp of allInputs) {
      const isVisible = await inp.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
      });
      const isEnabled = await inp.evaluate(el => !el.disabled);
      
      if (isVisible && isEnabled) {
        const typeAttr = (await inp.getAttribute('type') || '').toLowerCase();
        const placeholder = (await inp.getAttribute('placeholder') || '').toLowerCase();

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
      for (const placeholderText of ["Email/Username", "Email/Username/Phone", "Username", "Email"]) {
        const inp = await page.$(`input[placeholder='${placeholderText}']`);
        if (inp && await inp.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0)) {
          usernameInput = inp;
          break;
        }
      }
    }

    if (!usernameInput) usernameInput = await page.$("input[type='text']:not([disabled])");
    if (!passwordInput) passwordInput = await page.$("input[type='password']");

    if (!usernameInput || !passwordInput) {
      throw new Error("Could not find username or password inputs.");
    }

    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type(username);
    await page.waitForTimeout(500);

    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(password);
    await page.waitForTimeout(500);

    // Terms checkbox click
    console.log("[Solis] Checking agreement checkbox...");
    try {
      const checkbox = await page.$("span.el-checkbox__input, label:has-text('Privacy Policy')");
      if (checkbox) {
        await checkbox.click();
      }
    } catch (e) {
      try {
        const checkboxInput = await page.$("input[type='checkbox']");
        if (checkboxInput) await page.evaluate(el => el.click(), checkboxInput);
      } catch (ex) {}
    }
    await page.waitForTimeout(500);

    // Click Login
    console.log("[Solis] Clicking Login button...");
    const loginBtn = await page.waitForSelector("button:has-text('Login'), button:has-text('login'), button[type='submit']", { timeout: 10000 });
    await loginBtn.click();

    console.log("[Solis] Waiting for dashboard redirection...");
    try {
      await page.waitForFunction(() => {
        const href = window.location.href;
        return href.includes('/station') || href.includes('/homepage') || href.includes('/p/index') || href.includes('/dashboard');
      }, { timeout: 30000 });
    } catch (e) {
      console.warn("[Solis] Redirection check timed out, checking for iframe context anyway...");
    }
    await page.waitForTimeout(10000); // 10s wait for Vue iframe load
  } else {
    console.log(`[Solis] Already logged in via session state.`);
  }

  // Get Iframe Frame context
  const iframeElement = await page.waitForSelector('iframe[name="glyun_vue2"]', { timeout: 30000 });
  const frame = await iframeElement.contentFrame();
  if (!frame) {
    throw new Error("Could not access iframe contentFrame for Solis");
  }

  console.log(`[Solis] Scraping Page 1...`);
  const page1Data = await scrapeSolisTable(frame);
  const allScrapedData = [...page1Data];

  // Try Page 2
  try {
    const hasPage2 = await goToSolisPage2(frame);
    if (hasPage2) {
      console.log(`[Solis] Navigating to Page 2...`);
      const firstPlantName = page1Data[0] ? page1Data[0]["Plant Name"] : "";
      
      if (firstPlantName) {
        const startTime = Date.now();
        while (Date.now() - startTime < 15000) {
          const currentFirstPlant = await getFirstSolisPlantName(frame);
          if (currentFirstPlant && currentFirstPlant !== firstPlantName) {
            console.log(`Page 2 loaded successfully.`);
            break;
          }
          await page.waitForTimeout(500);
        }
      } else {
        await page.waitForTimeout(3000);
      }

      const page2Data = await scrapeSolisTable(frame);
      allScrapedData.push(...page2Data);
    }
  } catch (err) {
    console.log(`[Solis] Page 2 navigation skipped or failed: ${err.message}`);
  }

  // Map to unified schema
  const results = [];
  for (const row of allScrapedData) {
    const plantName = row["Plant Name"];
    if (!plantName) continue;

    const ts = cleanTimestamp(row["Update Time"]);
    const power = parseValueWithUnit(row["Power"]);
    const dailyGen = parseValueWithUnit(row["Daily Yield"]);
    const totalGen = parseValueWithUnit(row["Total Yield"]);

    results.push({
      plant_name: plantName,
      timestamp: ts,
      power: isNaN(power) ? null : power,
      daily_generation: isNaN(dailyGen) ? null : dailyGen,
      total_generation: isNaN(totalGen) ? null : totalGen,
      status: row["Plant Status"] || "Normal",
      raw_json: row
    });
  }

  return results;
}

// Helpers
async function getFirstSolisPlantName(frame) {
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

async function goToSolisPage2(frame) {
  return await frame.evaluate(() => {
    try {
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
}

async function scrapeSolisTable(frame) {
  return await frame.evaluate(() => {
    try {
      const rows = document.querySelectorAll('.el-table__body-wrapper .el-table__row');
      const data = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 10) {
          const status = cells[0].innerText.trim();
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
