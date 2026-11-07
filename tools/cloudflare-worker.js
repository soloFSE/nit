// Посредник «Нити» для России: Cloudflare Worker пересылает все запросы в Supabase и обратно.
// Провайдер видит только адрес воркера, а не *.supabase.co.
// Как обновить: Cloudflare → Workers & Pages → nit-proxy → Edit code → вставить этот файл → Deploy.
// Пересылается всё: вход (/auth), база (/rest), файлы (/storage), функции (/functions)
// и «живое» соединение для мгновенных сообщений (/realtime, WebSocket).
const UPSTREAM = 'https://lojlwcsqbbthmpetmbmq.supabase.co';

export default {
  async fetch(req) {
    const url = new URL(req.url);

    // Проверка «посредник жив» — приложение дёргает её, чтобы решить, идти ли через него
    if (url.pathname === '/__nit') {
      return new Response('ok', { headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
    }
    // Пускаем только пути Supabase — чтобы воркер нельзя было использовать как прокси «куда угодно»
    if (!/^\/(auth|rest|storage|realtime|functions|graphql)\/v1\//.test(url.pathname)) {
      return new Response('Not found', { status: 404 });
    }

    const target = UPSTREAM + url.pathname + url.search;
    const fwd = new Request(target, req);          // те же метод, заголовки и тело (и WebSocket-апгрейд)
    const res = await fetch(fwd, { redirect: 'manual' });

    if (res.status === 101) return res;            // WebSocket — отдаём как есть

    // Редиректы Supabase на самого себя переписываем на адрес воркера
    const headers = new Headers(res.headers);
    const loc = headers.get('location');
    if (loc && loc.startsWith(UPSTREAM)) headers.set('location', url.origin + loc.slice(UPSTREAM.length));
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
