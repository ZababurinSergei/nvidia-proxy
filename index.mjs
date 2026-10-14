import http from 'node:http';
import https from 'node:https';

const SECRET = process.env.PROXY_SECRET || 'change-me';
const TARGET_HOST = 'integrate.api.nvidia.com';
const PORT = Number(process.env.PORT) || 10000;

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://x');
    const path = url.pathname;

    // Читаем секрет ИЗ ЗАГОЛОВКА (основной путь) ИЛИ из query (fallback для curl)
    const secretFromHeader = req.headers['x-proxy-secret'];
    const secretFromQuery = url.searchParams.get('secret');
    const secret = secretFromHeader || secretFromQuery;

    // Статика
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<h1>NVIDIA Proxy</h1><p>OK. Use X-Proxy-Secret header or ?secret= query.</p>');
    }
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    }

    // Прокси
    if (path.startsWith('/v1') || path.startsWith('/v2')) {
      if (secret !== SECRET) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        return res.end('Forbidden: invalid or missing secret');
      }

      // Убираем secret из query, оставляем чистый путь + query
      url.searchParams.delete('secret');
      const targetPath = url.pathname + (url.search ? url.search : '');

      // Копируем заголовки, убираем наши
      const headers = { ...req.headers };
      delete headers['x-proxy-secret'];
      delete headers['host'];
      delete headers['connection'];
      headers.host = TARGET_HOST;

      const proxyReq = https.request({
        hostname: TARGET_HOST,
        path: targetPath,
        method: req.method,
        headers,
        timeout: 180000,
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[proxy error]', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'text/plain' });
          res.end('Proxy error: ' + err.message);
        } else {
          try { res.end(); } catch {}
        }
      });

      proxyReq.on('timeout', () => {
        console.error('[proxy timeout]');
        proxyReq.destroy();
        if (!res.headersSent) {
          res.writeHead(504, { 'content-type': 'text/plain' });
          res.end('Proxy timeout');
        }
      });

      req.on('error', () => proxyReq.destroy());
      req.pipe(proxyReq);
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found: ' + path);
  } catch (err) {
    console.error('[handler error]', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Handler error');
    }
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

process.on('uncaughtException', (err) => console.error('[uncaught]', err.message));
process.on('unhandledRejection', (err) => console.error('[unhandled]', err));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy listening on port ${PORT}`);
});
