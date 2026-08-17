async function test() {
  try {
    console.log("Logging in via bypass to get JWT token...");
    const loginRes = await fetch('http://localhost:5000/api/auth/bypass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SUPER_ADMIN' })
    });
    const loginData = await loginRes.json();
    if (!loginData.success) {
      throw new Error("Login failed: " + JSON.stringify(loginData));
    }
    const token = loginData.token;
    console.log("Logged in successfully. Token obtained.");

    console.log("Sending onboarding request to backend...");
    const onboardRes = await fetch('http://localhost:5000/api/scrape/onboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        providerId: 1,
        username: 'oaksun',
        password: 'Solar@123',
        scrapeIntervalMinutes: 5
      })
    });
    
    console.log("Response status:", onboardRes.status);
    const text = await onboardRes.text();
    console.log("Response body:", text);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
