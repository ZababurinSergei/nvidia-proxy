import http from "node:http";
import https from "node:https";

const SECRET = process.env.PROXY_SECRET || "change-me";
const TARGET_HOST = "integrate.api.nvidia.com";
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const secret = req.headers["x-proxy-secret"] || url.searchParams.get("secret");

  if (secret !== SECRET) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  url.searchParams.delete("secret");
  const path = url.pathname + (url.search || "");

  const proxyReq = https.request({
    hostname: TARGET_HOST,
    path,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST,
      "x-proxy-secret": undefined,
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err);
    res.writeHead(502);
    res.end("Proxy error");
  });

  req.pipe(proxyReq);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy listening on port ${PORT}`);
});
