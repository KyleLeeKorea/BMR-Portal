/**
 * BMR 관리 콘솔 - 로컬 웹서버 (외부 의존성 없음, Node 내장 http 모듈만 사용)
 *
 * 실행:  node server.js
 * 접속:  http://localhost:3000
 *
 * 데이터는 ./json/servers.json 에 JSON 형식으로 저장/관리됩니다.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'json');
const DATA_FILE = path.join(DATA_DIR, 'servers.json');

// ---------------------------------------------------------------------------
// 데이터 저장소 (JSON 파일)
// ---------------------------------------------------------------------------
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readServers() {
  ensureStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('servers.json 파싱 오류:', e.message);
    return [];
  }
}

function writeServers(list) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function sanitize(body) {
  const fields = ['env', 'name', 'ip', 'os', 'location', 'note', 'script'];
  const out = {};
  for (const f of fields) out[f] = (body[f] == null ? '' : String(body[f])).trim();
  return out;
}

// ---------------------------------------------------------------------------
// HTTP 유틸
// ---------------------------------------------------------------------------
function sendJSON(res, code, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  // 디렉터리 탈출 방지
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(content);
  });
}

// ---------------------------------------------------------------------------
// API 라우팅
// ---------------------------------------------------------------------------
async function handleApi(req, res, url) {
  const parts = url.split('?')[0].split('/').filter(Boolean); // ['api','servers', ':id?']
  const id = parts[2];

  // GET /api/servers
  if (req.method === 'GET' && parts.length === 2) {
    return sendJSON(res, 200, readServers());
  }

  // POST /api/servers  (등록)
  if (req.method === 'POST' && parts.length === 2) {
    const body = sanitize(await readBody(req));
    if (!body.name) return sendJSON(res, 400, { error: '서버명은 필수입니다.' });
    const list = readServers();
    const item = { id: 'srv-' + crypto.randomBytes(4).toString('hex'), ...body };
    list.push(item);
    writeServers(list);
    return sendJSON(res, 201, item);
  }

  // PUT /api/servers/:id  (변경)
  if (req.method === 'PUT' && id) {
    const body = sanitize(await readBody(req));
    const list = readServers();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: '서버를 찾을 수 없습니다.' });
    list[idx] = { ...list[idx], ...body };
    writeServers(list);
    return sendJSON(res, 200, list[idx]);
  }

  // DELETE /api/servers/:id  (삭제)
  if (req.method === 'DELETE' && id) {
    const list = readServers();
    const next = list.filter((s) => s.id !== id);
    if (next.length === list.length)
      return sendJSON(res, 404, { error: '서버를 찾을 수 없습니다.' });
    writeServers(next);
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 405, { error: 'Method Not Allowed' });
}

// ---------------------------------------------------------------------------
// 서버 시작
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      return await handleApi(req, res, req.url);
    }
    return serveStatic(req, res);
  } catch (e) {
    sendJSON(res, 500, { error: e.message });
  }
});

ensureStore();
server.listen(PORT, () => {
  console.log('\n  ┌───────────────────────────────────────────────┐');
  console.log('  │   Veeam BMR 관리 콘솔                          │');
  console.log('  │   → http://localhost:' + PORT + '                     │');
  console.log('  │   데이터 파일: ./json/servers.json             │');
  console.log('  └───────────────────────────────────────────────┘\n');
});
