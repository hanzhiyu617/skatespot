import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore, saveStore } from './lib/store.mjs';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const maxBodyBytes = 24 * 1024;
const languages = ['en', 'ko', 'zh'];
const regions = new Set(['Seoul', 'Gyeonggi', 'Incheon', 'Busan', 'Gangwon', 'Other']);
const types = new Set(['Outdoor', 'Indoor', 'Street']);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2']
]);

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function isValidVoterId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidSpot(value) {
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

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON.'), { status: 400 });
  }
}

function isAdminRequest(request, expected) {
  const authorization = request.headers.authorization || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function getRatingSummary(store, spotId, voterId) {
  const snapshot = store.ratingSnapshots[spotId] || { average: 0, count: 0 };
  const spotRatings = store.ratings.filter(rating => rating.spotId === spotId);
  const count = Number(snapshot.count || 0) + spotRatings.length;
  const sum = Number(snapshot.average || 0) * Number(snapshot.count || 0) +
    spotRatings.reduce((total, rating) => total + rating.value, 0);
  return {
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    mine: spotRatings.find(rating => rating.voterId === voterId)?.value || 0
  };
}

function sendError(response, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  sendJson(response, status, { error: status >= 500 ? 'Unexpected server error.' : error.message });
}

async function handleApi(request, response, url, store, dataDir, staticDir, adminToken) {
  if (url.pathname === '/healthz') {
    if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed.' });
    return sendJson(response, 200, { status: 'ok' });
  }

  if (url.pathname === '/api/spots') {
    if (request.method === 'GET') {
      return sendJson(response, 200, store.spots
        .filter(spot => spot.status === 'approved')
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
        .map(({ id, names, region, type, lat, lng, descriptions, createdAt }) =>
          ({ id, names, region, type, lat, lng, descriptions, createdAt })));
    }
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });

    const input = await readJsonBody(request);
    if (!isValidSpot(input)) {
      return sendJson(response, 400, { error: 'Enter three names, a supported region and type, and coordinates in Korea.' });
    }

    const spot = {
      id: randomUUID(),
      names: Object.fromEntries(languages.map(language => [language, input.names[language].trim()])),
      region: input.region,
      type: input.type,
      lat: Number(input.lat),
      lng: Number(input.lng),
      descriptions: Object.fromEntries(languages.map(language => [language, input.descriptions?.[language] || ''])),
      status: 'approved',
      createdAt: new Date().toISOString()
    };
    store.spots.push(spot);
    saveStore(dataDir, store);
    return sendJson(response, 201, spot);
  }

  if (url.pathname === '/api/ratings') {
    if (request.method === 'GET') {
      const voterId = url.searchParams.get('voterId');
      if (!isValidVoterId(voterId)) return sendJson(response, 400, { error: 'A valid voter ID is required.' });
      return sendJson(response, 200, Object.fromEntries(store.spots
        .filter(spot => spot.status === 'approved')
        .map(spot => [spot.id, getRatingSummary(store, spot.id, voterId)])));
    }
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });

    const input = await readJsonBody(request);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return sendJson(response, 400, { error: 'A valid spot, voter ID, and rating from 0 to 5 are required.' });
    }
    const value = Number(input.value);
    if (typeof input.spotId !== 'string' || !isValidVoterId(input.voterId) ||
      !Number.isInteger(value) || value < 0 || value > 5) {
      return sendJson(response, 400, { error: 'A valid spot, voter ID, and rating from 0 to 5 are required.' });
    }

    const spot = store.spots.find(item => item.id === input.spotId && item.status === 'approved');
    if (!spot) return sendJson(response, 404, { error: 'Spot not found.' });
    const existingIndex = store.ratings.findIndex(rating =>
      rating.spotId === input.spotId && rating.voterId === input.voterId);
    if (value === 0) {
      if (existingIndex !== -1) store.ratings.splice(existingIndex, 1);
    } else if (existingIndex === -1) {
      store.ratings.push({ spotId: input.spotId, voterId: input.voterId, value });
    } else {
      store.ratings[existingIndex].value = value;
    }
    saveStore(dataDir, store);
    return sendJson(response, 200, getRatingSummary(store, input.spotId, input.voterId));
  }

  if (url.pathname === '/api/admin/spots' || /^\/api\/admin\/spots\/[^/]+$/.test(url.pathname)) {
    if (!isAdminRequest(request, adminToken)) {
      return sendJson(response, 401, { error: 'Invalid admin token.' });
    }
    if (url.pathname === '/api/admin/spots') {
      if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed.' });
      return sendJson(response, 200, [...store.spots]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(({ id, names, region, type, lat, lng, descriptions, status, createdAt }) =>
          ({ id, names, region, type, lat, lng, descriptions, status, createdAt })));
    }
    if (request.method !== 'DELETE') return sendJson(response, 405, { error: 'Method not allowed.' });
    let id;
    try {
      id = decodeURIComponent(url.pathname.slice('/api/admin/spots/'.length));
    } catch {
      return sendJson(response, 400, { error: 'Invalid spot ID.' });
    }
    if (!id || id.length > 80) return sendJson(response, 400, { error: 'Invalid spot ID.' });
    const index = store.spots.findIndex(spot => spot.id === id);
    if (index === -1) return sendJson(response, 404, { error: 'Spot not found.' });
    store.spots.splice(index, 1);
    store.ratings = store.ratings.filter(rating => rating.spotId !== id);
    delete store.ratingSnapshots[id];
    saveStore(dataDir, store);
    return sendJson(response, 200, { id, status: 'deleted' });
  }

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return sendJson(response, 404, { error: 'Not found.' });
  }
  return serveStatic(request, response, url, staticDir);
}

