import { getPool } from '../lib/db.mjs';
import { errorResponse, isAdminRequest, jsonResponse } from '../lib/http.mjs';

export default async function deleteSpotHandler(request, context) {
  if (!isAdminRequest(request)) return jsonResponse({ error: 'Invalid admin token.' }, 401);
  if (request.method !== 'DELETE') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const { id } = context.params || {};
  if (typeof id !== 'string' || !id || id.length > 80) {
    return jsonResponse({ error: 'Invalid spot ID.' }, 400);
  }

  try {
    const { rowCount } = await getPool().query('DELETE FROM spots WHERE id = $1', [id]);
    if (!rowCount) return jsonResponse({ error: 'Spot not found.' }, 404);
    return jsonResponse({ id, status: 'deleted' });
  } catch (error) {
    return errorResponse(error);
  }
}

export const config = { path: '/api/admin/spots/:id' };
