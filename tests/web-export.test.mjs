import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, test } from 'node:test';

// Read-only build-artifact checks. Integrate after build:web, then run with:
// node --test tests/web-export.test.mjs
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(ROOT, 'dist');
const BASE = '/moodtracker/';
const ORIGIN = 'https://2441461233.github.io';
const workerSource = await readFile(join(DIST, 'sw.js'), 'utf8');
const registrationSource = await readFile(join(DIST, 'register-sw.js'), 'utf8');
const html = await readFile(join(DIST, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(join(DIST, 'manifest.webmanifest'), 'utf8'));
const prepareSource = await readFile(join(ROOT, 'scripts/prepare-web.mjs'), 'utf8');

function workerHarness({ network, precacheFailure } = {}) {
  const listeners = new Map();
  const cacheData = new Map();
  const opened = [];
  const deleted = [];
  const precached = [];
  const fetches = [];
  let claims = 0;
  let forcedActivations = 0;
  const absolute = (value) => new URL(typeof value === 'string' ? value : value.url, ORIGIN).href;
  function dataFor(name) {
    if (!cacheData.has(name)) cacheData.set(name, new Map());
    return cacheData.get(name);
  }
  const caches = {
    async open(name) {
      opened.push(name);
      const data = dataFor(name);
      return {
        async addAll(paths) {
          if (precacheFailure) throw precacheFailure;
          for (const path of paths) {
            precached.push(path);
            data.set(absolute(path), { source: 'precache', path, ok: true, status: 200 });
          }
        },
        async match(request) {
          return data.get(absolute(request));
        },
      };
    },
    async keys() {
      return [...cacheData.keys()];
    },
    async delete(name) {
      deleted.push(name);
      return cacheData.delete(name);
    },
  };
  const context = vm.createContext({
    URL,
    caches,
    self: {
      location: { origin: ORIGIN },
      addEventListener(name, callback) {
        listeners.set(name, callback);
      },
      clients: {
        async claim() {
          claims++;
        },
      },
      async skipWaiting() {
        forcedActivations++;
      },
    },
    async fetch(request) {
      fetches.push(request);
      if (network) return network(request);
      return { source: 'network', ok: true, status: 200 };
    },
  });
  vm.runInContext(workerSource, context, { filename: 'dist/sw.js', timeout: 1000 });
  const constants = vm.runInContext('({ PREFIX, CACHE, INDEX, ASSETS })', context);
  const assets = Array.from(constants.ASSETS);
  function seed(name, path, response) {
    dataFor(name).set(absolute(path), response);
  }
  async function lifecycle(name) {
    const work = [];
    listeners.get(name)({
      waitUntil(value) {
        work.push(Promise.resolve(value));
      },
    });
    await Promise.all(work);
  }
  async function request(path, { method = 'GET', mode = 'cors' } = {}) {
    const request = { url: new URL(path, ORIGIN).href, method, mode };
    let response;
    let interceptions = 0;
    listeners.get('fetch')({
      request,
      respondWith(value) {
        interceptions++;
        response = Promise.resolve(value);
      },
    });
    return {
      intercepted: interceptions > 0,
      interceptions,
      response: response ? await response : undefined,
    };
  }
  return {
    ...constants,
    ASSETS: assets,
    request,
    lifecycle,
    seed,
    cacheData,
    opened,
    deleted,
    precached,
    fetches,
    stats: () => ({ claims, forcedActivations }),
  };
}
const constants = workerHarness();

function meta(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = html.match(
    new RegExp(`<meta\\s+(?:name|property)="${escaped}"\\s+content="([^"]*)"`),
  );
  assert.ok(result, `missing metadata ${name}`);
  return result[1];
}
async function assertDistFile(path) {
  assert.ok(path.startsWith(BASE), `${path} does not use the publishing base path`);
  const relative = decodeURIComponent(path.slice(BASE.length));
  const local = resolve(DIST, relative);
  assert.ok(local.startsWith(resolve(DIST) + sep), `${path} escapes the dist directory`);
  assert.equal((await stat(local)).isFile(), true, `missing export asset ${path}`);
}
function pngSize(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('published artifact paths and metadata', () => {
  test('every precache path corresponds to a real scoped dist file exactly once', async () => {
    assert.ok(constants.ASSETS.length > 0);
    assert.equal(new Set(constants.ASSETS).size, constants.ASSETS.length);
    for (const path of constants.ASSETS) await assertDistFile(path);
    for (const required of [
      'index.html',
      'register-sw.js',
      'manifest.webmanifest',
      'icon-512.png',
    ]) {
      assert.ok(
        constants.ASSETS.includes(BASE + required),
        `missing required shell resource ${required}`,
      );
    }
    assert.equal(constants.INDEX, BASE + 'index.html');
  });
  test('precache has no backup JSON/CSV, service worker or social preview image', () => {
    assert.ok(constants.ASSETS.every((path) => !/\.(?:json|csv|map)$/.test(path)));
    assert.ok(!constants.ASSETS.includes(BASE + 'sw.js'));
    assert.ok(!constants.ASSETS.includes(BASE + 'og.png'));
    assert.ok(constants.ASSETS.every((path) => new URL(path, ORIGIN).origin === ORIGIN));
  });
  test('HTML static references all resolve under the same publishing base', async () => {
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    for (const path of references.filter((path) => path.startsWith('/')))
      await assertDistFile(path);
    assert.ok(references.some((path) => path.startsWith(BASE + '_expo/static/js/web/')));
    assert.ok(references.includes(BASE + 'register-sw.js'));
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /<title>MoodTracker · 心情日记<\/title>/);
    assert.match(meta('viewport'), /viewport-fit=cover/);
    assert.equal((await stat(join(DIST, '.nojekyll'))).isFile(), true);
  });
  test('manifest points to the project root and describes the actual icon dimensions', async () => {
    assert.equal(manifest.id, BASE);
    assert.equal(manifest.start_url, BASE);
    assert.equal(manifest.scope, BASE);
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.lang, 'zh-CN');
    assert.equal(manifest.icons.length, 1);
    const icon = manifest.icons[0];
    assert.equal(icon.src, BASE + 'icon-512.png');
    assert.equal(icon.sizes, '512x512');
    assert.equal(icon.type, 'image/png');
    assert.match(icon.purpose, /\bany\b/);
    assert.match(icon.purpose, /\bmaskable\b/);
    assert.deepEqual(pngSize(await readFile(join(DIST, 'icon-512.png'))), {
      width: 512,
      height: 512,
    });
  });
  test('OpenGraph/canonical/Twitter URLs and declared image dimensions match the export', async () => {
    assert.equal(meta('og:url'), ORIGIN + BASE);
    assert.equal(meta('og:image'), ORIGIN + BASE + 'og.png');
    assert.equal(meta('twitter:image'), meta('og:image'));
    assert.equal(meta('twitter:card'), 'summary_large_image');
    assert.equal(meta('og:type'), 'website');
    assert.equal(meta('og:locale'), 'zh_CN');
    assert.equal(meta('og:title'), 'MoodTracker · 心情日记');
    assert.ok(meta('description').length > 20);
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/2441461233\.github\.io\/moodtracker\/">/,
    );
    assert.deepEqual(pngSize(await readFile(join(DIST, 'og.png'))), {
      width: Number(meta('og:image:width')),
      height: Number(meta('og:image:height')),
    });
  });
  test('cache version is exactly a digest of every precached path AND file contents', async () => {
    const digest = createHash('sha256');
    const relative = constants.ASSETS.map((path) => path.slice(BASE.length)).sort();
    for (const path of relative) digest.update(path).update(await readFile(join(DIST, path)));
    assert.equal(constants.CACHE, constants.PREFIX + digest.digest('hex').slice(0, 16));
  });
});

