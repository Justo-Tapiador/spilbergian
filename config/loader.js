/**
 * config/loader.js — Layered configuration loader for Spilbergian v3.0
 *
 * Resolution order (later overrides earlier):
 *   1. config/default.json
 *   2. config/{NODE_ENV}.json     (e.g. production.json)
 *   3. .env file
 *   4. process.env variables      (PREDATOR_*, SPILBERGIAN_*)
 *   5. explicit overrides passed by caller
 *
 * Final object is validated against the Zod schema in config/schema.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { validateConfig } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = __dirname;

const ENV_FILE = process.env.PREDATOR_ENV_FILE || '.env';

/** Recursively set a value into an object by dotted path. */
function setByPath(obj, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Convert "TRUE"/"FALSE"/"123"/"3.14"/"[a,b]"/"{...}" strings into typed values. */
function coerceEnvValue(raw) {
  if (raw == null) return raw;
  const s = String(raw).trim();
  if (/^(true|yes|on)$/i.test(s))   return true;
  if (/^(false|no|off)$/i.test(s))  return false;
  if (/^-?\d+$/.test(s))             return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s))        return parseFloat(s);
  if (s.startsWith('[') && s.endsWith(']')) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1).split(',').map(x => x.trim()); }
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    try { return JSON.parse(s); } catch { return s; }
  }
  return s;
}

/** Walk env vars that start with the given prefix and project them into a config object. */
function envOverrides(prefix) {
  const out = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix)) continue;
    const dotted = key.slice(prefix.length)
      .toLowerCase()
      .replace(/__/g, '.')
      .replace(/^_/, '');
    setByPath(out, dotted, coerceEnvValue(value));
  }
  return out;
}

/** Deep merge two plain objects. */
function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) return [...target, ...source];
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out;
}

/** Load a JSON config file if it exists. */
function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${err.message}`);
  }
}

/**
 * Build the final configuration object.
 * @param {Object} [overrides] — Explicit caller overrides (highest priority).
 * @returns {Object} Validated configuration object.
 */
export function loadConfig(overrides = {}) {
  // Load .env (silent if missing)
  try {
    dotenv.config({ path: path.resolve(process.cwd(), ENV_FILE) });
  } catch {
    /* ignore */
  }

  const defaults   = loadJsonFile(path.join(CONFIG_DIR, 'default.json'));
  const envName    = process.env.NODE_ENV || 'development';
  const envConfig  = loadJsonFile(path.join(CONFIG_DIR, `${envName}.json`));

  const envOverrides1 = envOverrides('PREDATOR_');
  const envOverrides2 = envOverrides('SPILBERGIAN_');

  const merged = [defaults, envConfig, envOverrides1, envOverrides2, overrides].reduce(
    (acc, layer) => deepMerge(acc, layer),
    {},
  );

  return validateConfig(merged);
}

/** Save a snapshot of the current effective configuration to disk for inspection. */
export function dumpEffectiveConfig(config, outPath = './data/logs/effective-config.json') {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
  return outPath;
}
