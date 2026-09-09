import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranscriptionHandler } from './transcription.mjs';
const env = {
  VOICE_ACCESS_TOKEN: 'synthetic-access-token-for-tests',
  SILICONFLOW_API_KEY: 'synthetic-provider-key',
  ALLOWED_ORIGINS: 'https://app.example.com',
};
const audio = Buffer.from([0, 0, 0, 20, ...Buffer.from('ftypM4A '), 0, 0, 0, 0, 0]);
function request(options = {}) {
  return new Request('https://service.example.com/transcribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.VOICE_ACCESS_TOKEN}`,
      'Content-Type': 'audio/mp4',
      'X-Recording-Id': 'voice-synthetic-01',
      'X-Recording-Duration': '26000',
      ...options.headers,
    },
    body: options.body ?? audio,
  });
}
const response = (value) => new Response(JSON.stringify(value));
test('auth, CORS, missing configuration and invalid audio never call provider', async () => {
  const handler = createTranscriptionHandler({
    env,
    fetchImpl: () => {
      throw new Error('must not call');
    },
  });
  assert.equal((await handler(request({ headers: { Authorization: 'wrong' } }))).status, 401);
  assert.equal(
    (await handler(request({ headers: { Origin: 'https://evil.example.com' } }))).status,
    403,
  );
  assert.equal((await handler(request({ body: 'not audio' }))).status, 400);
  assert.equal(
    (await handler(request({ headers: { 'X-Recording-Duration': '600000' } }))).status,
    400,
  );
  assert.equal(
    (await handler(request({ headers: { 'Content-Length': String(13 * 1024 * 1024) } }))).status,
    413,
  );
  assert.equal((await createTranscriptionHandler({ env: {} })(request())).status, 503);
});
test('one audio upload and cleanup produce display text plus original; duplicate request is cached', async () => {
  const calls = [];
  const handler = createTranscriptionHandler({
    env,
    fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(options.headers.Authorization, `Bearer ${env.SILICONFLOW_API_KEY}`);
      if (url.endsWith('/transcriptions')) {
        assert.equal(options.body.get('model'), 'FunAudioLLM/SenseVoiceSmall');
        assert.deepEqual(Buffer.from(await options.body.get('file').arrayBuffer()), audio);
        return response({ text: '我并没有不开心只是累了' });
      }
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'deepseek-ai/DeepSeek-V4-Flash');
      assert.equal(payload.enable_thinking, false);
      assert.equal(payload.messages[1].content, '我并没有不开心只是累了');
      return response({
        choices: [{ finish_reason: 'stop', message: { content: '我并没有不开心，只是累了。' } }],
      });
    },
  });
  const first = await handler(request({ headers: { Origin: 'https://app.example.com' } }));
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), 'https://app.example.com');
  assert.deepEqual(await first.json(), {
    text: '我并没有不开心，只是累了。',
    originalText: '我并没有不开心只是累了',
  });
  assert.equal((await handler(request())).status, 200);
  assert.equal(calls.length, 2);
  assert.equal(
    (await handler(request({ body: Buffer.concat([audio, Buffer.from('changed')]) }))).status,
    409,
  );
});
test('cleanup failure or truncated generation retains recognized text with a visible warning', async () => {
  for (const truncated of [false, true]) {
    const handler = createTranscriptionHandler({
      env,
      fetchImpl: async (url) =>
        url.endsWith('/transcriptions')
          ? response({ text: '完整原文' })
          : truncated
            ? response({ choices: [{ finish_reason: 'length', message: { content: '截断' } }] })
            : new Response('provider detail must not leak', { status: 503 }),
    });
    const data = await (await handler(request())).json();
    assert.equal(data.text, '完整原文');
    assert.match(data.warning, /暂未完成/);
  }
});
test('recognition errors do not masquerade as successful or disclose provider responses', async () => {
  const handler = createTranscriptionHandler({
    env,
    fetchImpl: async () => new Response('secret provider detail', { status: 401 }),
  });
  const result = await handler(request());
  assert.equal(result.status, 502);
  assert.doesNotMatch(await result.text(), /secret/);
});
test('concurrent duplicate upload is deduplicated, capacity is bounded', async () => {
  let release;
  let calls = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const handler = createTranscriptionHandler({
    env,
    fetchImpl: async (url) => {
      calls++;
      if (url.endsWith('/transcriptions')) {
        await pending;
        return response({ text: '原文' });
      }
      return response({ choices: [{ finish_reason: 'stop', message: { content: '原文。' } }] });
    },
  });
  const first = handler(request());
  const second = handler(request());
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(
    (await handler(request({ headers: { 'X-Recording-Id': 'voice-synthetic-02' } }))).status,
    429,
  );
  release();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal(calls, 2);
});
