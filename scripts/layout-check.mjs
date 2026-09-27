#!/usr/bin/env node
// 首頁 LATEST 版面截圖檢查：固定幾種寬度 × 幾種極端內容，截圖、量尺寸、對 AGENTS.md「首頁 LATEST 的版面」的規則做檢查，
// 輸出一頁自帶圖片的比較板（index.html）和 report.json。改版面前後各跑一次。
//
// 用法：npm run check:layout [-- --out <資料夾>] [-- --open]
// 需要 playwright-core 對應版本的 Chromium（~/Library/Caches/ms-playwright）；缺的話：npx playwright-core install chromium-headless-shell

import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [375, 820, 1000, 1216, 1440, 2056, 2560];
const VIEWPORT_HEIGHT = 1000;
const MOBILE_MAX = 760;
const RATIO_4_3 = 4 / 3;
const RATIO_16_9 = 16 / 9;
const WIDE_CROP_WARN = 2.6;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
};

function parseArgs(argv) {
  const args = { out: null, open: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--open') args.open = true;
  }
  return args;
}

// 靜態伺服器：網站用的是 /assets/… 這類絕對路徑，根目錄要是 repo 本身
function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = path.join(ROOT, pathname);
      if (!filePath.startsWith(ROOT + path.sep)) throw new Error('outside root');
      const body = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function charLength(text) {
  return Array.from(text || '').length;
}

function pickBy(posts, score) {
  return posts.reduce((best, post) => (score(post) > score(best) ? post : best));
}

// 內容極端值：LATEST 用站內搜尋完整標題換成指定的那一篇
async function buildCases() {
  const posts = JSON.parse(await fs.readFile(path.join(ROOT, 'data/posts.json'), 'utf8'));
  const withCover = posts.filter((post) => post.coverImage);
  const picks = [
    ['標題最長（有封面）', pickBy(withCover, (p) => charLength(p.title))],
    ['標題最短（有封面）', pickBy(withCover, (p) => -charLength(p.title))],
    ['摘要最長（有封面）', pickBy(withCover, (p) => charLength(p.summary))],
    ['摘要最短（有封面）', pickBy(withCover, (p) => -charLength(p.summary))],
    ['沒有封面', posts.find((post) => !post.coverImage)],
  ];

  const cases = [{ id: 'latest', label: '最新一篇（首頁預設）', url: '/', slug: null }];
  const seen = new Set();
  for (const [label, post] of picks) {
    if (!post || seen.has(post.slug)) continue;
    seen.add(post.slug);
    cases.push({
      id: `case-${cases.length}`,
      label: `${label}：標題 ${charLength(post.title)} 字、摘要 ${charLength(post.summary)} 字`,
      url: `/?search=${encodeURIComponent(post.title)}`,
      slug: post.slug,
    });
  }
  cases.push({ id: 'crossing-field', label: 'Crossing Field 分類頁', url: '/?category=Crossing%20Field', slug: null });
  return cases;
}

