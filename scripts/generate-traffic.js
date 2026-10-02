#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 產生首頁側欄 TRAFFIC：TCAS 畫面（ND ARC 模式）、站點清單，以及 styles.css 裡
// 「滑過清單第 n 列就亮第 n 個菱形」的選擇器。三樣都從下面的 TRAFFIC 來，
// 要加減站點或調位置就改這裡，再執行 npm run generate:traffic（會接著重新產生 styles.min.css）。
//
// 本機在下方中央 (160, 186)。theta 是偏離正前方的角度（左負右正，弧線在 ±50° 內），
// r 是離本機的距離（外圈 170），越重要越近。label 是識別碼放在菱形的左邊（L）或右邊（R）。
// her：'her' 是 LiSA 本人，實心洋紅、一直亮著；'fan' 是跟她有關的站，空心洋紅、滑過才填滿；
// 其他站空心青色。洋紅只給 LiSA，規則見 AGENTS.md。
// 識別碼、菱形、那圈點、本機符號彼此重疊或超出畫面時直接報錯，不寫檔。

const TRAFFIC = [
  { href: 'https://www.lxixsxa.com/', name: 'LiSA', desc: '官方網站：最新消息、發行與演唱會資訊', ident: 'LiSA', theta: 0, r: 38, label: 'R', her: 'her' },
  { href: 'https://www.facebook.com/LiSATaiwanfans', name: 'LiSA 台灣後援會', desc: 'Love is Same All，Facebook 粉絲專頁', ident: 'LiSATW', theta: -20, r: 46, label: 'L', her: 'fan' },
  { href: 'https://yuanxintec.com.tw/', name: '元新電腦', desc: '宜蘭壯圍的電腦門市，組裝、維修、網路規劃', ident: 'YUANXIN', theta: -30, r: 82, label: 'L' },
  { href: 'https://cptwin.com/', name: '我與我雙胞胎腦麻兒的生活點滴', desc: '腦麻雙胞胎的復健、就學、輔具與無障礙生活', ident: 'CPTWIN', theta: 23, r: 84, label: 'R' },
  { href: 'https://claude.tw/', name: 'Claude Community Taiwan', desc: '台灣 Claude 社群的活動', ident: 'CCTW', theta: -6, r: 104, label: 'R' },
  { href: 'https://www.zhtw.net/', name: '虛度空間 ZH-TW', desc: '免費軟體、實用軟體分享', ident: 'ZHTW', theta: 46, r: 128, label: 'R' },
  { href: 'https://ivonblog.com/', name: 'Ivon 的部落格', desc: 'GNU/Linux 與自由開源軟體', ident: 'IVON', theta: -47, r: 126, label: 'L' },
  { href: 'https://www.facebook.com/groups/154162868862973', name: 'FlySim 模擬飛行論壇', desc: '模擬飛行的 Facebook 社團', ident: 'FLYSIM', theta: 14, r: 138, label: 'R' },
  { href: 'https://www.facebook.com/groups/1224997379198346', name: 'Claude Taiwan', desc: '台灣 Claude 的 Facebook 社團', ident: 'CLAUDETW', theta: -24, r: 146, label: 'L' },
  { href: 'https://academy.claude.com/', name: 'Claude Academy', desc: 'Anthropic 的免費 AI 課程', ident: 'ACADEMY', theta: 36, r: 158, label: 'R' },
  { href: 'https://lowendtalk.com/', name: 'LowEndTalk', desc: '低價 VPS、主機的討論區', ident: 'LET', theta: -44, r: 164, label: 'L' },
  { href: 'https://www.handangel.org/', name: '手天使', desc: '無償協助重度肢障、視障者的性服務', ident: 'HANDANGEL', theta: 2, r: 160, label: 'R' },
];

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const CSS_PATH = path.join(ROOT_DIR, 'assets/styles.css');
const HTML_START = '<!-- TRAFFIC_START -->';
const HTML_END = '<!-- TRAFFIC_END -->';
const CSS_START = '/* TRAFFIC_HOVER_START */';
const CSS_END = '/* TRAFFIC_HOVER_END */';

