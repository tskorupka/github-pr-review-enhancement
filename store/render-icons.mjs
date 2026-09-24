// Renders store/icon.svg to icons/icon-{16,32,48,128}.png (committed assets).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let mod;
try { mod = await import("playwright"); } catch { mod = await import("playwright-core"); }
const { chromium } = mod;

const svg = fs.readFileSync(path.join(ROOT, "store", "icon.svg"), "utf8");
fs.mkdirSync(path.join(ROOT, "icons"), { recursive: true });

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`
  );
  const out = path.join(ROOT, "icons", `icon-${size}.png`);
  await page.screenshot({ path: out });
  const s = pngSize(out);
  if (s.w !== size || s.h !== size) throw new Error(`icon-${size}: ${s.w}x${s.h}`);
  console.log(`ok icon-${size}.png ${s.w}x${s.h} (${Math.round(fs.statSync(out).size / 1024 * 10) / 10} KB)`);
  await page.close();
}
await browser.close();
console.log("icons done");
