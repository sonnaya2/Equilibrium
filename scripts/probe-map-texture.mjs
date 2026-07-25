// Diagnostic probe for the "THREE.WebGPUTextureUtils: Texture already initialized" bug.
// Based on shot-map3d.mjs, but captures stacks and exercises remount paths.
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--window-position=32000,32000"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push({ kind: "console", text: m.text(), at: m.location() });
});
page.on("pageerror", (e) => errors.push({ kind: "pageerror", text: e.message, stack: e.stack }));

const report = (phase) => {
  const counts = new Map();
  for (const e of errors) {
    const key = `${e.kind}: ${e.text.split("\n")[0]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(`\n=== ${phase} ===`);
  if (!counts.size) console.log("no errors so far");
  for (const [k, n] of counts) console.log(`x${n}  ${k}`);
};

await page.goto(`http://localhost:${process.argv[2] ?? "3100"}/map`, { waitUntil: "networkidle" });
await page.waitForTimeout(4500);
report("after first load");
await page.screenshot({ path: ".shots/probe-1-load.png" });

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3500);
report("after reload (full remount)");
await page.screenshot({ path: ".shots/probe-2-reload.png" });

// Print the first stack as soon as we have one — later phases may not survive.
const stacked = errors.find((e) => e.stack);
if (stacked) console.log(`\n=== first stack ===\n${stacked.text}\n${stacked.stack}`);

// Client-side route change away and back: Canvas unmount/remount with warm loader cache.
try {
  await page.goto(`http://localhost:${process.argv[2] ?? "3100"}/build`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.goto(`http://localhost:${process.argv[2] ?? "3100"}/map`, { waitUntil: "networkidle" });
} catch (err) {
  console.log(`route phase failed: ${err.message.split("\n")[0]}`);
}
await page.waitForTimeout(3500);
report("after route away + back");
await page.screenshot({ path: ".shots/probe-3-back.png" });

// Click a slab-ish canvas spot to exercise invalidate/animation paths.
await page.mouse.click(720, 600);
await page.waitForTimeout(1500);
report("after canvas click");

const first = errors.find((e) => e.stack);
if (first) console.log(`\n=== first stack ===\n${first.text}\n${first.stack}`);

await browser.close();
