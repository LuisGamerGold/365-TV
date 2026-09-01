const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./paths');

let safeStorage = null;
try {
  safeStorage = require('electron').safeStorage;
} catch {
  safeStorage = null;
}

const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');

function readAll() {
  if (!fs.existsSync(SECRETS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeAll(obj) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(obj, null, 2));
}

function canEncrypt() {
  return Boolean(safeStorage && safeStorage.isEncryptionAvailable());
}

function set(key, value) {
  const all = readAll();
  const plain = JSON.stringify(value);
  if (canEncrypt()) {
    all[key] = { enc: true, data: safeStorage.encryptString(plain).toString('base64') };
  } else {
    all[key] = { enc: false, data: plain };
  }
  writeAll(all);
}

function get(key) {
  const all = readAll();
  const entry = all[key];
  if (!entry) return null;
  if (entry.enc) {
    if (!canEncrypt()) return null;
    const plain = safeStorage.decryptString(Buffer.from(entry.data, 'base64'));
    return JSON.parse(plain);
  }
  return JSON.parse(entry.data);
}

function remove(key) {
  const all = readAll();
  delete all[key];
  writeAll(all);
}

module.exports = { set, get, remove };
