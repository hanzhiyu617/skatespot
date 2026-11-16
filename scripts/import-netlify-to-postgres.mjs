import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePostgresPool, getPool } from '../netlify/lib/db.mjs';

function assertSuccessful(response, endpoint) {
  if (!response.ok) throw new Error(`${endpoint} returned HTTP ${response.status}.`);
}

export async function importNetlifyData(sourceValue) {
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

  const pool = await getPool();
  const client = await pool.connect();
  let imported = 0;
  try {
    await client.query('BEGIN');
    for (const spot of spots) {
      if (!spot || typeof spot.id !== 'string' || !spot.names || typeof spot.names !== 'object') {
        throw new Error('The old site returned an invalid spot entry.');
      }

      const result = await client.query(
        `INSERT INTO spots (id, names, region, type, lat, lng, descriptions, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', COALESCE($8::timestamptz, NOW()))
         ON CONFLICT (id) DO NOTHING`,
        [
          spot.id,
          spot.names,
          spot.region,
          spot.type,
          Number(spot.lat),
          Number(spot.lng),
          spot.descriptions || {},
          spot.createdAt || null
        ]
      );
      imported += result.rowCount;

      const summary = ratings[spot.id];
      const count = Number(summary?.count);
      const average = Number(summary?.average);
      if (Number.isInteger(count) && count > 0 && Number.isFinite(average)) {
        await client.query(
          `INSERT INTO rating_snapshots (spot_id, total, count)
           VALUES ($1, $2, $3)
           ON CONFLICT (spot_id) DO NOTHING`,
          [spot.id, average * count, count]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await closePostgresPool();
  }

  return imported;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    if (!process.argv[2]) {
      throw new Error('Usage: node scripts/import-netlify-to-postgres.mjs https://your-old-site.example');
    }
    const imported = await importNetlifyData(process.argv[2]);
    console.log(`Imported ${imported} new spots. Existing IDs and rating snapshots were kept.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
