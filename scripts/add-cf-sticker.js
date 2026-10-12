#!/usr/bin/env node
// Crossing Field 文章的 LiSA LINE 貼圖：從 LiSAFloatingCarousel 的貼圖庫挑一張，轉成 WebP 放進
// content/img/stickers/，插進（或換掉）文章開頭 crossing-field-intro 裡的貼圖。
// 規則見 AGENTS.md「Crossing Field 一篇一張貼圖」。
//
// 用法：
//   node scripts/add-cf-sticker.js <slug> <stickerId>   插入或替換
//   node scripts/add-cf-sticker.js --list               列出貼圖庫的 ID，標出已用過的
//
// 貼圖庫位置預設 ~/GitHub/LiSAFloatingCarousel/Resources/Stickers，可用 CF_STICKER_DIR 覆寫。
// 只收貼圖組（static/<id>.png），emoji 組不收。換掉的舊貼圖若沒有其他文章用，會一起刪掉。

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT_DIR, 'content/posts');
const STICKER_OUT_DIR = path.join(ROOT_DIR, 'content/img/stickers');
const STICKER_SRC_DIR = process.env.CF_STICKER_DIR
  || path.join(os.homedir(), 'GitHub/LiSAFloatingCarousel/Resources/Stickers');
const MAX_SIZE = 240;
const INTRO_TAG = '<div class="crossing-field-intro">';
const STICKER_RE = /^[ \t]*<img class="crossing-field-intro__sticker"[^>]*>\n/m;

function listSourceStickers() {
  if (!fs.existsSync(STICKER_SRC_DIR)) {
    throw new Error(`找不到貼圖庫：${STICKER_SRC_DIR}（可用 CF_STICKER_DIR 指定）`);
  }
  const stickers = [];
  for (const set of fs.readdirSync(STICKER_SRC_DIR).sort()) {
    const staticDir = path.join(STICKER_SRC_DIR, set, 'static');
    if (set.startsWith('emoji-') || !fs.existsSync(staticDir)) continue;
    for (const file of fs.readdirSync(staticDir).sort()) {
      if (file.endsWith('.png')) stickers.push({ set, id: file.replace(/\.png$/, ''), file: path.join(staticDir, file) });
    }
  }
  return stickers;
}

function usedStickers() {
  const used = new Map();
  for (const file of fs.readdirSync(POSTS_DIR)) {
    if (!file.endsWith('.md')) continue;
    const markdown = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    for (const match of markdown.matchAll(/\/content\/img\/stickers\/([^"]+)\.webp/g)) {
      used.set(match[1], [...(used.get(match[1]) || []), file.replace(/\.md$/, '')]);
    }
  }
  return used;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    const used = usedStickers();
    for (const { set, id } of listSourceStickers()) {
      const slugs = used.get(`lisa-${id}`);
      console.log(`${set}  ${id}${slugs ? `  ← ${slugs.join('、')}` : ''}`);
    }
    return;
  }

  const [slug, stickerId] = args;
  if (!slug || !stickerId) {
    console.error('用法：node scripts/add-cf-sticker.js <slug> <stickerId>，或 --list');
    process.exit(1);
  }

  const postPath = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(postPath)) throw new Error(`找不到文章：content/posts/${slug}.md`);
  let markdown = fs.readFileSync(postPath, 'utf8');
  if (!markdown.includes(INTRO_TAG)) throw new Error(`${slug} 沒有 ${INTRO_TAG}，貼圖要放在開頭介紹裡`);

  const source = listSourceStickers().find((item) => item.id === stickerId);
  if (!source) throw new Error(`貼圖庫裡找不到 ${stickerId}（用 --list 查）`);

  const name = `lisa-${stickerId}`;
  fs.mkdirSync(STICKER_OUT_DIR, { recursive: true });
  const info = await sharp(source.file)
    .trim()
    .resize({ width: MAX_SIZE, height: MAX_SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(path.join(STICKER_OUT_DIR, `${name}.webp`));

  const previous = markdown.match(STICKER_RE)?.[0].match(/\/content\/img\/stickers\/([^"]+)\.webp/)?.[1];
  const imgTag = `  <img class="crossing-field-intro__sticker" src="/content/img/stickers/${name}.webp" alt="" width="${info.width}" height="${info.height}" loading="lazy" decoding="async">\n`;
  markdown = STICKER_RE.test(markdown)
    ? markdown.replace(STICKER_RE, imgTag)
    : markdown.replace(`${INTRO_TAG}\n`, `${INTRO_TAG}\n${imgTag}`);
  fs.writeFileSync(postPath, markdown, 'utf8');
  console.log(`✅ ${slug} ← ${name}.webp（${info.width}x${info.height}，${info.size} bytes）`);

  if (previous && previous !== name && !usedStickers().has(previous)) {
    fs.rmSync(path.join(STICKER_OUT_DIR, `${previous}.webp`), { force: true });
    console.log(`🗑️  已刪除沒有文章使用的 ${previous}.webp`);
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
