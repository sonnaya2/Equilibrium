/**
 * Mirror official Leagues II: Equilibrium news art from Jagex CDN into
 * public/ (served) and assets/leagues/equilibrium/official/ (archive).
 *
 * Source: https://secure.runescape.com/m=news/countdown-to-leagues-ii-equilibrium
 * Fan tool — not affiliated with Jagex. Do not hotlink at runtime.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE =
  "https://cdn.runescape.com/assets/img/external/news/2026/07/aiopawvuir";

/** @type {{ src: string; dests: string[] }[]} */
const DOWNLOADS = [
  {
    src: "WILheader.png",
    dests: [
      "public/game/leagues/header.png",
      "assets/leagues/equilibrium/official/WILheader.png",
    ],
  },
  {
    src: "map.jpg",
    dests: [
      "public/game/leagues/map.jpg",
      "assets/leagues/equilibrium/official/map.jpg",
    ],
  },
  {
    src: "regionlock.jpg",
    dests: [
      "public/game/leagues/regionlock.jpg",
      "assets/leagues/equilibrium/official/regionlock.jpg",
    ],
  },
  {
    src: "relicmenu.jpg",
    dests: [
      "public/game/leagues/relic-menu.jpg",
      "assets/leagues/equilibrium/official/relicmenu.jpg",
      "scraped-data/jagex-build-ref/relicmenu.jpg",
    ],
  },
  {
    src: "blessing.jpg",
    dests: [
      "public/game/leagues/blessing-menu.jpg",
      "assets/leagues/equilibrium/official/blessing.jpg",
      "scraped-data/jagex-build-ref/blessing.jpg",
    ],
  },
  {
    src: "relic.jpg",
    dests: [
      "public/game/leagues/relic-plate.jpg",
      "assets/leagues/equilibrium/official/relic.jpg",
    ],
  },
  {
    src: "trophy.jpg",
    dests: [
      "public/game/leagues/trophy.jpg",
      "assets/leagues/equilibrium/official/trophy.jpg",
    ],
  },
  { src: "1.jpg", dests: ["public/game/leagues/promo-1.jpg"] },
  { src: "2.jpg", dests: ["public/game/leagues/promo-2.jpg"] },
  {
    src: "survivalist.jpg",
    dests: [
      "public/game/relics/survivalist.jpg",
      "assets/leagues/equilibrium/official/survivalist.jpg",
    ],
  },
  {
    src: "harvest.jpg",
    dests: [
      "public/game/relics/endless-harvest.jpg",
      "assets/leagues/equilibrium/official/harvest.jpg",
    ],
  },
  {
    src: "golden.jpg",
    dests: [
      "public/game/relics/golden-touch.jpg",
      "assets/leagues/equilibrium/official/golden.jpg",
    ],
  },
];

async function main() {
  const manifest = [];
  for (const row of DOWNLOADS) {
    const url = `${BASE}/${row.src}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[FAIL] ${url} → ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    for (const dest of row.dests) {
      const abs = join(root, dest);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, buf);
    }
    console.log(`[OK] ${row.src} (${buf.length} bytes)`);
    manifest.push({
      file: row.src,
      url,
      bytes: buf.length,
      dests: row.dests,
      verifiedAt: new Date().toISOString().slice(0, 10),
    });
  }
  const json = JSON.stringify(
    {
      source:
        "https://secure.runescape.com/m=news/countdown-to-leagues-ii-equilibrium",
      note: "Jagex art mirrored for fan non-commercial use. Not affiliated.",
      records: manifest,
    },
    null,
    2,
  );
  for (const p of [
    "public/game/leagues/sources.json",
    "assets/leagues/equilibrium/official/sources.json",
  ]) {
    writeFileSync(join(root, p), json);
  }
  console.log(`[OK] wrote sources.json (${manifest.length} assets)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
