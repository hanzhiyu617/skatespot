import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore, saveStore } from '../lib/store.mjs';

function assertSuccessful(response, endpoint) {
  if (!response.ok) throw new Error(`${endpoint} returned HTTP ${response.status}.`);
}

export async function importNetlifyData(sourceValue, dataDirectory = process.env.DATA_DIR || 'data') {
  const source = new URL(sourceValue);
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(source.hostname);
  if (source.protocol !== 'https:' && !isLoopback) {
    throw new Error('Use an HTTPS URL for the existing public site.');
  }

  const spotsUrl = new URL('/api/spots', source);
  const ratingsUrl = new URL('/api/ratings', source);
  ratingsUrl.searchParams.set('voterId', randomUUID());
  const [spotsResponse, ratingsResponse] = await Promise.all([fetch(spotsUrl), fetch(ratingsUrl)]);
  assertSuccessful(spotsResponse, 'The public spots API');
  assertSuccessful(ratingsResponse, 'The public ratings API');

  const [spots, ratings] = await Promise.all([spotsResponse.json(), ratingsResponse.json()]);
  if (!Array.isArray(spots) || !ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
    throw new Error('The old site returned an unexpected data format.');
  }

  const dataDir = path.resolve(dataDirectory);
  const store = loadStore(dataDir);
  const existingIds = new Set(store.spots.map(spot => spot.id));
  let imported = 0;
  for (const spot of spots) {
    if (!spot || typeof spot.id !== 'string' || typeof spot.names !== 'object') {
      throw new Error('The old site returned an invalid spot entry.');
    }
    if (!existingIds.has(spot.id)) {
      store.spots.push({ ...spot, status: 'approved' });
      existingIds.add(spot.id);
      imported++;
    }
    const summary = ratings[spot.id];
    if (summary && Number.isFinite(Number(summary.average)) && Number.isInteger(Number(summary.count))) {
      store.ratingSnapshots[spot.id] = {
        average: Number(summary.average),
        count: Math.max(0, Number(summary.count))
      };
    }
  }

  saveStore(dataDir, store);
  return imported;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/import-netlify.mjs https://your-old-site.example');
    const imported = await importNetlifyData(process.argv[2]);
    console.log(`Imported ${imported} new spots. Existing spot IDs were kept; rating totals were copied as snapshots.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
