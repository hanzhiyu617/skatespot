import { getPool } from '../lib/db.mjs';
import { errorResponse, isAdminRequest, jsonResponse } from '../lib/http.mjs';

export default async function adminSpotsHandler(request) {
  if (!isAdminRequest(request)) return jsonResponse({ error: 'Invalid admin token.' }, 401);
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const { rows } = await getPool().query(
      `SELECT id, names, region, type, lat, lng, descriptions, status, created_at AS "createdAt"
       FROM spots ORDER BY created_at DESC, id`
    );
    return jsonResponse(rows);
  } catch (error) {
    return errorResponse(error);
  }
}

export const config = { path: '/api/admin/spots' };
