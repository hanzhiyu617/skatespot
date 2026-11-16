import { randomUUID } from 'node:crypto';
import { getPool } from '../lib/db.mjs';
import { errorResponse, isValidSpot, jsonResponse, readJsonBody } from '../lib/http.mjs';

const languages = ['en', 'ko', 'zh'];

export default async function spotsHandler(request) {
  try {
    const pool = getPool();
    if (request.method === 'GET') {
      const { rows } = await pool.query(
        `SELECT id, names, region, type, lat, lng, descriptions, created_at AS "createdAt"
         FROM spots WHERE status = 'approved' ORDER BY created_at, id`
      );
      return jsonResponse(rows);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    const input = await readJsonBody(request);
    if (!isValidSpot(input)) {
      return jsonResponse({ error: 'Enter three names, a supported region and type, and coordinates in Korea.' }, 400);
    }

    const spot = {
      id: randomUUID(),
      names: Object.fromEntries(languages.map(language => [language, input.names[language].trim()])),
      region: input.region,
      type: input.type,
      lat: Number(input.lat),
      lng: Number(input.lng),
      descriptions: Object.fromEntries(languages.map(language => [language, input.descriptions?.[language] || '']))
    };
    await pool.query(
      `INSERT INTO spots (id, names, region, type, lat, lng, descriptions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [spot.id, spot.names, spot.region, spot.type, spot.lat, spot.lng, spot.descriptions]
    );
    return jsonResponse({ id: spot.id, status: 'pending' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export const config = { path: '/api/spots' };
