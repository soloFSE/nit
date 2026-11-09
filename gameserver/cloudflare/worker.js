// Игровой сервер «Нити» на Cloudflare (Workers + Durable Objects): бесплатно, не засыпает, работает от ближайшей к игрокам точки.
// Протокол тот же, что у gameserver/server.js: join → roster, m → ретрансляция остальным в комнате, ping → pong.
// Одна комната = один Durable Object (по коду комнаты). Hibernation API: пока в комнате тихо, ресурсы не тратятся.
export default {
  async fetch(req, env) {
    const u = new URL(req.url), room = (u.searchParams.get('room') || '').slice(0, 16);
    if (!room || req.headers.get('Upgrade') !== 'websocket')
      return new Response('nit cloudflare game server ok', { headers: { 'access-control-allow-origin': '*' } });
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
  }
};

export class Room {
  constructor(state) {
    this.state = state;
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }
  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  roster(except) {
    return this.state.getWebSockets().filter(w => w !== except).map(w => w.deserializeAttachment()).filter(Boolean);
  }
  sendRoster(except) {
    const msg = JSON.stringify({ t: 'roster', list: this.roster(except) });
    for (const w of this.state.getWebSockets()) if (w !== except) { try { w.send(msg); } catch {} }
  }
  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string') return;
    if (raw.startsWith('{"t":"m"')) { // игровое сообщение — пересылаем остальным как есть (формат тот же)
      for (const w of this.state.getWebSockets()) if (w !== ws) { try { w.send(raw); } catch {} }
      return;
    }
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join') {
      const id = String(m.id || '').slice(0, 64);
      if (!id) return ws.close(1008, 'bad join');
      for (const w of this.state.getWebSockets()) { // тот же игрок зашёл ещё раз — старое соединение закрываем
        const a = w.deserializeAttachment(); if (w !== ws && a && a.id === id) { try { w.close(1000, 'replaced'); } catch {} }
      }
      if (this.roster(ws).length >= 8) return ws.close(1008, 'room full');
      ws.serializeAttachment({ id, name: String(m.name || '').slice(0, 40), t: Number(m.tt) || Date.now() });
      this.sendRoster(null);
    }
  }
  webSocketClose(ws) { this.sendRoster(ws); }
  webSocketError(ws) { this.sendRoster(ws); }
}
