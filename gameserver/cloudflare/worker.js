// Игровой сервер «Нити» на Cloudflare (Workers + Durable Objects): бесплатно, не засыпает, работает от ближайшей к игрокам точки.
// Протокол: join {tok} → roster; m → ретрансляция остальным в комнате; ping → pong (без входа, для замера скорости).
// Одна комната = один Durable Object (по коду комнаты). Hibernation API: пока в комнате тихо, ресурсы не тратятся.
// Безопасность (v6.0): подключаться можно только с нашего сайта (проверка Origin), личность подтверждается токеном входа Supabase
// (id игрока берётся из токена, подставить чужой нельзя), комнаты — только с допустимым именем, размер и частота сообщений ограничены.
const OK_ROOM = /^[A-Za-z0-9-]{3,20}$/;
const MAX_MSG = 16384;      // байт на сообщение
const MAX_RATE = 80;        // сообщений в секунду от одного игрока
const MAX_ROOM = 8;         // игроков в комнате

const allowedOrigin = (req, env) => {
  const o = req.headers.get('Origin');
  if (!o) return true; // не браузер: личность всё равно проверится токеном
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).includes(o);
};

export default {
  async fetch(req, env) {
    const u = new URL(req.url), room = u.searchParams.get('room') || '';
    if (req.headers.get('Upgrade') !== 'websocket')
      return new Response('nit cloudflare game server ok', { headers: { 'access-control-allow-origin': '*' } });
    if (!allowedOrigin(req, env)) return new Response('forbidden', { status: 403 });
    if (!OK_ROOM.test(room)) return new Response('bad room', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
  }
};

export class Room {
  constructor(state, env) {
    this.state = state; this.env = env; this.rate = new WeakMap();
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }
  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  // Проверяем токен входа у Supabase: возвращает id пользователя или null
  async verify(tok) {
    try {
      if (!tok || typeof tok !== 'string' || tok.length > 4096) return null;
      const r = await fetch(this.env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: this.env.SUPABASE_KEY, Authorization: 'Bearer ' + tok } });
      if (!r.ok) return null;
      const j = await r.json();
      return j && typeof j.id === 'string' ? j.id : null;
    } catch { return null; }
  }
  roster(except) {
    return this.state.getWebSockets().filter(w => w !== except).map(w => w.deserializeAttachment()).filter(Boolean);
  }
  sendRoster(except) {
    const msg = JSON.stringify({ t: 'roster', list: this.roster(except) });
    for (const w of this.state.getWebSockets()) if (w !== except) { try { w.send(msg); } catch {} }
  }
  limited(ws) {
    const now = Date.now(); let r = this.rate.get(ws);
    if (!r || now - r.t > 1000) { r = { t: now, n: 0 }; this.rate.set(ws, r); }
    return ++r.n > MAX_RATE;
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG || this.limited(ws)) return;
    const me = ws.deserializeAttachment();
    if (raw.startsWith('{"t":"m"')) { // игровое сообщение — только от вошедшего игрока, пересылаем остальным как есть
      if (!me) return;
      for (const w of this.state.getWebSockets()) if (w !== ws && w.deserializeAttachment()) { try { w.send(raw); } catch {} }
      return;
    }
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join') {
      if (me) return; // уже вошли
      const id = await this.verify(m.tok);
      if (!id) return ws.close(1008, 'auth');
      for (const w of this.state.getWebSockets()) { // тот же игрок зашёл ещё раз — старое соединение закрываем
        const a = w.deserializeAttachment(); if (w !== ws && a && a.id === id) { try { w.close(1000, 'replaced'); } catch {} }
      }
      if (this.roster(ws).length >= MAX_ROOM) return ws.close(1008, 'room full');
      ws.serializeAttachment({ id, name: String(m.name || '').slice(0, 40), t: Number(m.tt) || Date.now() });
      this.sendRoster(null);
    }
  }
  webSocketClose(ws) { this.sendRoster(ws); }
  webSocketError(ws) { this.sendRoster(ws); }
}
