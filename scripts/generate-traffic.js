#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 產生首頁側欄 TRAFFIC：TCAS 畫面（ND ARC 模式）、站點清單，以及 styles.css 裡
// 「鍵盤移到清單第 n 項就亮、框起第 n 個目標」的選擇器。三樣都從下面的 TRAFFIC 來，
// 要加減站點或調位置就改這裡，再執行 npm run generate:traffic（會接著重新產生 styles.min.css）。
// 畫面上只有 TCAS：滑鼠與觸控直接點目標，滑過顯示站名與簡介；清單視覺隱藏，給螢幕閱讀器與鍵盤。
//
// 本機在下方中央 (160, 186)。theta 是偏離正前方的角度（左負右正，弧線在 ±50° 內），
// r 是離本機的距離（外圈 170），越重要越近。label 是識別碼放在菱形的左邊（L）或右邊（R）。
// her：'her' 是 LiSA 本人，實心洋紅、一直亮著；'fan' 是跟她有關的站，空心洋紅、滑過才填滿；
// 其他站空心青色。洋紅只給 LiSA，規則見 AGENTS.md。
// 識別碼、菱形、那圈點、本機符號彼此重疊、壓到弧線或刻度、超出畫面，或點擊範圍太擠時直接報錯，不寫檔。

const TRAFFIC = [
  { href: 'https://www.lxixsxa.com/', name: 'LiSA', desc: '官方網站：最新消息、發行與演唱會資訊', ident: 'LiSA', theta: 0, r: 38, label: 'R', her: 'her' },
  { href: 'https://www.facebook.com/LiSATaiwanfans', name: 'LiSA 台灣後援會', desc: 'Love is Same All，Facebook 粉絲專頁', ident: 'LiSATW', theta: -20, r: 46, label: 'L', her: 'fan' },
  { href: 'https://yuanxintec.com.tw/', name: '元新電腦', desc: '宜蘭壯圍的電腦門市，組裝、維修、網路規劃', ident: 'YUANXIN', theta: -30, r: 74, label: 'L' },
  { href: 'https://cptwin.com/', name: '我與我雙胞胎腦麻兒的生活點滴', desc: '腦麻雙胞胎的復健、就學、輔具與無障礙生活', ident: 'CPTWIN', theta: 23, r: 84, label: 'L' },
  { href: 'https://claude.tw/', name: 'Claude Community Taiwan', desc: '台灣 Claude 社群的活動', ident: 'CCTW', theta: -8, r: 104, label: 'R' },
  { href: 'https://www.zhtw.net/', name: '虛度空間 ZH-TW', desc: '免費軟體、實用軟體分享', ident: 'ZHTW', theta: 46, r: 128, label: 'R' },
  { href: 'https://ivonblog.com/', name: 'Ivon 的部落格', desc: 'GNU/Linux 與自由開源軟體', ident: 'IVON', theta: -47, r: 126, label: 'L' },
  { href: 'https://www.facebook.com/groups/154162868862973', name: 'FlySim 模擬飛行論壇', desc: '模擬飛行的 Facebook 社團', ident: 'FLYSIM', theta: 10, r: 138, label: 'R' },
  { href: 'https://www.facebook.com/groups/1224997379198346', name: 'Claude Taiwan', desc: '台灣 Claude 的 Facebook 社團', ident: 'CLAUDETW', theta: -25, r: 146, label: 'R' },
  { href: 'https://academy.claude.com/', name: 'Claude Academy', desc: 'Anthropic 的免費 AI 課程', ident: 'ACADEMY', theta: 43, r: 156, label: 'L' },
  { href: 'https://lowendtalk.com/', name: 'LowEndTalk', desc: '低價 VPS、主機的討論區', ident: 'LET', theta: -44, r: 164, label: 'R' },
  { href: 'https://www.handangel.org/', name: '手天使', desc: '無償協助重度肢障、視障者的性服務', ident: 'HANDANGEL', theta: -14, r: 158, label: 'R' },
];

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const CSS_PATH = path.join(ROOT_DIR, 'assets/styles.css');
const HTML_START = '<!-- TRAFFIC_START -->';
const HTML_END = '<!-- TRAFFIC_END -->';
const CSS_START = '/* TRAFFIC_HOVER_START */';
const CSS_END = '/* TRAFFIC_HOVER_END */';

// 畫面幾何（viewBox 0 0 320 200）。識別碼是 11px B612 Mono，每個字 0.65em 加 0.02em 字距（styles.css 的 .tcas text）
const VIEW_W = 320;
const VIEW_H = 200;
const CX = 160;
const CY = 186;
const R_OUT = 170;
const R_MID = 113;
const R_DOT = 60;
const ARC_THETA = 50;
const DOT_THETAS = [-30, 0, 30];
const CHAR_W = 11 * (0.65 + 0.02);
const GAP = 2;
// 點擊範圍：菱形加識別碼外擴成高 16 的方框。WCAG 2.5.8 允許小於 24px 的目標，條件是以每個目標為中心、
// 直徑 24px 的圓不碰到別的目標或別的圓。側欄最窄 19rem＝304px，viewBox 320 寬，24px 約 25.3 單位
const HIT_PAD_X = 2;
const HIT_HALF_H = 8;
const SPACING_R = (24 * VIEW_W) / 304 / 2;

