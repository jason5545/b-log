/**
 * 瀏覽次數 API - Cloudflare Pages Function
 *
 * GET  /api/view?slug=xxx  - 取得瀏覽次數
 * POST /api/view?slug=xxx  - 記錄瀏覽並取得次數
 *
 * 需要 KV 綁定：PAGE_VIEWS
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-cache'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 驗證 slug
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response(
      JSON.stringify({ error: 'Invalid slug' }),
      { status: 400, headers }
    );
  }

  // 檢查 KV 是否已綁定
  if (!env.PAGE_VIEWS) {
    return new Response(
      JSON.stringify({ error: 'KV not configured', count: 0 }),
      { status: 503, headers }
    );
  }

  try {
    // 取得目前計數
    let count = parseInt(await env.PAGE_VIEWS.get(slug)) || 0;

    // POST 時增加計數
    if (request.method === 'POST') {
      count++;
      await env.PAGE_VIEWS.put(slug, count.toString());
    }

    return new Response(
      JSON.stringify({ slug, count }),
      { headers }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Internal error', count: 0 }),
      { status: 500, headers }
    );
  }
}
