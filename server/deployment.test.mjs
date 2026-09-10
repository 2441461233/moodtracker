import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';

test('production entrypoint starts with injected variables and no dotenv file', async (t) => {
  const child = spawn(process.execPath, [new URL('./index.mjs', import.meta.url).pathname], {
    cwd: '/tmp',
    env: {
      HOST: '127.0.0.1',
      PORT: '0',
      SILICONFLOW_API_KEY: 'synthetic-provider-key',
      VOICE_ACCESS_TOKEN: 'synthetic-access-token-for-deployment-test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  t.after(async () => {
    child.kill('SIGTERM');
    await exited;
  });
  const address = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start')), 5000);
    timer.unref();
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.once('error', reject);
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('Server exited before startup'));
    });
  });
  const health = await fetch(`${address}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ready' });
  const unauthorized = await fetch(`${address}/transcribe`, { method: 'POST' });
  assert.equal(unauthorized.status, 401);
});