const fmt = (v) => v.toFixed(1).replace(/\.0$/, '');

function point(theta, r) {
  const a = (theta * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

// 外圈刻度每 10°，每 30° 長一點
function tickSegments() {
  const segments = [];
  for (let theta = -ARC_THETA; theta <= ARC_THETA; theta += 10) {
    const len = theta % 30 === 0 ? 9 : 5;
    segments.push([point(theta, R_OUT), point(theta, R_OUT - len)]);
  }
  return segments;
}

// 每個目標的菱形中心、識別碼方框、點擊範圍
function targetGeometry(site) {
  const [x, y] = point(site.theta, site.r);
  const w = site.ident.length * CHAR_W;
  const lx = site.label === 'R' ? x + 8 : x - 8 - w;
  const label = { x0: lx, y0: y - 5, x1: lx + w, y1: y + 5 };
  const hit = {
    x0: Math.min(x - 5, label.x0) - HIT_PAD_X,
    y0: y - HIT_HALF_H,
    x1: Math.max(x + 5, label.x1) + HIT_PAD_X,
    y1: y + HIT_HALF_H,
  };
  return { x, y, label, hit };
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

  const ticks = tickSegments().map(([[px, py], [qx, qy]]) => `M${fmt(px)} ${fmt(py)}L${fmt(qx)} ${fmt(qy)}`);
  parts.push(`<path class="tcas__tick" d="${ticks.join('')}"/>`);

  // TCAS 2 NM 那圈點，ARC 模式只看得到前方三顆
  for (const theta of DOT_THETAS) {
    const [x, y] = point(theta, R_DOT);
    parts.push(`<circle class="tcas__dot" cx="${fmt(x)}" cy="${fmt(y)}" r="1.4"/>`);
  }
  parts.push('<path class="tcas__lubber" d="M155 4h10l-5 8z"/>');
  parts.push('<path class="tcas__own" d="M160 175v22M148 182h24M154 194h12"/>');

  const targets = TRAFFIC.map((site) => {
    const { x, y, hit } = targetGeometry(site);
    const cls = site.her === 'her' ? ' class="her"' : site.her === 'fan' ? ' class="her-fan"' : '';
    const title = `<title>${escapeHtml(site.name)}\n${escapeHtml(site.desc)}</title>`;
    const hitRect = `<rect class="tcas__hit" x="${fmt(hit.x0)}" y="${fmt(hit.y0)}" width="${fmt(hit.x1 - hit.x0)}" height="${fmt(hit.y1 - hit.y0)}" rx="2"/>`;
    const text = site.label === 'R'
      ? `<text x="${fmt(x + 8)}" y="${fmt(y + 3.5)}">${escapeHtml(site.ident)}</text>`
      : `<text x="${fmt(x - 8)}" y="${fmt(y + 3.5)}" text-anchor="end">${escapeHtml(site.ident)}</text>`;
    return `<a href="${escapeHtml(site.href)}"${cls} target="_blank" rel="noopener" tabindex="-1">${title}${hitRect}<path class="tcas__sym" d="M${fmt(x)} ${fmt(y - 5)}l5 5-5 5-5-5z"/>${text}</a>`;
  });
  parts.push(`<g class="tcas__tfc">${targets.join('')}</g>`);

  return `<svg class="tcas" viewBox="0 0 ${VIEW_W} ${VIEW_H}" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

function buildList() {
  const items = TRAFFIC.map((site, i) => {
    const descId = `traffic-desc-${i + 1}`;
    return `            <li><a href="${escapeHtml(site.href)}" target="_blank" rel="noopener" aria-describedby="${descId}">${escapeHtml(site.name)}</a><span id="${descId}">${escapeHtml(site.desc)}</span></li>`;
  });
  return ['          <ul class="links">', ...items, '          </ul>'].join('\n');
}

function buildHoverCss() {
  const selector = (n) => `.traffic:has(.links li:nth-child(${n}) > a:focus-visible) .tcas__tfc > a:nth-child(${n})`;
  const cyan = [];
  const magenta = [];
  TRAFFIC.forEach((site, i) => {
    if (!site.her) cyan.push(selector(i + 1));
    else if (site.her === 'fan') magenta.push(selector(i + 1));
  });

  const rules = [
    `${['.tcas a:hover', ...cyan].join(',\n')} {\n  --hot: var(--cyan);\n  --hot-text: var(--cyan);\n}`,
  ];
  if (magenta.length > 0) {
    rules.push(`${magenta.join(',\n')} {\n  --hot: var(--magenta);\n}`);
  }
  rules.push(`${TRAFFIC.map((site, i) => `${selector(i + 1)} .tcas__hit`).join(',\n')} {\n  stroke: var(--focus);\n}`);
  return `${CSS_START}\n/* 由 scripts/generate-traffic.js 產生，不要手改 */\n${rules.join('\n\n')}\n${CSS_END}`;
}

// 弧線與刻度取樣成點，拿來檢查有沒有壓到菱形或識別碼
function linePoints() {
  const points = [];
  for (const [r, what] of [[R_OUT, '外圈弧線'], [R_MID, '中圈弧線']]) {
    for (let theta = -ARC_THETA; theta <= ARC_THETA; theta += 0.25) {
      points.push({ what, p: point(theta, r) });
    }
  }
  for (const [[px, py], [qx, qy]] of tickSegments()) {
    for (let i = 0; i <= 10; i += 1) {
      points.push({ what: '刻度', p: [px + ((qx - px) * i) / 10, py + ((qy - py) * i) / 10] });
    }
  }
  return points;
}

// 每個識別碼、菱形、點、本機符號當成一個方框，兩兩之間至少留 GAP，也不能超出 viewBox；
// 弧線與刻度離菱形、識別碼也要留 GAP；點擊範圍彼此不能重疊
function checkLayout(traffic = TRAFFIC) {
  const problems = [];
  const boxes = [];
  const geometry = traffic.map((site) => ({ site, ...targetGeometry(site) }));
  const lines = linePoints();
  for (const { site, x, y, label, hit } of geometry) {
    boxes.push({ owner: site.ident, what: '菱形', x0: x - 5, y0: y - 5, x1: x + 5, y1: y + 5 });
    boxes.push({ owner: site.ident, what: '識別碼', ...label });

    // 菱形用實際形狀算：|dx| + |dy| 小於 5 + GAP×√2 就是離邊不到 GAP
    const hitsDiamond = new Set(lines.filter(({ p: [px, py] }) => Math.abs(px - x) + Math.abs(py - y) < 5 + GAP * Math.SQRT2).map((l) => l.what));
    for (const what of hitsDiamond) problems.push(`${site.ident} 的菱形壓到${what}`);
    const hitsLabel = new Set(lines.filter(({ p: [px, py] }) => px > label.x0 - GAP && px < label.x1 + GAP && py > label.y0 - GAP && py < label.y1 + GAP).map((l) => l.what));
    for (const what of hitsLabel) problems.push(`${site.ident} 的識別碼壓到${what}`);

    if (hit.x0 < 0 || hit.x1 > VIEW_W || hit.y0 < 0 || hit.y1 > VIEW_H) {
      problems.push(`${site.ident} 的點擊範圍超出畫面`);
    }
  }
  const center = ({ x0, y0, x1, y1 }) => [(x0 + x1) / 2, (y0 + y1) / 2];
  const circleHitsBox = ([cx, cy], { x0, y0, x1, y1 }) => Math.hypot(cx - Math.max(x0, Math.min(cx, x1)), cy - Math.max(y0, Math.min(cy, y1))) < SPACING_R;
  for (let i = 0; i < geometry.length; i += 1) {
    for (let j = i + 1; j < geometry.length; j += 1) {
      const a = geometry[i].hit;
      const b = geometry[j].hit;
      const names = `${geometry[i].site.ident} 跟 ${geometry[j].site.ident}`;
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
        problems.push(`${names} 的點擊範圍重疊`);
      } else if (Math.hypot(center(a)[0] - center(b)[0], center(a)[1] - center(b)[1]) < SPACING_R * 2 || circleHitsBox(center(a), b) || circleHitsBox(center(b), a)) {
        problems.push(`${names} 的點擊範圍間距不到 24px`);
      }
    }
  }
  for (const theta of DOT_THETAS) {
    const [x, y] = point(theta, R_DOT);
    boxes.push({ owner: `dot${theta}`, what: '點', x0: x - 1.4, y0: y - 1.4, x1: x + 1.4, y1: y + 1.4 });
  }
  boxes.push({ owner: 'own', what: '本機', x0: 148, y0: 175, x1: 172, y1: 197 });

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
    '          <!-- TCAS 畫面（ND ARC 模式）：本機在下方中央，越重要越近。滑過目標會顯示站名與簡介 -->',
    '          <!-- 下面的清單畫面上看不到，給螢幕閱讀器與鍵盤用；順序跟畫面的目標一致，鍵盤移到第 n 項時第 n 個目標會亮並框起來 -->',
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

if (require.main === module) {
  main();
}

module.exports = { TRAFFIC, checkLayout };
