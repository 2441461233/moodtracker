/** Finish Expo's static export without introducing a second frontend runtime. */
import { createHash } from 'node:crypto';
import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = new URL('../dist/', import.meta.url);
const base = '/moodtracker/';
const origin = 'https://2441461233.github.io';
const title = 'MoodTracker · 心情日记';
const description =
  '每一天，都值得被看见。记录心情、回看日历、发现生活里的小规律。无需注册，心情只在本设备保存。';

await copyFile(new URL('../assets/og.png', import.meta.url), new URL('og.png', output));
await copyFile(new URL('../assets/pwa-icon.png', import.meta.url), new URL('icon-512.png', output));
await writeFile(new URL('.nojekyll', output), '');
await writeFile(
  new URL('manifest.webmanifest', output),
  JSON.stringify(
    {
      id: base,
      name: 'MoodTracker · 心情日记',
      short_name: '心情日记',
      description,
      start_url: base,
      scope: base,
      display: 'standalone',
      background_color: '#F7F8FC',
      theme_color: '#6C63DF',
      lang: 'zh-CN',
      icons: [
        {
          src: `${base}icon-512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    null,
    2,
  ),
);

let html = await readFile(new URL('index.html', output), 'utf8');
html = html
  .replace(/<html[^>]*>/, '<html lang="zh-CN">')
  .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
  .replace(
    /<meta\s+name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  );
html = html.replace(
  '</head>',
  `
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#6C63DF">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${origin}${base}">
  <meta property="og:image" content="${origin}${base}og.png">
  <meta property="og:image:width" content="1672">
  <meta property="og:image:height" content="941">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${origin}${base}og.png">
  <link rel="canonical" href="${origin}${base}">
  <link rel="manifest" href="${base}manifest.webmanifest">
  <link rel="apple-touch-icon" href="${base}icon-512.png">
  <style>
    body { background: #F7F8FC; overscroll-behavior-y: none; }
    :focus-visible { outline: 3px solid #6C63DF !important; outline-offset: 3px; }
    input:focus-visible, textarea:focus-visible { outline-offset: -2px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
  </style>
  <script src="${base}register-sw.js" defer></script>
</head>`,
);
await writeFile(new URL('index.html', output), html);

// Cache only the public application shell, never journals or exported backups.
const registration = `if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('${base}sw.js', {scope:'${base}'}).catch(() => {
      console.info('Offline caching is unavailable in this browser; online use is unaffected.');
    });
  });
}\n`;
await writeFile(new URL('register-sw.js', output), registration);

async function files(directory, prefix = '') {
  const items = await readdir(directory, { withFileTypes: true });
  const lists = await Promise.all(
    items.map((item) =>
      item.isDirectory()
        ? files(join(directory, item.name), `${prefix}${item.name}/`)
        : `${prefix}${item.name}`,
    ),
  );
  return lists.flat();
}
const paths = (await files(fileURLToPath(output)))
  .filter(
    (path) =>
      path !== 'og.png' &&
      path !== 'sw.js' &&
      /\.(html|js|css|png|jpg|jpeg|webp|ttf|woff2?|ico|webmanifest)$/.test(path),
  )
  .sort();
const digest = createHash('sha256');
for (const path of paths) digest.update(path).update(await readFile(new URL(path, output)));
const version = digest.digest('hex').slice(0, 16);
const worker = `const PREFIX = 'moodtracker-web-v2-';
const CACHE = PREFIX + '${version}';
const INDEX = '${base}index.html';
const ASSETS = ${JSON.stringify(paths.map((path) => base + path))};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Do not force activation/reload while a journal draft is open.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('${base}')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (!response.ok) throw new Error('Navigation unavailable');
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(INDEX))));
    return;
  }
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});\n`;
await writeFile(new URL('sw.js', output), worker);
console.log(`Web export ready: ${origin}${base} (${paths.length} offline assets, ${version})`);
