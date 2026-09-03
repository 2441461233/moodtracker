import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(project, 'tests/ui');
const output = await mkdtemp(join(tmpdir(), 'moodtracker-timeline-ui-'));
const contextMock = join(fixture, 'fixture-context.tsx');

const result = await build({
  absWorkingDir: project,
  entryPoints: [join(fixture, 'timeline-fixture.tsx')],
  outfile: join(output, 'app.js'),
  bundle: true,
  metafile: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  mainFields: ['browser', 'module', 'main'],
  resolveExtensions: [
    '.web.tsx',
    '.web.ts',
    '.web.jsx',
    '.web.js',
    '.tsx',
    '.ts',
    '.jsx',
    '.js',
    '.mjs',
    '.json',
  ],
  define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
  plugins: [
    {
      name: 'isolated-health-ui-fixture',
      setup(builder) {
        builder.onResolve(
          { filter: /(?:^|\/)context\/(?:MoodContext|HealthSyncContext)$/ },
          () => ({ path: contextMock }),
        );
        builder.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: contextMock }));
        builder.onResolve({ filter: /^react-native$/ }, () => ({
          path: join(project, 'node_modules/react-native-web/dist/index.js'),
        }));
        builder.onResolve({ filter: /^react-native-svg$/ }, () => ({
          path: join(project, 'node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js'),
        }));
        builder.onResolve({ filter: /^@expo\/vector-icons\/MaterialCommunityIcons$/ }, () => ({
          path: join(fixture, 'icon-mock.tsx'),
        }));
        builder.onResolve(
          {
            filter:
              /^(?:@react-native-async-storage\/async-storage|expo-haptics|expo-file-system|expo-sharing|expo-document-picker|expo)$/,
          },
          (args) => ({
            errors: [{ text: `Forbidden real service in isolated UI fixture: ${args.path}` }],
          }),
        );
      },
    },
  ],
});

const forbiddenInputs = Object.keys(result.metafile.inputs).filter((path) =>
  /(?:^|\/)src\/(?:storage\/(?!core\.ts$)|health\/index\.ts$|context\/(?:MoodContext|HealthSyncContext)\.tsx$)|modules\/mood-health\/src\/MoodHealthModule/.test(
    path,
  ),
);
if (forbiddenInputs.length)
  throw new Error(`Fixture isolation failed: ${forbiddenInputs.join(', ')}`);

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>MoodTracker 隔离 UI 测试 · 合成样本</title><style>
html,body,#fixture-root{height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#f7f8fc}.fixture-shell{height:100%;display:flex;flex-direction:column}.fixture-controls{padding:12px 18px;background:#fff8df;border-bottom:2px solid #c9a440;color:#403713;font-size:12px;line-height:1.5;display:flex;flex-direction:column;gap:7px;flex-shrink:0}.fixture-controls strong{font-size:14px}.fixture-controls small{color:#6f6042}.fixture-buttons{display:flex;flex-wrap:wrap;gap:7px}.fixture-buttons button{font:inherit;background:white;border:1px solid #d5c8a2;border-radius:7px;padding:6px 10px;cursor:pointer}.fixture-buttons button[aria-pressed=true]{background:#413761;color:white;border-color:#413761}.fixture-screen{display:flex;flex:1;min-height:0}.fixture-screen>div{flex:1;min-height:0}.fixture-controls details p{margin:5px 0;max-width:1000px}button:focus-visible{outline:3px solid #6c63df;outline-offset:2px}
</style></head><body><div id="fixture-root"></div><script src="/app.js"></script></body></html>`;
await writeFile(join(output, 'index.html'), html);
await writeFile(
  join(output, 'bundle-inputs.json'),
  JSON.stringify(Object.keys(result.metafile.inputs), null, 2),
);
const files = new Map([
  ['/', { body: Buffer.from(html), type: 'text/html; charset=utf-8' }],
  [
    '/app.js',
    { body: await readFile(join(output, 'app.js')), type: 'application/javascript; charset=utf-8' },
  ],
]);
const server = createServer((request, response) => {
  const address = server.address();
  if (
    !address ||
    typeof address === 'string' ||
    request.headers.host !== `127.0.0.1:${address.port}`
  ) {
    response.writeHead(403);
    response.end();
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end();
    return;
  }
  const file = files.get(new URL(request.url, `http://127.0.0.1:${address.port}`).pathname);
  if (!file) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    'content-type': file.type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy':
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'self'; base-uri 'none'; form-action 'none'",
    'cross-origin-resource-policy': 'same-origin',
  });
  response.end(request.method === 'HEAD' ? undefined : file.body);
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log(`ISOLATED_UI_URL=http://127.0.0.1:${address.port}/`);
  console.log(`ISOLATED_UI_OUTPUT=${output}`);
  console.log(
    `ISOLATION_CHECK=passed (${Object.keys(result.metafile.inputs).length} inputs; no production health/store bindings or context; pure storage validators allowed)`,
  );
  console.log(
    'Synthetic UI only. Not a native HealthKit or device test. Ctrl-C stops the loopback server.',
  );
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
