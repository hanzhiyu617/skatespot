import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import adminSpotsFunction from '../api/admin/spots.mjs';
import deleteSpotFunction from '../api/admin/spots/[id].mjs';
import { importNetlifyData } from '../scripts/import-netlify.mjs';
import { loadStore } from '../lib/store.mjs';
import { createAppServer } from '../server.mjs';

test('self-hosted API supports public spots, ratings, admin auth, and deletion', async t => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'skatespot-test-'));
  const dataDir = path.join(tempDir, 'data');
  const staticDir = path.join(tempDir, 'public');
  mkdirSync(staticDir);
  writeFileSync(path.join(staticDir, 'index.html'), '<main>Skatespot</main>');
  const server = createAppServer({ adminToken: 'test-admin-token', dataDir, staticDir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(tempDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(baseUrl);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Skatespot/);

  const initialSpotsResponse = await fetch(`${baseUrl}/api/spots`);
  const initialSpots = await initialSpotsResponse.json();
  assert.equal(initialSpotsResponse.status, 200);
  assert.equal(initialSpots.length, 6);

  const invalidAdminResponse = await fetch(`${baseUrl}/api/admin/spots`, {
    headers: { Authorization: 'Bearer wrong-token' }
  });
  assert.equal(invalidAdminResponse.status, 401);

  const createdResponse = await fetch(`${baseUrl}/api/spots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      names: { en: 'Test spot', ko: '테스트 장소', zh: '测试地点' },
      region: 'Seoul',
      type: 'Outdoor',
      lat: 37.5,
      lng: 127,
      descriptions: { en: '', ko: '', zh: '' }
    })
  });
  assert.equal(createdResponse.status, 201);
  const createdSpot = await createdResponse.json();
  assert.equal(createdSpot.status, 'approved');

  const voterId = 'c8f14e74-62e7-4e16-a4cc-b42284ef2cf3';
  const ratingResponse = await fetch(`${baseUrl}/api/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spotId: createdSpot.id, voterId, value: 5 })
  });
  assert.equal(ratingResponse.status, 200);
  assert.deepEqual(await ratingResponse.json(), { average: 5, count: 1, mine: 5 });

  const adminResponse = await fetch(`${baseUrl}/api/admin/spots`, {
    headers: { Authorization: 'Bearer test-admin-token' }
  });
  assert.equal(adminResponse.status, 200);
  assert.ok((await adminResponse.json()).some(spot => spot.id === createdSpot.id));

  const deleteResponse = await fetch(`${baseUrl}/api/admin/spots/${createdSpot.id}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer test-admin-token' }
  });
  assert.equal(deleteResponse.status, 200);

  const remainingSpots = await (await fetch(`${baseUrl}/api/spots`)).json();
  assert.ok(!remainingSpots.some(spot => spot.id === createdSpot.id));
  const remainingRatings = await (await fetch(`${baseUrl}/api/ratings?voterId=${voterId}`)).json();
  assert.equal(Object.hasOwn(remainingRatings, createdSpot.id), false);
});

test('server requires an admin token', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'skatespot-test-'));
  try {
    assert.throws(() => createAppServer({ adminToken: '', dataDir: tempDir }), /ADMIN_TOKEN must be set/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Netlify migration imports spots and rating snapshots idempotently', async t => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'skatespot-import-test-'));
  const source = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/spots') {
      response.end(JSON.stringify([{
        id: 'migrated-spot',
        names: { en: 'Migrated spot', ko: '이전 장소', zh: '迁移地点' },
        region: 'Seoul',
        type: 'Outdoor',
        lat: 37.5,
        lng: 127,
        descriptions: { en: '', ko: '', zh: '' },
        createdAt: '2026-01-01T00:00:00.000Z'
      }]));
      return;
    }
    response.end(JSON.stringify({ 'migrated-spot': { average: 4.3, count: 7, mine: 0 } }));
  });
  source.listen(0, '127.0.0.1');
  await once(source, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => source.close(error => error ? reject(error) : resolve()));
    rmSync(tempDir, { recursive: true, force: true });
  });

  const url = `http://127.0.0.1:${source.address().port}`;
  assert.equal(await importNetlifyData(url, tempDir), 1);
  assert.equal(await importNetlifyData(url, tempDir), 0);
  const store = loadStore(tempDir);
  assert.ok(store.spots.some(spot => spot.id === 'migrated-spot'));
  assert.deepEqual(store.ratingSnapshots['migrated-spot'], { average: 4.3, count: 7 });
});

test('Vercel admin functions delegate auth and reject malformed spot IDs', async () => {
  const previousToken = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'vercel-test-token';
  try {
    const unauthorized = await adminSpotsFunction.fetch(new Request('https://example.test/api/admin/spots', {
      headers: { Authorization: 'Bearer wrong-token' }
    }));
    assert.equal(unauthorized.status, 401);

    const malformedId = await deleteSpotFunction.fetch(new Request('https://example.test/api/admin/spots/%ZZ', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer vercel-test-token' }
    }));
    assert.equal(malformedId.status, 400);
  } finally {
    if (previousToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previousToken;
  }
});
