import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.resolve(__dirname, '../../sessions');

// Ensure directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

export function sessionPath(accountId) {
  return path.join(SESSIONS_DIR, `${accountId}.json`);
}

export async function getSessionIfExists(accountId) {
  const p = sessionPath(accountId);
  return fs.existsSync(p) ? p : undefined;
}
