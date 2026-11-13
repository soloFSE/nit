// Игровой сервер «Нити»: простой быстрый ретранслятор по комнатам (WebSocket).
// Запуск: npm install && npm start   (порт берётся из PORT, по умолчанию 8080)
// Безопасность (v6.0): подключаться можно только с нашего сайта (Origin), личность подтверждается токеном входа Supabase
// (id игрока берётся из токена — подставить чужой нельзя), комнаты с допустимым именем, размер и частота сообщений ограничены.
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lojlwcsqbbthmpetmbmq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_I6_9GkOyKCJc6WnsjY9nQg_RFuL-oUY'; // публикуемый ключ (виден в приложении всем)
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://solofse.github.io,http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
const OK_ROOM = /^[A-Za-z0-9-]{3,20}$/;
const MAX_MSG = 16384, MAX_RATE = 80, MAX_ROOM = 8;
const rooms = new Map(); // код -> Map(id -> {ws, name, t})

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
  res.end('nit game server ok, rooms: ' + rooms.size);
});
const wss = new WebSocketServer({
  server, maxPayload: MAX_MSG, perMessageDeflate: false,
  verifyClient: ({ origin, req }, done) => {
    const url = new URL(req.url, 'http://x'), room = url.searchParams.get('room') || '';
    if (origin && !ORIGINS.includes(origin)) return done(false, 403, 'forbidden');
    if (room && !OK_ROOM.test(room)) return done(false, 400, 'bad room');
    done(true);
  }
});

const cache = new Map(); // токен -> {id, until}: не спрашиваем Supabase на каждое подключение
async function verify(tok) {
  try {
    if (!tok || typeof tok !== 'string' || tok.length > 4096) return null;
    const hit = cache.get(tok); if (hit && hit.until > Date.now()) return hit.id;
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + tok } });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || typeof j.id !== 'string') return null;
    cache.set(tok, { id: j.id, until: Date.now() + 60000 });
    if (cache.size > 500) for (const [k, v] of cache) if (v.until < Date.now()) cache.delete(k);
    return j.id;
  } catch { return null; }
}
function roster(room) { return [...room.entries()].map(([id, c]) => ({ id, name: c.name, t: c.t })); }
function sendRoster(room) {
  const msg = JSON.stringify({ t: 'roster', list: roster(room) });
  for (const c of room.values()) if (c.ws.readyState === 1) c.ws.send(msg);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const code = url.searchParams.get('room') || '';
  let room = null, id = null, joining = false, bucket = 0, bt = Date.now();
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', async raw => {
    ws.isAlive = true;
    const now = Date.now();
    if (now - bt > 1000) { bt = now; bucket = 0; }
    if (++bucket > MAX_RATE) return; // защита от флуда
    const str = raw.toString();
    if (str === '{"t":"ping"}') { ws.send('{"t":"pong"}'); return; } // замер скорости работает и без входа
    let m; try { m = JSON.parse(str); } catch { return; }
    if (m.t === 'join') {
      if (room || joining) return;
      joining = true;
      const uid = await verify(m.tok);
      if (!uid || !OK_ROOM.test(code)) { try { ws.close(1008, 'auth'); } catch {} return; }
      id = uid;
      room = rooms.get(code); if (!room) rooms.set(code, (room = new Map()));
      if (room.size >= MAX_ROOM && !room.has(id)) { try { ws.close(1008, 'room full'); } catch {} return; }
      const old = room.get(id); if (old && old.ws !== ws) try { old.ws.close(); } catch {}
      room.set(id, { ws, name: String(m.name || '').slice(0, 40), t: Number(m.tt) || Date.now() });
      sendRoster(room);
    } else if (m.t === 'm' && room) {
      const out = JSON.stringify({ t: 'm', p: m.p });
      for (const [pid, c] of room) if (pid !== id && c.ws.readyState === 1) c.ws.send(out);
    }
  });
  ws.on('close', () => {
    if (!room) return;
    const c = room.get(id);
    if (c && c.ws === ws) room.delete(id);
    if (room.size === 0) rooms.delete(code); else sendRoster(room);
  });
  ws.on('error', () => {});
});

// выкидываем «мёртвые» соединения
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} }
}, 20000);

server.listen(PORT, () => console.log('game server on :' + PORT));