describe('service worker routing and lifecycle without network or browser', () => {
  test('install precaches the application shell but never forces activation', async () => {
    const worker = workerHarness();
    await worker.lifecycle('install');
    assert.deepEqual(worker.precached, worker.ASSETS);
    assert.deepEqual(worker.opened, [worker.CACHE]);
    assert.equal(worker.stats().forcedActivations, 0);
    assert.equal(worker.stats().claims, 0);
  });
  test('failed precache rejects installation without taking over existing clients', async () => {
    const worker = workerHarness({ precacheFailure: new Error('missing shell asset') });
    await assert.rejects(worker.lifecycle('install'), /missing shell asset/);
    assert.deepEqual(worker.stats(), { claims: 0, forcedActivations: 0 });
  });
  test('activate removes only obsolete MoodTracker caches, then claims clients', async () => {
    const worker = workerHarness();
    worker.seed(worker.CACHE, worker.INDEX, { current: true });
    worker.seed(worker.PREFIX + 'old-version', worker.INDEX, { old: true });
    worker.seed('another-project-cache', '/another/index.html', { foreign: true });
    worker.seed('moodtracker-user-backups', '/backup.json', { private: true });
    await worker.lifecycle('activate');
    assert.deepEqual(worker.deleted, [worker.PREFIX + 'old-version']);
    assert.ok(worker.cacheData.has(worker.CACHE));
    assert.ok(worker.cacheData.has('another-project-cache'));
    assert.ok(worker.cacheData.has('moodtracker-user-backups'));
    assert.deepEqual(worker.stats(), { claims: 1, forcedActivations: 0 });
  });
  test('GET navigation is network-first when the server responds successfully', async () => {
    const response = { source: 'online', ok: true, status: 200 };
    const worker = workerHarness({ network: async () => response });
    worker.seed(worker.CACHE, worker.INDEX, { source: 'old cached shell' });
    const result = await worker.request(BASE, { mode: 'navigate' });
    assert.equal(result.interceptions, 1);
    assert.equal(result.response, response);
    assert.equal(worker.fetches.length, 1);
    assert.equal(worker.opened.length, 0);
  });
  test('offline navigation falls back to the cached index for root and SPA paths', async () => {
    const worker = workerHarness({
      network: async () => {
        throw new TypeError('offline');
      },
    });
    const cached = { source: 'cached application', ok: true, status: 200 };
    worker.seed(worker.CACHE, worker.INDEX, cached);
    for (const path of [BASE, BASE + 'index.html', BASE + 'calendar?view=month']) {
      const result = await worker.request(path, { mode: 'navigate' });
      assert.equal(result.response, cached);
      assert.equal(result.interceptions, 1);
    }
  });
  test('HTTP 503 and HTTP 404 navigation also fall back to cached application', async () => {
    for (const status of [503, 404]) {
      const worker = workerHarness({ network: async () => ({ status, ok: false }) });
      const cached = { source: 'cached application', ok: true, status: 200 };
      worker.seed(worker.CACHE, worker.INDEX, cached);
      assert.equal((await worker.request(BASE, { mode: 'navigate' })).response, cached);
    }
  });
  test('only same-origin GET requests within the exact base scope are handled', async () => {
    const worker = workerHarness();
    for (const [path, options] of [
      ['https://example.com/moodtracker/index.html', { mode: 'navigate' }],
      ['http://2441461233.github.io/moodtracker/index.html', { mode: 'navigate' }],
      ['/other-app/', { mode: 'navigate' }],
      ['/moodtracker-other/', { mode: 'navigate' }],
      ['/moodtracker', { mode: 'navigate' }],
      [BASE, { method: 'POST', mode: 'navigate' }],
      [BASE + 'index.html', { method: 'HEAD' }],
      [BASE + 'journal', { method: 'PUT' }],
    ]) {
      assert.equal(
        (await worker.request(path, options)).intercepted,
        false,
        `${options.method ?? 'GET'} ${path}`,
      );
    }
    assert.equal(worker.fetches.length, 0);
    assert.equal(worker.opened.length, 0);
  });
  test('backup downloads, user-data fetches and foreign assets are never cached or intercepted', async () => {
    const worker = workerHarness();
    for (const path of [
      BASE + 'moodtracker-backup.json',
      BASE + 'journal.csv',
      BASE + 'api/entries',
      'https://cdn.example.com/app.js',
    ]) {
      assert.equal((await worker.request(path)).intercepted, false, path);
    }
    assert.equal(worker.opened.length, 0);
    assert.equal(worker.precached.length, 0);
    assert.equal(worker.fetches.length, 0);
  });
  test('known static assets are cache-first and a cache miss reaches the network', async () => {
    const response = { source: 'fetched asset', ok: true, status: 200 };
    const worker = workerHarness({ network: async () => response });
    const asset = worker.ASSETS.find((path) => path.endsWith('.ttf')) ?? worker.ASSETS[0];
    const cached = { source: 'cached font', ok: true, status: 200 };
    worker.seed(worker.CACHE, asset, cached);
    assert.equal((await worker.request(asset)).response, cached);
    assert.equal(worker.fetches.length, 0);
    const missing = worker.ASSETS.find((path) => path !== asset);
    assert.equal((await worker.request(missing)).response, response);
    assert.equal(worker.fetches.length, 1);
  });
  test('worker has no localStorage, IndexedDB, backup-writing or forced reload logic', () => {
    assert.doesNotMatch(
      workerSource,
      /\b(?:localStorage|indexedDB|skipWaiting|location\.reload)\b/,
    );
    assert.doesNotMatch(workerSource, /cache\.put\(/);
  });
});

describe('worker registration and content-hash regression', () => {
  test('registers only on load with the exact deployment script and scope', async () => {
    const events = new Map();
    const registrations = [];
    const context = vm.createContext({
      window: {
        addEventListener(name, callback) {
          events.set(name, callback);
        },
      },
      navigator: {
        serviceWorker: {
          register(url, options) {
            registrations.push({ url, scope: options.scope });
            return Promise.resolve({});
          },
        },
      },
      console: { info() {} },
    });
    vm.runInContext(registrationSource, context);
    assert.equal(registrations.length, 0);
    assert.ok(events.has('load'));
    events.get('load')();
    await Promise.resolve();
    assert.deepEqual(registrations, [{ url: BASE + 'sw.js', scope: BASE }]);
  });
  test('unsupported browsers and denied registration do not throw', async () => {
    vm.runInNewContext(registrationSource, { navigator: {} });
    let onLoad;
    let logged = false;
    vm.runInNewContext(registrationSource, {
      navigator: { serviceWorker: { register: () => Promise.reject(new Error('denied')) } },
      window: {
        addEventListener(_event, callback) {
          onLoad = callback;
        },
      },
      console: {
        info() {
          logged = true;
        },
      },
    });
    onLoad();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(logged, true);
  });
  test('changing a fixed-name icon changes worker/cache version with unchanged filenames', async () => {
    const before = await runPrepareInMemory('first icon bytes');
    const after = await runPrepareInMemory('changed icon bytes');
    const identical = await runPrepareInMemory('first icon bytes');
    assert.equal(
      before.assets,
      after.assets,
      'asset filenames must remain unchanged in this regression',
    );
    assert.notEqual(before.cache, after.cache);
    assert.equal(before.cache, identical.cache, 'same contents must generate a stable hash');
    assert.equal(before.logs.length, 1);
  });
});

async function runPrepareInMemory(iconBytes) {
  // Execute the actual export-preparation script, replacing only ESM imports
  // with supplied APIs. All filesystem calls use this Map, including writes.
  // The space in the virtual directory catches URL.pathname vs fileURLToPath.
  const virtualRoot = '/virtual/Mood Space';
  const disk = new Map([
    [virtualRoot + '/assets/og.png', Buffer.from('OG image')],
    [virtualRoot + '/assets/pwa-icon.png', Buffer.from(iconBytes)],
    [
      virtualRoot + '/dist/index.html',
      Buffer.from(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Expo</title></head><body><script src="/moodtracker/app.js"></script></body></html>',
      ),
    ],
    [virtualRoot + '/dist/app.js', Buffer.from('console.log("public shell");')],
    [virtualRoot + '/dist/assets/font.woff2', Buffer.from('font contents')],
  ]);
  const pathOf = (value) => (value instanceof URL ? fileURLToPath(value) : value);
  const logs = [];
  const context = vm.createContext({
    createHash,
    join,
    fileURLToPath,
    URL,
    SCRIPT_URL: 'file:///virtual/Mood%20Space/scripts/prepare-web.mjs',
    console: {
      log(message) {
        logs.push(message);
      },
    },
    async readFile(path, encoding) {
      const value = disk.get(pathOf(path));
      if (!value) throw new Error(`Missing in-memory file ${pathOf(path)}`);
      return encoding ? value.toString(encoding) : Buffer.from(value);
    },
    async writeFile(path, value) {
      disk.set(pathOf(path), Buffer.from(value));
    },
    async copyFile(from, to) {
      const value = disk.get(pathOf(from));
      assert.ok(value, `Missing copy source ${pathOf(from)}`);
      disk.set(pathOf(to), Buffer.from(value));
    },
    async readdir(path) {
      const prefix = pathOf(path).replace(/\/$/, '') + '/';
      const children = new Map();
      for (const key of disk.keys()) {
        if (!key.startsWith(prefix)) continue;
        const relative = key.slice(prefix.length);
        const name = relative.split('/')[0];
        children.set(name, relative.includes('/'));
      }
      assert.ok(children.size, `Missing in-memory directory ${prefix}`);
      return [...children].map(([name, directory]) => ({ name, isDirectory: () => directory }));
    },
  });
  const body = prepareSource
    .replace(/^import\b[\s\S]*?;\r?\n/gm, '')
    .replaceAll('import.meta.url', 'SCRIPT_URL');
  await vm.runInContext(`(async () => { ${body}\n })()`, context, { timeout: 1000 });
  const generated = disk.get(virtualRoot + '/dist/sw.js').toString('utf8');
  const cache = generated.match(/const CACHE = ([^;]+);/)[1];
  const assets = generated.match(/const ASSETS = ([^;]+);/)[1];
  assert.ok(disk.has(virtualRoot + '/dist/.nojekyll'));
  return { cache, assets, logs };
}
