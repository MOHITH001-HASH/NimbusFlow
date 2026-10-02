/**
 * NimbusFlow - Pure Node.js & JavaScript Server
 * Full Functional Parity - Zero TypeScript Required
 */
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PYTHON_PORT = process.env.PYTHON_PORT || 5000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Forward API traffic to Python engine
app.use(['/api', '/pay'], (req, res, next) => {
  const proxyHeaders = { ...req.headers };
  let bodyBuffer = null;

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
    bodyBuffer = Buffer.from(JSON.stringify(req.body));
    proxyHeaders['content-type'] = 'application/json';
    proxyHeaders['content-length'] = String(bodyBuffer.length);
  } else {
    delete proxyHeaders['content-length'];
  }

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: PYTHON_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: proxyHeaders
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.status(502).json({ error: 'Python backend unreachable' });
  });

  if (bodyBuffer) {
    proxyReq.write(bodyBuffer);
  }
  proxyReq.end();
});

// Serve HTML5 standalone console
app.get('/console', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'standalone_console.html'));
});

// Root fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'standalone_console.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NimbusFlow] Pure Node.js & JavaScript Server running on port ${PORT}`);
});
