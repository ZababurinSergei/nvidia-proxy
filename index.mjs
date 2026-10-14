import http from 'node:http';
import https from 'node:https';

const SECRET = process.env.PROXY_SECRET || 'change-me';
const TARGET_HOST = 'integrate.api.nvidia.com';
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const secret = req.headers['x-proxy-secret'] || url.searchParams.get('secret');

    if (secret !== SECRET) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    url.searchParams.delete('secret');
    const path = url.pathname + (url.search || '');

    // Копируем заголовки, убираем проблемные и secret
    const headers = { ...req.headers };
    delete headers['x-proxy-secret'];
    delete headers['host'];
    delete headers['connection'];
    headers.host = TARGET_HOST;

    const proxyReq = https.request({
      hostname: TARGET_HOST,
      path,
      method: req.method,
      headers,
      timeout: 60000,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy error]', err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Proxy error: ' + err.message);
      } else {
        try { res.end(); } catch {}
      }
    });

    proxyReq.on('timeout', () => {
      console.error('[proxy timeout]');
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504);
        res.end('Proxy timeout');
      }
    });

    req.on('error', (err) => {
      console.error('[request error]', err.message);
      proxyReq.destroy();
    });

    req.pipe(proxyReq);
  } catch (err) {
    console.error('[handler error]', err.message, err.stack);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Handler error');
    }
  }
});

server.on('clientError', (err, socket) => {
  console.error('[clientError]', err.message);
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy listening on port ${PORT}`);
});
