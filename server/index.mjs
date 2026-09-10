import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createTranscriptionHandler } from './transcription.mjs';

const handler = createTranscriptionHandler();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3100);
const server = createServer(async (req, res) => {
  const controller = new AbortController();
  req.on('aborted', () => controller.abort());
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      signal: controller.signal,
      ...(['GET', 'HEAD'].includes(req.method)
        ? {}
        : { body: Readable.toWeb(req), duplex: 'half' }),
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
server.requestTimeout = 155000;
server.headersTimeout = 15000;
server.listen(port, host, () => {
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Voice service: http://${host}:${boundPort} (audio and transcripts are not logged)`);
});
