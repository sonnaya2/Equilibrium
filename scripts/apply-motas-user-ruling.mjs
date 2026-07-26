/**
 * User ruling: Mattock of Time and Space requires Tirannwn + Kandarin + Asgarnia.
 * - Crystal mattock: Tirannwn
 * - Imcando mattock: Kandarin
 * - Dragon mattock: Ancient caskets in any region (not Anachronia-hard)
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];
const now = "2026-07-26";

function findTemplate(name) {
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) return JSON.parse(JSON.stringify(u));
  }
  return null;
}

function keep(name, hosts, req, extra = {}) {
  let t = findTemplate(name);
  if (!t) {
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name.includes(name.slice(0, 24)));
      if (u) {
        t = JSON.parse(JSON.stringify(u));
        name = u.name;
        break;
      }
    }
  }
  if (!t) {
    log.push(`MISS ${name}`);
    return;
  }
  const allow = new Set(hosts);
  for (const r of cat.regions) {
    const idx = r.upgrades.findIndex((x) => x.name === name);
    if (allow.has(r.id)) {
      if (idx < 0) {
        const c = JSON.parse(JSON.stringify(t));
        c.regionId = r.id;
        c.requiredRegions = [...req];
        Object.assign(c, extra);
        r.upgrades.push(c);
      } else {
        Object.assign(r.upgrades[idx], extra, {
          regionId: r.id,
          requiredRegions: [...req],
        });
      }
    } else if (idx >= 0) {
      r.upgrades.splice(idx, 1);
    }
  }
  log.push(`KEEP ${name} → [${hosts.join(",")}] req=[${req.join(",")}]`);
}

function removeAll(name) {
  let c = 0;
  for (const r of cat.regions) {
    const b = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
    c += b - r.upgrades.length;
  }
  if (c) log.push(`RM ${c}× ${name}`);
}

// ── MoTaS: Tirannwn + Kandarin + Asgarnia (3 electives, at cap, obtainable) ──
keep(
  "Mattock of Time and Space",
  ["tirannwn", "kandarin", "asgarnia"],
  ["tirannwn", "kandarin", "asgarnia"],
  {
    detail:
      "Mattock of Time and Space. User ruling hard req: Tirannwn (crystal mattock) + Kandarin (Imcando mattock) + Asgarnia. Dragon mattock bases come from Ancient caskets in any region — not Anachronia-hard. Misthalin monolith/Guild shop is free-start support, not a fourth elective. Obtainable under 3-elective cap (exactly three electives).",
    confidence: "user_ruling_2026-07-26",
  },
);

// ── Imcando mattock stays Kandarin ───────────────────────────────────────
keep(
  "Imcando mattock",
  ["kandarin"],
  ["kandarin"],
  {
    detail:
      "Imcando mattock. User ruling: Kandarin. Feeds Mattock of Time and Space (Tirannwn + Kandarin + Asgarnia). Dragon mattock feedstock is Ancient-casket general, not Anachronia-hard.",
  },
);

// ── Crystal mattock if present → Tirannwn ────────────────────────────────
{
  const nameHits = [];
  for (const r of cat.regions) {
    for (const u of r.upgrades) {
      if (/^Crystal mattock/i.test(u.name) && !/Time and Space/i.test(u.name)) {
        nameHits.push(u.name);
      }
    }
  }
  const names = [...new Set(nameHits)];
  if (names.length) {
    for (const n of names) {
      keep(n, ["tirannwn"], ["tirannwn"], {
        detail:
          "Crystal mattock. User ruling: Tirannwn. Pair with Imcando (Kandarin) for Mattock of Time and Space.",
      });
    }
  } else {
    // ensure a crystal mattock row exists on tirannwn
    const tir = cat.regions.find((r) => r.id === "tirannwn");
    if (!tir.upgrades.some((u) => /^Crystal mattock/i.test(u.name))) {
      tir.upgrades.push({
        name: "Crystal mattock",
        category: "Archaeology tool",
        detail:
          "Crystal mattock. User ruling: Tirannwn. Required half of Mattock of Time and Space with Imcando (Kandarin) + Asgarnia third hard.",
        requirements: ["Dragon mattock or Imcando substitute path", "Crystal tool seed / Prif crystal tools"],
        confidence: "user_ruling_2026-07-26",
        source: {
          source: "derived",
          url: "https://runescape.wiki/w/Crystal_mattock",
          title: "Crystal mattock",
          verifiedAt: now,
        },
        regionId: "tirannwn",
        requiredRegions: ["tirannwn"],
      });
      log.push("ADD Crystal mattock → tirannwn");
    }
  }
}

// ── Dragon mattock: any region via Ancient caskets ───────────────────────
removeAll("Dragon mattock");
removeAll("Dragon mattock (Big Game Hunter / ancient casket)");
{
  const mis = cat.regions.find((r) => r.id === "misthalin");
  mis.upgrades.push({
    name: "Dragon mattock (Ancient caskets — general)",
    category: "Archaeology tool",
    detail:
      "Dragon mattock. User ruling: obtainable from Ancient caskets in any region — not Anachronia-hard (BGH is optional secondary path only). Host Misthalin for planner listing; empty requiredRegions (general).",
    requirements: [],
    confidence: "user_ruling_2026-07-26",
    source: {
      source: "derived",
      url: "https://runescape.wiki/w/Dragon_mattock",
      title: "Dragon mattock",
      verifiedAt: now,
    },
    regionId: "misthalin",
    requiredRegions: [],
  });
  log.push("Dragon mattock → general (misthalin host, empty req)");
}

// Clear false Anachronia-hard on any residual dragon mattock wording in MoTaS-adjacent
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (/dragon mattock/i.test(u.name) && r.id === "anachronia") {
      // leave BGH flavour rows if any remain with empty req, or strip hard
      if ((u.requiredRegions || []).includes("anachronia")) {
        u.requiredRegions = [];
        u.detail =
          (u.detail || "") +
          " · User: dragon mattock is Ancient-casket general; BGH is optional not hard.";
        log.push(`cleared anachronia hard on ${u.name}`);
      }
    }
  }
}

dedupeRegionUpgrades(cat);
fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");
console.log(log.join("\n"));

// verify
for (const sub of ["Mattock of Time", "Imcando mattock", "Crystal mattock", "Dragon mattock"]) {
  const hits = [];
  for (const r of cat.regions)
    for (const u of r.upgrades)
      if (u.name.includes(sub) || new RegExp(sub, "i").test(u.name))
        hits.push(`${r.id}: ${u.name} req=${JSON.stringify(u.requiredRegions || [])}`);
  console.log("\n" + sub + "\n  " + (hits.join("\n  ") || "NONE"));
}
