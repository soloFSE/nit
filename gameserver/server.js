// Игровой сервер «Нити»: простой быстрый ретранслятор по комнатам (WebSocket).
// Запуск: npm install && npm start   (порт берётся из PORT, по умолчанию 8080)
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const rooms = new Map(); // код -> Map(id -> {ws, name, t})

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
  res.end('nit game server ok, rooms: ' + rooms.size);
});
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024, perMessageDeflate: false });

function roster(room) {
  return [...room.entries()].map(([id, c]) => ({ id, name: c.name, t: c.t }));
}
function sendRoster(room) {
  const msg = JSON.stringify({ t: 'roster', list: roster(room) });
  for (const c of room.values()) if (c.ws.readyState === 1) c.ws.send(msg);
}

wss.on('connection', ws => {
  let room = null, id = null, code = null, bucket = 0, bt = Date.now();
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', raw => {
    ws.isAlive = true;
    // защита от флуда: не больше ~120 сообщений в секунду с одного игрока
    const now = Date.now();
    if (now - bt > 1000) { bt = now; bucket = 0; }
    if (++bucket > 120) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join') {
      code = String(m.room || '').slice(0, 16); id = String(m.id || '').slice(0, 64);
      if (!code || !id) return ws.close();
      room = rooms.get(code); if (!room) rooms.set(code, (room = new Map()));
      if (room.size >= 8 && !room.has(id)) return ws.close();
      const old = room.get(id); if (old && old.ws !== ws) try { old.ws.close(); } catch {}
      room.set(id, { ws, name: String(m.name || '').slice(0, 40), t: Number(m.tt) || Date.now() });
      sendRoster(room);
    } else if (m.t === 'ping') {
      ws.send('{"t":"pong"}');
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
