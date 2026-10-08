const LOGIN_URL = "https://pv.polycabmonitoring.com/dist/#/login/index";
const TARGET_ENDPOINTS = ["GetMemberData", "getAllAllMember", "GroupList", "MemberMonitor", "logsearch"];

export async function scrape(account, page) {
  const { username, password } = account;
  const capturedData = {};

  // Enable network response interception
  page.on('response', async (response) => {
    const url = response.url();
    for (const ep of TARGET_ENDPOINTS) {
      if (url.includes(ep)) {
        try {
          const text = await response.text();
          capturedData[ep] = text;
        } catch (e) {}
      }
    }
  });

  console.log(`[Polycab] Navigating to login page/dashboard...`);
  await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000 + Math.random() * 2000);

  // Check if we need to login
  const isLoginPage = page.url().includes('login');
  if (isLoginPage) {
    console.log(`[Polycab] Session expired or not logged in. Performing full login...`);
    const inputs = await page.$$('input');
    let usernameField = null;
    let passwordField = null;

    for (const inp of inputs) {
      const typeAttr = await inp.getAttribute('type');
      const placeholder = (await inp.getAttribute('placeholder') || '').toLowerCase();
      
      if (typeAttr === 'password' || placeholder.includes('pass')) {
        passwordField = inp;
      } else if (typeAttr === 'text' || placeholder.includes('user') || placeholder.includes('member')) {
        usernameField = inp;
      }
    }

    if (!usernameField || !passwordField) {
      usernameField = await page.$("input[type='text']");
      passwordField = await page.$("input[type='password']");
    }

    if (!usernameField || !passwordField) {
      throw new Error("Polycab username or password fields not found.");
    }

    await usernameField.click({ clickCount: 3 });
    await usernameField.type(username);
    await page.waitForTimeout(500);

    await passwordField.click({ clickCount: 3 });
    await passwordField.type(password);
    await page.waitForTimeout(500);

    // Find login button
    let loginBtn = await page.$("button[type='submit']");
    if (!loginBtn) {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = (await btn.innerText() || '').toLowerCase();
        if (text.includes('login') || text.includes('log in') || text.includes('sign in')) {
          loginBtn = btn;
          break;
        }
      }
    }

    if (!loginBtn) {
      loginBtn = await page.$("button");
    }

    if (!loginBtn) {
      throw new Error("Polycab login button not found.");
    }

    await loginBtn.click();
    await page.waitForTimeout(10000);
  } else {
    console.log(`[Polycab] Already logged in via session state.`);
  }

  // Navigate to trigger API calls
  console.log(`[Polycab] Navigating to device logs page...`);
  await page.goto("https://pv.polycabmonitoring.com/dist/#/device/logs", { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(8000);

  console.log(`[Polycab] Navigating to general logs page...`);
  await page.goto("https://pv.polycabmonitoring.com/dist/#/logs", { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(8000);

  if (!capturedData["GroupList"]) {
    throw new Error("Polycab GroupList API response was not captured.");
  }

  // Parse response
  const dfGroup = parseJsonResponse("GroupList", capturedData["GroupList"]);
  const results = [];

  for (const row of dfGroup) {
    const plantName = row.GoodsTypeName;
    if (!plantName) continue;

    const ts = cleanTimestamp(row.LastUpdate);

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

    results.push({
      plant_name: plantName,
      timestamp: ts,
      power: isNaN(power) ? null : power,
      daily_generation: isNaN(dailyGen) ? null : dailyGen,
      total_generation: isNaN(totalGen) ? null : totalGen,
      status: status,
      raw_json: row
    });
  }

  return results;
}

// Reuse helper functions from original scraper
function parseJsonResponse(endpointName, rawResponse) {
  let data;
  try {
    data = JSON.parse(rawResponse);
  } catch (e) {
    return [{ "Raw Response": rawResponse }];
  }
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    const listKeys = ["data", "list", "rows", "results", "members", "groups"];
    for (const key of listKeys) {
      if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
    }
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') return val;
    }
    let targetData = data.data && typeof data.data === 'object' ? data.data : data;
    return Object.keys(targetData).map(key => ({ "Field Name": key, "Value": targetData[key] }));
  }
  return [{ "Response": String(data) }];
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
