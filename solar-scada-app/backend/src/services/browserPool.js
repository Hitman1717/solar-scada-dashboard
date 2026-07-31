import { chromium } from 'playwright';

class BrowserPool {
  constructor(size = 5) {
    this.size = size;
    this.pool = [];
    this.waiters = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    console.log(`[BrowserPool] Initializing browser pool with size ${this.size}...`);
    for (let i = 0; i < this.size; i++) {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      this.pool.push(browser);
    }
    this.initialized = true;
    console.log(`[BrowserPool] Pool initialized successfully.`);
  }

  async acquire() {
    if (!this.initialized) {
      await this.init();
    }
    if (this.pool.length) {
      return this.pool.pop();
    }
    return new Promise(resolve => this.waiters.push(resolve));
  }

  release(browser) {
    if (this.waiters.length) {
      const nextWaiter = this.waiters.shift();
      nextWaiter(browser);
    } else {
      this.pool.push(browser);
    }
  }

  async closeAll() {
    console.log('[BrowserPool] Closing all browsers in pool...');
    const closePromises = this.pool.map(b => b.close());
    await Promise.all(closePromises);
    this.pool = [];
    this.initialized = false;
    console.log('[BrowserPool] All browsers closed.');
  }
}

export default new BrowserPool(5);
