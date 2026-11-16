import { getPool } from '../lib/db.mjs';
import { errorResponse, isAdminRequest, jsonResponse } from '../lib/http.mjs';

export default async function pendingHandler(request) {
  if (!isAdminRequest(request)) return jsonResponse({ error: 'Invalid admin token.' }, 401);
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const { rows } = await getPool().query(
      `SELECT id, names, region, type, lat, lng, descriptions, created_at AS "createdAt"
       FROM spots WHERE status = 'pending' ORDER BY created_at, id`
    );
    return jsonResponse(rows);
  } catch (error) {
    return errorResponse(error);
  }
}

export const config = { path: '/api/admin/pending' };
