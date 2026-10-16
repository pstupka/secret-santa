/* eslint-disable security/detect-non-literal-fs-filename -- paths in a temp dir made by this test. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';
import { Application } from 'express';

import createApp from '@app';
import { Db } from '@db/database';
import { createTestClock, createTestDb } from '@test/harness';

const INDEX_HTML = '<!doctype html><div id="app"></div>';
const ASSET_JS = 'console.log("santa")';

describe('Client app serving', () => {
  let clientDir: string;
  let db: Db;
  let app: Application;

  beforeAll(async () => {
    clientDir = mkdtempSync(join(tmpdir(), 'santa-client-'));
    mkdirSync(join(clientDir, 'assets'));
    writeFileSync(join(clientDir, 'index.html'), INDEX_HTML);
    writeFileSync(join(clientDir, 'assets', 'index-abc123.js'), ASSET_JS);
    writeFileSync(join(clientDir, 'favicon.svg'), '<svg/>');

    db = await createTestDb();
    app = createApp({ db, clock: createTestClock() }, { clientDir });
  });

  afterAll(async () => {
    await db.destroy();
    rmSync(clientDir, { recursive: true, force: true });
  });

  test('serves index.html at the root', async () => {
    const res = await request(app).get('/').expect(httpStatus.OK);
    expect(res.text).toBe(INDEX_HTML);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  test('falls back to index.html for client routes (deep links)', async () => {
    const res = await request(app)
      .get('/events/some-event-id')
      .expect(httpStatus.OK);
    expect(res.text).toBe(INDEX_HTML);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  test('serves fingerprinted assets as immutable', async () => {
    const res = await request(app)
      .get('/assets/index-abc123.js')
      .expect(httpStatus.OK);
    expect(res.text).toBe(ASSET_JS);
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  test('serves other static files without long caching', async () => {
    const res = await request(app).get('/favicon.svg').expect(httpStatus.OK);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  test('a missing file is a 404, not the SPA', async () => {
    const res = await request(app)
      .get('/assets/missing-123.js')
      .expect(httpStatus.NOT_FOUND);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('the API still works', async () => {
    await request(app).get('/api/health').expect(httpStatus.OK);
  });

  test.each(['/api', '/api/no-such-endpoint', '/api/nope/deeper'])(
    'unknown API path %s stays a JSON 404',
    async (path) => {
      const res = await request(app).get(path).expect(httpStatus.NOT_FOUND);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    },
  );

  test('non-GET requests to client routes are a 404', async () => {
    await request(app).post('/events/x').expect(httpStatus.NOT_FOUND);
  });

  test('without a client dir the API is served alone', async () => {
    const apiOnly = createApp({ db, clock: createTestClock() });
    await request(apiOnly).get('/').expect(httpStatus.NOT_FOUND);
    await request(apiOnly).get('/api/health').expect(httpStatus.OK);
  });
});
