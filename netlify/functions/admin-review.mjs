import { getPool } from '../lib/db.mjs';
import { errorResponse, isAdminRequest, jsonResponse } from '../lib/http.mjs';

export default async function reviewHandler(request, context) {
  if (!isAdminRequest(request)) return jsonResponse({ error: 'Invalid admin token.' }, 401);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const { id, action } = context.params || {};
  if (!id || !['approve', 'reject'].includes(action)) {
    return jsonResponse({ error: 'Invalid review action.' }, 400);
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const pending = await client.query(
      `SELECT id FROM spots WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [id]
    );
    if (!pending.rowCount) {
      await client.query('ROLLBACK');
      return jsonResponse({ error: 'Submission not found.' }, 404);
    }
    if (action === 'approve') {
      await client.query(`UPDATE spots SET status = 'approved' WHERE id = $1`, [id]);
    } else {
      await client.query('DELETE FROM spots WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
    return jsonResponse({ id, status: action === 'approve' ? 'approved' : 'rejected' });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    return errorResponse(error);
  } finally {
    client.release();
  }
}

export const config = { path: '/api/admin/pending/:id/:action' };
