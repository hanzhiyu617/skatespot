import { getPool } from '../lib/db.mjs';
import { errorResponse, isValidVoterId, jsonResponse, readJsonBody } from '../lib/http.mjs';

async function getSummary(pool, spotId, voterId) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(ROUND(AVG(r.value)::numeric, 1), 0)::float AS average,
       COUNT(r.value)::int AS count,
       COALESCE(MAX(r.value) FILTER (WHERE r.voter_id = $2), 0)::int AS mine
     FROM spots s
     LEFT JOIN ratings r ON r.spot_id = s.id
     WHERE s.id = $1 AND s.status = 'approved'
     GROUP BY s.id`,
    [spotId, voterId]
  );
  return rows[0] || null;
}

export default async function ratingsHandler(request) {
  try {
    const pool = getPool();
    if (request.method === 'GET') {
      const voterId = new URL(request.url).searchParams.get('voterId');
      if (!isValidVoterId(voterId)) return jsonResponse({ error: 'A valid voter ID is required.' }, 400);
      const { rows } = await pool.query(
        `SELECT
           s.id,
           COALESCE(ROUND(AVG(r.value)::numeric, 1), 0)::float AS average,
           COUNT(r.value)::int AS count,
           COALESCE(MAX(r.value) FILTER (WHERE r.voter_id = $1), 0)::int AS mine
         FROM spots s
         LEFT JOIN ratings r ON r.spot_id = s.id
         WHERE s.status = 'approved'
         GROUP BY s.id`,
        [voterId]
      );
      return jsonResponse(Object.fromEntries(rows.map(row => [row.id, {
        average: row.average,
        count: row.count,
        mine: row.mine
      }])));
    }

    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
    const input = await readJsonBody(request);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return jsonResponse({ error: 'A valid spot, voter ID, and rating from 0 to 5 are required.' }, 400);
    }
    const value = Number(input.value);
    if (typeof input.spotId !== 'string' || !isValidVoterId(input.voterId) || !Number.isInteger(value) || value < 0 || value > 5) {
      return jsonResponse({ error: 'A valid spot, voter ID, and rating from 0 to 5 are required.' }, 400);
    }

    const existing = await getSummary(pool, input.spotId, input.voterId);
    if (!existing) return jsonResponse({ error: 'Spot not found.' }, 404);
    if (value === 0) {
      await pool.query('DELETE FROM ratings WHERE spot_id = $1 AND voter_id = $2', [input.spotId, input.voterId]);
    } else {
      await pool.query(
        `INSERT INTO ratings (spot_id, voter_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (spot_id, voter_id) DO UPDATE SET value = EXCLUDED.value`,
        [input.spotId, input.voterId, value]
      );
    }
    return jsonResponse(await getSummary(pool, input.spotId, input.voterId));
  } catch (error) {
    return errorResponse(error);
  }
}

export const config = { path: '/api/ratings' };
