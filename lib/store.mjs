import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const seedSpots = JSON.parse(readFileSync(path.join(moduleDirectory, 'seed-spots.json'), 'utf8'));

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readArray(filePath, fallback) {
  const value = readJson(filePath, fallback);
  if (!Array.isArray(value)) throw new Error(`Expected a JSON array in ${filePath}.`);
  return value;
}

function normalizeSpot(spot, status) {
  return {
    ...spot,
    status: spot.status === 'pending' ? 'pending' : status,
    createdAt: spot.createdAt || new Date().toISOString()
  };
}

export function saveStore(dataDir, store) {
  mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'server-store.json');
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(tempPath, filePath);
  } finally {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  }
}

export function loadStore(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'server-store.json');
  if (existsSync(filePath)) {
    const store = readJson(filePath);
    if (!store || !Array.isArray(store.spots) || !Array.isArray(store.ratings)) {
      throw new Error(`Invalid store format in ${filePath}.`);
    }
    if (!store.ratingSnapshots || typeof store.ratingSnapshots !== 'object' || Array.isArray(store.ratingSnapshots)) {
      store.ratingSnapshots = {};
    }
    return store;
  }

  const localSpots = readArray(path.join(dataDir, 'spots.json'), seedSpots);
  const pendingSpots = readArray(path.join(dataDir, 'pending.json'), []);
  const legacyRatings = readJson(path.join(dataDir, 'ratings.json'), []);
  const ratings = Array.isArray(legacyRatings) ? legacyRatings : [];
  const spotsById = new Map();
  for (const spot of localSpots) {
    spotsById.set(spot.id, normalizeSpot(spot, 'approved'));
  }
  for (const spot of pendingSpots) {
    if (!spotsById.has(spot.id)) spotsById.set(spot.id, normalizeSpot(spot, 'pending'));
  }
  const store = { spots: [...spotsById.values()], ratings, ratingSnapshots: {} };
  saveStore(dataDir, store);
  return store;
}