// 畫面幾何（viewBox 0 0 320 200）。CHAR_W 是 11px B612 Mono 一個字的寬度估計值，只用來檢查重疊
const VIEW_W = 320;
const VIEW_H = 200;
const CX = 160;
const CY = 186;
const R_OUT = 170;
const R_MID = 113;
const R_DOT = 60;
const DOT_THETAS = [-30, 0, 30];
const CHAR_W = 6.7;
const GAP = 2;

const fmt = (v) => v.toFixed(1).replace(/\.0$/, '');

function point(theta, r) {
  const a = (theta * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSvg() {
  const parts = [];
  const [a0x, a0y] = point(-50, R_OUT);
  const [a1x, a1y] = point(50, R_OUT);
  const [m0x, m0y] = point(-50, R_MID);
  const [m1x, m1y] = point(50, R_MID);
  parts.push(`<path class="tcas__arc" d="M${fmt(a0x)} ${fmt(a0y)}A${R_OUT} ${R_OUT} 0 0 1 ${fmt(a1x)} ${fmt(a1y)}"/>`);
  parts.push(`<path class="tcas__arc tcas__arc--mid" d="M${fmt(m0x)} ${fmt(m0y)}A${R_MID} ${R_MID} 0 0 1 ${fmt(m1x)} ${fmt(m1y)}"/>`);

  // 外圈刻度每 10°，每 30° 長一點
  const ticks = [];
  for (let theta = -50; theta <= 50; theta += 10) {
    const len = theta % 30 === 0 ? 9 : 5;
    const [px, py] = point(theta, R_OUT);
    const [qx, qy] = point(theta, R_OUT - len);
    ticks.push(`M${fmt(px)} ${fmt(py)}L${fmt(qx)} ${fmt(qy)}`);
  }
  parts.push(`<path class="tcas__tick" d="${ticks.join('')}"/>`);

  // TCAS 2 NM 那圈點，ARC 模式只看得到前方三顆
  for (const theta of DOT_THETAS) {
    const [x, y] = point(theta, R_DOT);
    parts.push(`<circle class="tcas__dot" cx="${fmt(x)}" cy="${fmt(y)}" r="1.4"/>`);
  }
  parts.push('<path class="tcas__lubber" d="M155 4h10l-5 8z"/>');
  parts.push('<path class="tcas__own" d="M160 175v22M148 182h24M154 194h12"/>');

  const targets = TRAFFIC.map((site) => {
    const [x, y] = point(site.theta, site.r);
    const cls = site.her === 'her' ? ' class="her"' : site.her === 'fan' ? ' class="her-fan"' : '';
    const text = site.label === 'R'
      ? `<text x="${fmt(x + 8)}" y="${fmt(y + 3.5)}">${escapeHtml(site.ident)}</text>`
      : `<text x="${fmt(x - 8)}" y="${fmt(y + 3.5)}" text-anchor="end">${escapeHtml(site.ident)}</text>`;
    return `<a href="${escapeHtml(site.href)}"${cls} target="_blank" rel="noopener" tabindex="-1"><path class="tcas__sym" d="M${fmt(x)} ${fmt(y - 5)}l5 5-5 5-5-5z"/>${text}</a>`;
  });
  parts.push(`<g class="tcas__tfc">${targets.join('')}</g>`);

  return `<svg class="tcas" viewBox="0 0 ${VIEW_W} ${VIEW_H}" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

function buildList() {
  const items = TRAFFIC.map((site) => {
    const cls = site.her ? ' class="her"' : '';
    return `            <li><a${cls} href="${escapeHtml(site.href)}" target="_blank" rel="noopener"><span class="links__name">${escapeHtml(site.name)}<span class="links__ext" aria-hidden="true">↗</span></span><span class="links__desc">${escapeHtml(site.desc)}</span></a></li>`;
  });
  return ['          <ul class="links">', ...items, '          </ul>'].join('\n');
}

function buildHoverCss() {
  const selector = (n) => `.traffic:has(.links li:nth-child(${n}) > a:is(:hover, :focus-visible)) .tcas__tfc > a:nth-child(${n})`;
  const cyan = [];
  const magenta = [];
  TRAFFIC.forEach((site, i) => {
    if (!site.her) cyan.push(selector(i + 1));
    else if (site.her === 'fan') magenta.push(selector(i + 1));
  });

  const rules = [
    `${['.tcas a:is(:hover, :focus-visible)', ...cyan].join(',\n')} {\n  --hot: var(--cyan);\n  --hot-text: var(--cyan);\n}`,
  ];
  if (magenta.length > 0) {
    rules.push(`${magenta.join(',\n')} {\n  --hot: var(--magenta);\n}`);
  }
  return `${CSS_START}\n/* 由 scripts/generate-traffic.js 產生，不要手改 */\n${rules.join('\n\n')}\n${CSS_END}`;
}

// 每個識別碼、菱形、點、本機符號當成一個方框，兩兩之間至少留 GAP，也不能超出 viewBox
function checkLayout() {
  const boxes = [];
  for (const site of TRAFFIC) {
    const [x, y] = point(site.theta, site.r);
    const w = site.ident.length * CHAR_W;
    const lx = site.label === 'R' ? x + 8 : x - 8 - w;
    boxes.push({ owner: site.ident, what: '菱形', x0: x - 5, y0: y - 5, x1: x + 5, y1: y + 5 });
    boxes.push({ owner: site.ident, what: '識別碼', x0: lx, y0: y - 5, x1: lx + w, y1: y + 5 });
  }
  for (const theta of DOT_THETAS) {
    const [x, y] = point(theta, R_DOT);
    boxes.push({ owner: `dot${theta}`, what: '點', x0: x - 1.4, y0: y - 1.4, x1: x + 1.4, y1: y + 1.4 });
  }
  boxes.push({ owner: 'own', what: '本機', x0: 148, y0: 175, x1: 172, y1: 197 });

  const problems = [];
  for (let i = 0; i < boxes.length; i += 1) {
    const a = boxes[i];
    if (a.x0 < GAP || a.x1 > VIEW_W - GAP || a.y0 < GAP || a.y1 > VIEW_H - GAP) {
      problems.push(`${a.owner} 的${a.what}超出畫面`);
    }
    for (let j = i + 1; j < boxes.length; j += 1) {
      const b = boxes[j];
      if (a.owner === b.owner) continue;
      if (a.x0 < b.x1 + GAP && b.x0 < a.x1 + GAP && a.y0 < b.y1 + GAP && b.y0 < a.y1 + GAP) {
        problems.push(`${a.owner} 的${a.what}跟 ${b.owner} 的${b.what}重疊`);
      }
    }
  }
  return problems;
}

function replaceBetween(source, start, end, replacement, label) {
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`${label} 找不到 ${start} … ${end}`);
  }
  return source.slice(0, from) + replacement + source.slice(to + end.length);
}

function main() {
  const problems = checkLayout();
  if (problems.length > 0) {
    console.error('❌ TCAS 畫面排版有問題，沒有寫檔：');
    for (const p of problems) console.error(`   - ${p}`);
    process.exit(1);
  }

  const html = [
    HTML_START,
    '          <!-- 由 scripts/generate-traffic.js 產生，要改站點請改腳本裡的 TRAFFIC，再執行 npm run generate:traffic -->',
    '          <!-- TCAS 畫面（ND ARC 模式）：本機在下方中央，越重要越近。目標順序跟下面清單一致，滑過清單會亮對應的菱形 -->',
    `          ${buildSvg()}`,
    buildList(),
    `          ${HTML_END}`,
  ].join('\n');

  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  fs.writeFileSync(INDEX_PATH, replaceBetween(index, HTML_START, HTML_END, html, 'index.html'), 'utf8');

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  fs.writeFileSync(CSS_PATH, replaceBetween(css, CSS_START, CSS_END, buildHoverCss(), 'assets/styles.css'), 'utf8');

  console.log(`✅ TRAFFIC 已更新：${TRAFFIC.length} 個站（index.html、assets/styles.css）`);
}

main();
