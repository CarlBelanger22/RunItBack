import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

let loaded = false;

/** Load `.env.local` into `process.env` for tsx CLI scripts. */
export function loadEnvLocalIntoProcess(cwd = process.cwd()): void {
  if (loaded) return;

  const envPath = resolve(cwd, '.env.local');
  if (!existsSync(envPath)) {
    loaded = true;
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  loaded = true;
}
