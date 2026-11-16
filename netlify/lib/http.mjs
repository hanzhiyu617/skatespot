import { timingSafeEqual } from 'node:crypto';

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function readJsonBody(request) {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 24 * 1024) {
    throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON.'), { status: 400 });
  }
}

export function errorResponse(error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  return jsonResponse({ error: status >= 500 ? 'Unexpected server error.' : error.message }, status);
}

export function isValidVoterId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const regions = new Set(['Seoul', 'Gyeonggi', 'Incheon', 'Busan', 'Gangwon', 'Other']);
const types = new Set(['Outdoor', 'Indoor', 'Street']);
const languages = ['en', 'ko', 'zh'];

export function isValidSpot(value) {
  return Boolean(value &&
    value.names &&
    languages.every(language =>
      typeof value.names[language] === 'string' &&
      value.names[language].trim().length > 0 &&
      value.names[language].trim().length <= 80
    ) &&
    regions.has(value.region) &&
    types.has(value.type) &&
    Number.isFinite(Number(value.lat)) && Number(value.lat) >= 33 && Number(value.lat) <= 39 &&
    Number.isFinite(Number(value.lng)) && Number(value.lng) >= 124 && Number(value.lng) <= 132 &&
    (!value.descriptions || languages.every(language =>
      value.descriptions[language] === undefined ||
      (typeof value.descriptions[language] === 'string' && value.descriptions[language].length <= 300)
    ))
  );
}

export function isAdminRequest(request) {
  const expected = process.env.ADMIN_TOKEN;
  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}
