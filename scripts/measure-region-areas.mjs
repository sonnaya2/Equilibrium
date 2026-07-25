/**
 * Measure true relative land area per League region from the colour-coded
 * Gielinor map in assets/rs3/.
 *
 * The map predates two League regions and splits several areas the League
 * folds together, so the LABELS table below encodes both: where to sample each
 * colour, and which League region owns it. Those merges follow the hard rules
 * already in data/league/regions.json — Troll Country and the God Wars approach
 * are Asgarnia, Daemonheim needs the Forinthry pick, and so on.
 *
 * Anachronia and Havenhythe do not appear on this map at all. They are reported
 * as missing rather than guessed; their share comes from the Leagues plate.
 *
 *   node scripts/measure-region-areas.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets/rs3/esb2tma037e01.png");
const OUT = path.join(ROOT, "scripts/.region-areas.json");

/**
 * Fill colour -> League region. Colours were read off the source rather than
 * guessed: a quantised pass over the image reported each cluster's mean colour
 * and centroid, and those centroids line up with the printed labels.
 *
 * Deliberately absent, so they are excluded rather than misattributed:
 * #88919e sea, #008ce0 rivers and lakes, #ffffff off-map islands (Soul Wars,
 * Ashdale, Ape Atoll, Botany Bay), #000000 label text.
 *
 * `provisional` marks a fold the canonical data does not state outright. The
 * two that are stated — Troll Country and Daemonheim — come straight from the
 * hardRules in data/league/regions.json.
 */
const SWATCHES = [
  ["Fremennik Province", 0xbf701d, "fremennik", false],
  ["Frozen Wastes", 0xa0aeae, "fremennik", true],
  ["Troll Country", 0x673e00, "asgarnia", false],
  ["Asgarnia", 0xc73d3d, "asgarnia", false],
  ["Wilderness", 0x272727, "forinthry", false],
  ["Daemonheim", 0xbc470b, "forinthry", false],
  ["Misthalin", 0x07459e, "misthalin", false],
  ["Morytania", 0x007038, "morytania", false],
  ["Kandarin", 0x6b459e, "kandarin", false],
  ["Feldip Hills", 0x4b3404, "kandarin", true],
  ["Tirannwn", 0x29be99, "tirannwn", false],
  ["Karamja", 0x288a00, "karamja", false],
  ["Kharidian Desert", 0xccb538, "desert", false],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const dataUrl = `data:image/png;base64,${fs.readFileSync(SRC).toString("base64")}`;
  const result = await page.evaluate(
    async ([url, swatches]) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;

      // Exact-ish match only. Anything not close to a listed fill — sea, rivers,
      // borders, label text, off-map islands — is left uncounted on purpose.
      const counts = Object.fromEntries(swatches.map(([name]) => [name, 0]));
      let matched = 0;
      const TOL = 18 * 18;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        for (const [name, hex] of swatches) {
          const dr = r - ((hex >> 16) & 255);
          const dg = g - ((hex >> 8) & 255);
          const db = b - (hex & 255);
          if (dr * dr + dg * dg + db * db <= TOL) {
            counts[name]++;
            matched++;
            break;
          }
        }
      }
      return { size: [c.width, c.height], counts, matched, total: c.width * c.height };
    },
    [dataUrl, SWATCHES.map(([name, hex]) => [name, hex])],
  );

  // Fold sub-areas into their League region.
  const byRegion = {};
  for (const [name, hex, region, provisional] of SWATCHES) {
    byRegion[region] ??= { px: 0, parts: [] };
    byRegion[region].px += result.counts[name];
    byRegion[region].parts.push(
      `${name} #${hex.toString(16).padStart(6, "0")} ${result.counts[name]}px${provisional ? " (provisional fold)" : ""}`,
    );
  }
  const total = Object.values(byRegion).reduce((s, r) => s + r.px, 0);

  console.log(`source ${path.basename(SRC)} ${result.size.join("x")}, ${result.matched} land px matched\n`);
  console.log("region        true%   parts");
  const shares = {};
  for (const [region, r] of Object.entries(byRegion).sort((a, b) => b[1].px - a[1].px)) {
    shares[region] = +((100 * r.px) / total).toFixed(2);
    console.log(region.padEnd(13), String(shares[region]).padStart(5), " ", r.parts.join(" + "));
  }
  console.log("\nnot on this map (pre-dates them): anachronia, havenhythe");

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      { source: path.relative(ROOT, SRC), note: "Anachronia and Havenhythe absent from source", shares },
      null,
      2,
    ),
  );
  console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
} finally {
  await browser.close();
}