function serveStatic(request, response, url, staticDir) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  const staticDirectory = staticDir;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendJson(response, 400, { error: 'Invalid path.' });
  }
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(staticDirectory, `.${relativePath.replaceAll('/', path.sep)}`);
  if (filePath !== staticDirectory && !filePath.startsWith(`${staticDirectory}${path.sep}`)) {
    return sendJson(response, 403, { error: 'Forbidden.' });
  }

  let resolvedPath = filePath;
  if (!existsSync(resolvedPath) || !statSync(resolvedPath).isFile()) {
    if (path.extname(relativePath)) return sendJson(response, 404, { error: 'Not found.' });
    resolvedPath = path.join(staticDirectory, 'index.html');
  }
  if (!existsSync(resolvedPath) || !statSync(resolvedPath).isFile()) {
    return sendJson(response, 503, { error: 'Build the frontend with npm run build before starting the server.' });
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  response.writeHead(200, {
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
    'Content-Length': statSync(resolvedPath).size,
    'Content-Type': contentTypes.get(extension) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  });
  if (request.method === 'HEAD') return response.end();
  response.end(readFileSync(resolvedPath));
}

export function createAppServer({
  adminToken = process.env.ADMIN_TOKEN,
  dataDir = process.env.DATA_DIR || path.join(rootDirectory, 'data'),
  staticDir = process.env.STATIC_DIR || path.join(rootDirectory, 'dist')
} = {}) {
  if (typeof adminToken !== 'string' || !adminToken.trim()) {
    throw new Error('ADMIN_TOKEN must be set before starting the server.');
  }
  const expectedAdminToken = adminToken.trim();
  const resolvedDataDir = path.resolve(dataDir);
  const resolvedStaticDir = path.resolve(staticDir);
  const store = loadStore(resolvedDataDir);

  return createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      handleApi(request, response, url, store, resolvedDataDir, resolvedStaticDir, expectedAdminToken)
        .catch(error => sendError(response, error));
    } catch (error) {
      sendError(response, error);
    }
  });
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
    const server = createAppServer();
    server.listen(port, '0.0.0.0', () => {
      console.log(`Skatespot server listening on port ${port}.`);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
