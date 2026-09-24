// Captures Chrome Web Store assets: 1280x800 screenshots (collapsed / hover /
// expanded) on a public PR + the 440x280 promo tile. Works locally (macOS,
// playwright-core) and in CI (ubuntu, playwright + xvfb-run).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let mod;
try { mod = await import("playwright"); } catch { mod = await import("playwright-core"); }
const { chromium } = mod;

const SHOTS = path.join(ROOT, "screenshots");
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const PROFILE = path.join("/tmp", "ghpr_store_profile");
fs.rmSync(PROFILE, { recursive: true, force: true });

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function expectSize(file, w, h) {
  const s = pngSize(file);
  if (s.w !== w || s.h !== h) throw new Error(`${path.basename(file)}: ${s.w}x${s.h}, expected ${w}x${h}`);
  console.log(`ok ${path.basename(file)} ${s.w}x${s.h} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [
    "--no-first-run",
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
  ],
});
const page = ctx.pages()[0] || (await ctx.newPage());
page.on("console", (m) => { const t = m.text(); if (t.startsWith("[gpr")) console.log(t); });

await page.goto("https://github.com/asana17/prev-mark.nvim/pull/1/files", {
  waitUntil: "domcontentloaded", timeout: 60000,
});
await page.waitForSelector("tr[data-gpre-first]", { timeout: 60000 });
await page.waitForTimeout(1500);

const head = page.locator("tr[data-gpre-first]").nth(1);
await head.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

const p1 = path.join(SHOTS, "01-collapsed.png");
await page.screenshot({ path: p1 });
expectSize(p1, 1280, 800);

const box = await head.boundingBox();
if (!box) throw new Error("collapsed head not visible");
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
await page.waitForTimeout(400);
const p2 = path.join(SHOTS, "02-hover.png");
await page.screenshot({ path: p2 });
expectSize(p2, 1280, 800);

const before = await page.evaluate(() => document.querySelectorAll("tr[data-gpre-hidden]").length);
await head.click();
await page.waitForTimeout(500);
const after = await page.evaluate(() => document.querySelectorAll("tr[data-gpre-hidden]").length);
if (!(after < before)) console.log(`warn: expand did not change hidden count (${before} -> ${after})`);
const p3 = path.join(SHOTS, "03-expanded.png");
await page.screenshot({ path: p3 });
expectSize(p3, 1280, 800);
console.log(`screenshots: hidden ${before} -> ${after}`);

const tile = await ctx.newPage();
await tile.setViewportSize({ width: 440, height: 280 });
await tile.goto("file://" + path.join(ROOT, "store", "promo-tile.html"));
await tile.waitForTimeout(250);
const pt = path.join(ROOT, "promo-tile.png");
await tile.screenshot({ path: pt });
expectSize(pt, 440, 280);

await ctx.close();
console.log("capture done");