async function measure(page) {
  return page.evaluate(() => {
    const q = (selector) => document.querySelector(selector);
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height, top: r.top, bottom: r.bottom };
    };
    const lead = q('#featured');
    const title = q('.lead__title');
    const media = q('.lead__media');
    const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
    return {
      slug: lead.dataset.featuredSlug,
      textOnly: lead.classList.contains('lead--text-only'),
      lead: rect(lead),
      text: rect(q('.lead__text')),
      media: rect(media),
      titleLines: Math.round(title.getBoundingClientRect().height / lineHeight),
      titleOverflow: title.scrollWidth > title.clientWidth + 1,
      pageOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

// 規則對照 AGENTS.md「首頁 LATEST 的版面」
function evaluate(width, m, expectedSlug) {
  const fails = [];
  const notes = [];
  if (expectedSlug && m.slug !== expectedSlug) fails.push(`LATEST 沒換成指定文章（顯示 ${m.slug}）`);
  if (m.pageOverflowX) fails.push('頁面有橫向捲動');
  if (m.titleOverflow) fails.push('標題超出欄寬');

  if (m.media) {
    const ratio = m.media.w / m.media.h;
    if (width <= MOBILE_MAX) {
      if (m.media.bottom > m.text.top + 1) fails.push('手機版封面不在文字上面');
      if (Math.abs(ratio - RATIO_16_9) > 0.03) fails.push(`手機版封面不是 16:9（${ratio.toFixed(2)}:1）`);
    } else {
      if (ratio < RATIO_4_3 - 0.02) fails.push(`封面被裁得比 4:3 還窄（${ratio.toFixed(2)}:1）`);
      const bottomGap = Math.round(m.text.bottom - m.media.bottom);
      const atCap = Math.abs(ratio - RATIO_4_3) <= 0.02;
      if (Math.abs(bottomGap) > 1) {
        if (bottomGap > 1 && atCap) notes.push(`封面到 4:3 上限，下方留白 ${bottomGap}px`);
        else if (bottomGap < -1) notes.push(`文字比封面最矮高度矮，文字下方留白 ${-bottomGap}px`);
        else fails.push(`封面底部沒切齊文字（差 ${bottomGap}px）`);
      }
      if (ratio > WIDE_CROP_WARN) notes.push(`封面裁到 ${ratio.toFixed(2)}:1，上下切掉較多`);
    }
  }
  return { fails, notes };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function buildSheet(cases, results, startedAt) {
  const header = WIDTHS.map((w) => `<th>${w}</th>`).join('');
  const rows = cases.map((c) => {
    const cells = WIDTHS.map((w) => {
      const r = results.find((x) => x.case === c.id && x.width === w);
      if (!r) return '<td></td>';
      const m = r.metrics;
      const cover = m.media ? `封面 ${Math.round(m.media.w)}×${Math.round(m.media.h)}（${(m.media.w / m.media.h).toFixed(2)}:1）` : '沒有封面';
      const flags = [
        ...r.fails.map((f) => `<li class="fail">✗ ${escapeHtml(f)}</li>`),
        ...r.notes.map((n) => `<li class="note">· ${escapeHtml(n)}</li>`),
      ].join('');
      return `<td class="${r.fails.length ? 'bad' : ''}"><img src="data:image/jpeg;base64,${r.image}" alt="">`
        + `<p>高 ${Math.round(m.lead.h)}px · 標題 ${m.titleLines} 行<br>${cover}</p>${flags ? `<ul>${flags}</ul>` : ''}</td>`;
    }).join('');
    return `<tr><th class="case">${escapeHtml(c.label)}</th>${cells}</tr>`;
  }).join('');
  const failCount = results.filter((r) => r.fails.length).length;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>LATEST 版面檢查</title>
<style>
body{margin:0;padding:16px;background:#0e1114;color:#d2d9de;font:13px/1.5 system-ui,sans-serif}
h1{font-size:16px;margin:0 0 4px}.sum{margin:0 0 12px;color:#8a959d}.sum b{color:${failCount ? '#f59e0b' : '#5fd18c'}}
table{border-collapse:collapse;table-layout:fixed;width:100%}th,td{border:1px solid #262e35;padding:6px;vertical-align:top}
th{font:700 12px/1.3 ui-monospace,monospace;color:#8a959d}th.case{width:9em;text-align:left;color:#eef2f4;font:600 12px/1.4 system-ui}
td img{display:block;width:100%;height:auto;background:#161b20}td p{margin:4px 0 0;color:#8a959d}
td ul{margin:4px 0 0;padding:0;list-style:none}.fail{color:#f59e0b}.note{color:#8a959d}td.bad{outline:2px solid #f59e0b;outline-offset:-2px}
</style></head><body><h1>首頁 LATEST 版面檢查</h1>
<p class="sum">${escapeHtml(startedAt)} · ${cases.length} 種內容 × ${WIDTHS.length} 種寬度 · <b>${failCount ? `${failCount} 格沒通過` : '全部通過'}</b>（截圖為各寬度實際尺寸等比例縮小）</p>
<table><thead><tr><th class="case"></th>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const outDir = path.resolve(args.out || path.join(os.tmpdir(), 'b-log-layout-check', startedAt.replace(/[: ]/g, '-')));
  await fs.mkdir(outDir, { recursive: true });

  const cases = await buildCases();
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;

  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    server.close();
    console.error('找不到 playwright-core 對應的 Chromium，先執行：npx playwright-core install chromium-headless-shell');
    throw error;
  }

  const results = [];
  try {
    for (const width of WIDTHS) {
      // 深色：Jason 平常看的是深色；版面不受主題影響
      const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, deviceScaleFactor: 1, colorScheme: 'dark', serviceWorkers: 'block' });
      const page = await context.newPage();
      // 流量統計在本機只會報 CORS 錯，直接擋掉
      await page.route(/cloudflareinsights\.com/, (route) => route.abort());
      for (const c of cases) {
        await page.goto(origin + c.url, { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelector('#posts-list > li') && !document.querySelector('#featured')?.hidden, null, { timeout: 15000 });
        await page.evaluate(async () => {
          await document.fonts.ready;
          const img = document.querySelector('.lead__img');
          if (img && !img.complete) await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        });
        const metrics = await measure(page);
        const { fails, notes } = evaluate(width, metrics, c.slug);
        const pad = 16;
        const clip = {
          x: Math.max(0, metrics.lead.x - pad),
          y: Math.max(0, metrics.lead.y - pad),
          width: Math.min(width, metrics.lead.w + pad * 2),
          height: metrics.lead.h + pad * 2,
        };
        const buffer = await page.screenshot({ clip, type: 'jpeg', quality: 80, fullPage: true });
        await fs.writeFile(path.join(outDir, `${c.id}-${width}.jpg`), buffer);
        results.push({ case: c.id, label: c.label, width, metrics, fails, notes, image: buffer.toString('base64') });
        const mark = fails.length ? '✗' : '✓';
        console.log(`${mark} ${String(width).padStart(4)}  ${c.label}${[...fails, ...notes].length ? `  ${[...fails, ...notes].join('；')}` : ''}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const sheetPath = path.join(outDir, 'index.html');
  await fs.writeFile(sheetPath, buildSheet(cases, results, startedAt));
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(results.map(({ image, ...rest }) => rest), null, 2));

  const failCount = results.filter((r) => r.fails.length).length;
  console.log(`\n比較板：${sheetPath}`);
  console.log(failCount ? `${failCount} 格沒通過` : '全部通過');
  if (args.open) execFile('open', [sheetPath]);
  process.exitCode = failCount ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
