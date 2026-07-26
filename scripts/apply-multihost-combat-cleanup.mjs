/**
 * Align multi-host combat rows: hosts ⊆ req when req non-empty.
 * Confirm coherent dual/triple chains; leave deep MW material research for later list.
 *
 * Applied as "work on the ~15 multi-hosts" pass (session).
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

function findTemplate(name) {
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) return { name, t: JSON.parse(JSON.stringify(u)) };
  }
  // partial
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name.includes(name));
    if (u) return { name: u.name, t: JSON.parse(JSON.stringify(u)) };
  }
  return null;
}

function keep(name, hosts, req, extra = {}) {
  const found = findTemplate(name);
  if (!found) {
    log.push(`MISS ${name}`);
    return;
  }
  name = found.name;
  const t = found.t;
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
  log.push(`KEEP ${name} → [${hosts.join(",")}] req=[${req.join(",") || "∅"}]`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Coherent dual/triple combat chains — hosts match hard req (no soft pollution)
// ═══════════════════════════════════════════════════════════════════════════

// Rex Matriarch heart rings — Anachronia heart + Fremennik base rings
for (const n of ["Reaver's ring", "Stalker's ring", "Channeller's ring"]) {
  keep(n, ["anachronia", "fremennik"], ["anachronia", "fremennik"], {
    detail:
      (findTemplate(n)?.t.detail || "") +
      " · Confirmed dual: Anachronia (heart) + Fremennik (base ring feedstock). Both required for self-source.",
  });
}

// Elite tectonic — Vorago/Asgarnia + Forinthry energy/remnant
keep(
  "Elite tectonic robe armour",
  ["asgarnia", "forinthry"],
  ["asgarnia", "forinthry"],
  {
    detail:
      "Elite tectonic: Asgarnia (Vorago tectonic / Virtus–praesulic path) + Forinthry (draconic energy / chaotic remnant). True dual hard lock.",
  },
);

// Trimmed masterwork melee — Asgarnia workshop + Mory malevolent
keep(
  "Trimmed / custom-fit trimmed masterwork melee armour",
  ["asgarnia", "morytania"],
  ["asgarnia", "morytania"],
  {
    detail:
      "Trimmed/custom-fit masterwork melee: Asgarnia (Artisans / Torva–praesulic) + Morytania (malevolent essence). Defining dual melee armour chain.",
  },
);

// Glacor T90 boots — Fremennik + Forinthry
keep(
  "Emberkeen / Hailfire / Flarefrost boots (T90 glacor upgrades)",
  ["fremennik", "forinthry"],
  ["fremennik", "forinthry"],
  {
    detail:
      "T90 glacor boot upgrades: Fremennik (glacor content) + Forinthry materials path. Dual hard lock. Prefer Anachronia style boots when that region is unlocked as alternate bridge.",
  },
);

// Superior dragon claws — base Misthalin + Wildy hilt
keep(
  "Superior dragon claws (Wilderness hilt upgrade)",
  ["misthalin", "forinthry"],
  ["misthalin", "forinthry"],
  {
    detail:
      "Superior dragon claws: Misthalin (base claws path) + Forinthry (Wilderness hilt upgrade). Dual hard lock.",
  },
);

// Fury of the Small — Arch relics Kandarin + Misthalin
keep(
  "Fury of the Small relic chain",
  ["kandarin", "misthalin"],
  ["kandarin", "misthalin"],
  {
    detail:
      "Fury of the Small Archaeology combat relic chain. Kandarin + Misthalin artefact/dig pressure (Misthalin is free start — one elective effectively).",
  },
);

// Conservation of Energy — three including free Misthalin
keep(
  "Conservation of Energy relic chain",
  ["kandarin", "asgarnia", "misthalin"],
  ["kandarin", "asgarnia", "misthalin"],
  {
    detail:
      "Conservation of Energy combat Archaeology relic chain. Kandarin + Asgarnia + Misthalin. Misthalin free start → two elective picks; obtainable under 3-cap.",
  },
);

// Bonecrusher auto-pickup — Arc Waiko (Asgarnia) + base crusher Forinthry
keep(
  "Bonecrusher auto-pickup upgrade (Waiko / Boni)",
  ["asgarnia", "forinthry"],
  ["asgarnia", "forinthry"],
  {
    detail:
      "Bonecrusher auto-pickup (Waiko/Boni taijitu sink): Asgarnia Arc access + Forinthry base bonecrusher purchase. Dual hard lock for the upgrade path.",
  },
);

// Dark Facet of Passage — invent facet + Abyss passage
keep(
  "Dark Facet of Passage (Passage of the Abyss infinite charges)",
  ["asgarnia", "forinthry"],
  ["asgarnia", "forinthry"],
  {
    detail:
      "Dark Facet of Passage: Asgarnia Invention facet craft pressure + Forinthry Passage of the Abyss / Abyss geography. Dual hard lock (pair with Dark Facet of Grace on Forinthry).",
  },
);

// Expansive essence pouch — RC pouch, not combat; Misthalin hub + Forinthry Abyss pressure
// If only one hard geography, prefer forinthry OR misthalin listing — keep dual for Abyss+RC
keep(
  "Expansive essence pouch (70 essence, non-degrading)",
  ["misthalin", "forinthry"],
  ["misthalin", "forinthry"],
  {
    detail:
      "Expansive essence pouch (essence storage, not combat rune pouch). Misthalin RC infrastructure + Forinthry Abyss/Wilderness RC pressure for self-source ladder. Dual until a single-home ruling exists.",
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Masterwork weapons — hosts = hard req only (strip soft pollution hosts)
// Deep material research deferred to multi-host-mw-research-list
// ═══════════════════════════════════════════════════════════════════════════

// Staff: agent research — Abyss synapse makes Forinthry hard; 4 electives → UO
keep(
  "Masterwork staff",
  ["asgarnia", "desert", "tirannwn", "forinthry"],
  ["asgarnia", "desert", "tirannwn", "forinthry"],
  {
    detail:
      "Masterwork staff craft chain. Hard: Asgarnia (Seismic/Artisans) + Desert (Cywir) + Tirannwn (crystal) + Forinthry (untradeable Abyss synapse). UNOBTAINABLE under Equilibrium 3-elective cap (4 elective regions). · UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).",
  },
);

// Spear: hard asg+mory — drop anachronia soft host
keep(
  "Masterwork Spear of Annihilation",
  ["asgarnia", "morytania"],
  ["asgarnia", "morytania"],
  {
    detail:
      "Masterwork Spear of Annihilation: hard Asgarnia + Morytania (mirrors trimmed MW materials). Anachronia archaeology soft host removed from listing. Deeper base-spear path research deferred.",
  },
);

// Bow: hard mory+kand — drop asgarnia soft host
keep(
  "Masterwork bow",
  ["morytania", "kandarin"],
  ["morytania", "kandarin"],
  {
    detail:
      "Masterwork bow: hard Morytania + Kandarin ironman essence. Asgarnia soft (glorious bars) host removed from listing. Deeper material research deferred.",
  },
);

// 2h: already hosts=req — reassert
keep(
  "Masterwork 2h sword",
  ["asgarnia", "desert", "forinthry"],
  ["asgarnia", "desert", "forinthry"],
  {
    detail:
      "Masterwork 2h sword: Asgarnia + Desert + Forinthry self-source chain. Hosts aligned to hard req. Material research deferred.",
  },
);

// MW plate Orthen — deferred deep research; keep current hard req, hosts=req only
// (Asgarnia workshop soft listing deferred to research list — do not invent hard asgarnia)
keep(
  "Masterwork plate → Orthen furnace core pressure stack",
  ["forinthry", "desert", "anachronia"],
  ["forinthry", "desert", "anachronia"],
  {
    detail:
      "Masterwork plate → Orthen furnace core pressure: hard Forinthry + Desert + Anachronia (hosts⊆req). Asgarnia Artisans soft pressure deferred to multi-host MW research list — not hard-gated here.",
  },
);

dedupeRegionUpgrades(cat);
fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");
console.log(log.join("\n"));

// multi remaining
const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!u.name || /^Herb patches/.test(u.name)) continue;
    if (!map.has(u.name)) map.set(u.name, { name: u.name, hosts: [], req: u.requiredRegions || [] });
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
  }
}
const multi = [...map.values()].filter((e) => e.hosts.length > 1);
const outside = multi.filter((e) => {
  const req = e.req || [];
  if (!req.length) return false;
  return e.hosts.some((h) => !req.includes(h));
});
console.log("\nmultiHost:", multi.length, "hostOutsideReq:", outside.length);
if (outside.length) console.log(outside.map((e) => e.name + " hosts=" + e.hosts + " req=" + e.req));
