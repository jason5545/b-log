import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, "..", "assets", "fonts");
const CSS_URL = "https://fonts.bunny.net/css?family=inter:400,700";
// Heuristic for latin: pick @font-face blocks whose unicode-range contains U+0000-00FF
const LATIN_MARK = "U+0000-00FF";

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Chrome-Like)",
      "Accept": "text/css,*/*;q=0.1",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.text();
}

function parseFaces(css) {
  const blocks = css.match(/@font-face\s*{[^}]+}/g) || [];
  return blocks.map(b => {
    const weight = (b.match(/font-weight:\s*(\d{3})/i) || [])[1];
    const url = (b.match(/src:\s*url\(([^)]+\.woff2)\)/i) || [])[1]?.replace(/['"]/g, "");
    const urange = (b.match(/unicode-range:\s*([^;]+);/i) || [])[1] || "";
    return { weight, url, urange, raw: b };
  }).filter(x => x.weight && x.url);
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function download(url, outPath) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(outPath, buf);
  return outPath;
}

(async () => {
  await ensureDir(OUT_DIR);
  const css = await fetchText(CSS_URL);
  const faces = parseFaces(css);

  // pick latin subset entries (unicode-range contains U+0000-00FF)
  const wanted = {};
  for (const f of faces) {
    if (f.urange.includes(LATIN_MARK)) {
      // keep first seen per weight (400/700)
      if (!wanted[f.weight]) wanted[f.weight] = f;
    }
  }

  const weights = ["400", "700"];
  const files = [];
  for (const w of weights) {
    const face = wanted[w];
    if (!face) throw new Error(`No latin WOFF2 found for weight ${w}`);
    const filename = `inter-latin-${w}.woff2`;
    const out = path.join(OUT_DIR, filename);
    await download(face.url, out);
    files.push({ weight: w, filename });
  }

  // Write fonts.css next to fonts
  const cssOut =
`@font-face{
  font-family:"Inter";
  src:url("/assets/fonts/inter-latin-400.woff2") format("woff2");
  font-weight:400;
  font-style:normal;
  font-display:optional;
}
@font-face{
  font-family:"Inter";
  src:url("/assets/fonts/inter-latin-700.woff2") format("woff2");
  font-weight:700;
  font-style:normal;
  font-display:optional;
}

/* Global family: Inter for ASCII/latin; Chinese uses fast system fonts */
:root{
  --sans-tc: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
             "PingFang TC","Microsoft JhengHei","Noto Sans TC",
             "Heiti TC","Helvetica Neue",Arial,Helvetica,sans-serif;
}
html[lang="zh-Hant-TW"] body{ font-family:"Inter", var(--sans-tc); }
`;
  const cssPath = path.resolve(__dirname, "..", "assets", "css", "fonts.css");
  await ensureDir(path.dirname(cssPath));
  await fs.writeFile(cssPath, cssOut);
  console.log("Saved:", files.map(f=>f.filename).join(", "));
})();
