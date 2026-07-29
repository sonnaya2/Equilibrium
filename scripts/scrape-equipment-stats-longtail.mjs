/**
 * Longtail scrape: Infobox Bonuses for wearables that still have empty / all-zero
 * combat bonuses in data/combat/equipment.json.
 *
 * Writes only scraped-data/equipment-stats-longtail-2026-07-26.json.
 * The merge script owns data/combat/equipment.json.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = "2026-07-26";
const OUT = join(ROOT, "scraped-data", `equipment-stats-longtail-${TODAY}.json`);
const EQUIP = join(ROOT, "data", "combat", "equipment.json");

const API = "https://runescape.wiki/api.php";
const USER_AGENT = "EquilibriumEquipmentStats/1.0 (https://github.com/sonnaya2/Equilibrium; longtail equipment stats)";
const BATCH = 15;
const PAUSE_MS = 250;

/** Explicit per-id wiki title overrides (when name is wrong / ambiguous). */
const ID_TITLE_OVERRIDES = {
  "item:glacier-boots": "Glacyte boots",
  "item:staff-of-armadyl": "Staff of Armadyl",
  "item:fractured-staff-of-armadyl": "Fractured Staff of Armadyl",
  "item:elite-seasingers-hood": "Superior seasinger's hood",
  "item:elite-seasingers-robe-top": "Superior seasinger's robe top",
  "item:elite-seasingers-robe-bottom": "Superior seasinger's robe bottom",
  "item:elite-seasingers-gloves": "Superior seasinger's gloves",
  "item:elite-seasingers-boots": "Superior seasinger's boots",
  "item:elite-seasinger-hood": "Superior seasinger's hood",
  "item:elite-seasinger-robe-top": "Superior seasinger's robe top",
  "item:elite-seasinger-robe-bottom": "Superior seasinger's robe bottom",
  "item:elite-seasinger-gloves": "Superior seasinger's gloves",
  "item:elite-seasinger-boots": "Superior seasinger's boots",
  "item:deathguard-tier-70": "Death guard (tier 70)",
  "item:deathguard-tier-80": "Death guard (tier 80)",
  "item:deathguard-tier-90": "Death guard (tier 90)",
  "item:death-guard-t70": "Death guard (tier 70)",
  "item:death-guard-t80": "Death guard (tier 80)",
  "item:death-guard-t90": "Death guard (tier 90)",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function wikiApi(params) {
  const query = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });
  const response = await fetch(`${API}?${query}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`RuneScape Wiki API ${response.status}`);
  return response.json();
}

function hasNonZeroBonus(bonuses) {
  if (!bonuses || typeof bonuses !== "object") return false;
  for (const v of Object.values(bonuses)) {
    if (typeof v === "number" && Number.isFinite(v) && v !== 0) return true;
  }
  return false;
}

function wikiTitleFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/w\/(.+)$/);
    if (!m) return null;
    return decodeURIComponent(m[1].replace(/_/g, " "));
  } catch {
    return null;
  }
}

function titleCandidates(item) {
  const out = [];
  const seen = new Set();
  const push = (t) => {
    if (!t) return;
    const key = String(t).trim();
    if (!key) return;
    const k = key.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(key);
  };

  if (ID_TITLE_OVERRIDES[item.id]) push(ID_TITLE_OVERRIDES[item.id]);

  const fromUrl = wikiTitleFromUrl(item.sources?.find((s) => s.url?.includes("runescape.wiki"))?.url);
  push(fromUrl);

  const name = String(item.name ?? "").trim();
  push(name);

  // Elite seasinger → Superior seasinger
  if (/^elite\s+seasinger/i.test(name)) {
    push(name.replace(/^elite\s+/i, "Superior "));
    push(name.replace(/^elite\s+seasinger'?s?\s*/i, "Superior seasinger's "));
  }
  // Glacier → Glacyte
  if (/^glacier\s+boots$/i.test(name)) push("Glacyte boots");
  // Deathguard typo
  if (/deathguard/i.test(name)) push(name.replace(/deathguard/gi, "Death guard"));
  // Strip parenthetical colour / style variants sometimes
  if (/\(/.test(name)) push(name.replace(/\s*\([^)]*\)\s*$/, "").trim());

  // Id-derived slug → Title Case words (last resort)
  const slug = String(item.id ?? "").replace(/^item:/, "").replace(/-/g, " ");
  if (slug && slug.toLowerCase() !== name.toLowerCase()) {
    push(slug.replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  return out;
}

function isEffectOnlyName(name, id, slot) {
  const n = `${name} ${id}`.toLowerCase();
  if (/scripture\s+of|scripture-of/.test(n)) return "effect-only";
  if (/scrimshaw\s+of|scrimshaw-of|scrimshaw\b/.test(n)) return "effect-only";
  if (/god\s+book|illuminated\s+.*book|book\s+of\s+(law|war|balance|chaos|wisdom)/i.test(n) && slot === "pocket") {
    return "effect-only"; // often prayer only; still try infobox first
  }
  return null;
}

function isAuraSlot(slot) {
  return slot === "aura";
}

/** Extract first {{Infobox Bonuses ...}} block. */
function extractInfoboxBonuses(wikitext) {
  if (!wikitext) return null;
  const start = wikitext.search(/\{\{\s*Infobox\s+Bonuses\b/i);
  if (start < 0) return null;
  let i = start;
  let depth = 0;
  let end = -1;
  for (; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i++;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  return wikitext.slice(start, end);
}

/**
 * Line-based param parse (same shape as _scrape_melee_stats).
 * Do NOT strip the outer {{Infobox Bonuses}} with a nested-{{ }} pass first —
 * once inner templates are gone that pass eats the whole box and yields {}.
 */
function parseInfoboxParams(box) {
  const params = {};
  const body = String(box ?? "").replace(/^\{\{\s*Infobox\s+Bonuses[^\n|]*\n?/i, "");
  const re = /^\|\s*([a-zA-Z0-9_]+)\s*=\s*(.*?)\s*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const key = m[1].toLowerCase();
    let val = m[2].trim();
    val = val
      .replace(/\{\{[^{}]*\}\}/g, " ")
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/'''?/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!(key in params)) params[key] = val;
  }
  return params;
}

function num(v) {
  if (v == null || v === "") return null;
  const s = String(v)
    .replace(/,/g, "")
    .replace(/[^\d.+-eE]/g, "")
    .trim();
  if (!s || s === "-" || s === "+" || /^n\/?a$/i.test(String(v).trim())) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pick(params, ...keys) {
  for (const k of keys) {
    const base = k.toLowerCase();
    if (params[base] != null && String(params[base]).trim() !== "") return params[base];
    if (params[`${base}1`] != null && String(params[`${base}1`]).trim() !== "") return params[`${base}1`];
    for (const pk of Object.keys(params)) {
      if (pk.startsWith(base) && /^\d+$/.test(pk.slice(base.length)) && String(params[pk]).trim() !== "") {
        return params[pk];
      }
    }
  }
  return null;
}

/**
 * Map Infobox Bonuses → EquipmentBonuses.
 * Style bonuses (strength/ranged/magic/necromancy/melee) → bonuses.damage
 * Weapon damage field only when style bonus absent and non-zero.
 */
function mapBonuses(params) {
  if (!params) return {};
  const accuracy = num(pick(params, "accuracy"));
  const armour = num(pick(params, "armour", "armor"));
  const prayer = num(pick(params, "prayer"));
  const styleBonus =
    num(pick(params, "strength")) ??
    num(pick(params, "melee")) ??
    num(pick(params, "ranged")) ??
    num(pick(params, "magic")) ??
    num(pick(params, "necromancy"));
  const weaponDamage = num(pick(params, "damage"));

  const bonuses = {};
  if (accuracy != null && accuracy !== 0) bonuses.accuracy = accuracy;
  if (armour != null && armour !== 0) bonuses.armour = armour;
  if (prayer != null && prayer !== 0) bonuses.prayer = prayer;
  if (styleBonus != null && styleBonus !== 0) bonuses.damage = styleBonus;
  else if (weaponDamage != null && weaponDamage !== 0) bonuses.damage = weaponDamage;
  return bonuses;
}

/** Aura pages sometimes put static % in infobox or lead; capture static combat damage only. */
function tryAuraStaticDamage(wikitext, params) {
  // Infobox rarely has style fields for auras; scan for static +N% damage patterns near aura effect.
  // Only accept unambiguous static combat damage (not "up to", not conditional-only).
  if (params) {
    const b = mapBonuses(params);
    if (hasNonZeroBonus(b)) return b;
  }
  const text = String(wikitext ?? "");
  // e.g. "increases damage by 10%" with no "up to" / "chance"
  const staticPct = /(?:increases?|grants?|gives?)\s+(?:your\s+)?(?:melee|ranged|magic|necromancy|combat|ability)?\s*damage\s+by\s+(\d+(?:\.\d+)?)\s*%/i.exec(
    text,
  );
  if (staticPct) {
    // Store as prayer-less empty combat bag — auras aren't style accuracy/armour.
    // Percent-only damage remains unresolved.
    return { __auraPct: Number(staticPct[1]) };
  }
  return {};
}

function isSoftRedirect(content) {
  const m = String(content ?? "")
    .trim()
    .match(/^#REDIRECT\s*\[\[([^\]]+)\]\]/i);
  return m ? m[1].split("|")[0].trim() : null;
}

function pageUrl(title) {
  return `https://runescape.wiki/w/${String(title).replace(/ /g, "_")}`;
}

async function fetchPagesByTitle(titles) {
  const result = new Map(); // requested title → page | null
  const pending = titles.slice();
  const seenFetch = new Set();

  while (pending.length) {
    const batch = [];
    while (batch.length < BATCH && pending.length) {
      const t = pending.shift();
      if (!t || seenFetch.has(t)) continue;
      seenFetch.add(t);
      batch.push(t);
    }
    if (!batch.length) break;

    let data;
    try {
      data = await wikiApi({
        action: "query",
        prop: "revisions",
        rvprop: "ids|timestamp|content",
        rvslots: "main",
        redirects: "1",
        titles: batch.join("|"),
      });
    } catch (err) {
      console.error("  batch error:", err.message);
      for (const t of batch) result.set(t, null);
      await sleep(PAUSE_MS * 2);
      continue;
    }

    const redirects = new Map((data?.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const normalized = new Map((data?.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const byTitle = new Map();
    for (const page of data?.query?.pages ?? []) {
      if (!page?.title || page.missing) continue;
      const revision = page?.revisions?.[0];
      const content = revision?.slots?.main?.content;
      if (!content) continue;
      byTitle.set(page.title, {
        title: page.title,
        revid: revision.revid,
        timestamp: revision.timestamp,
        content,
      });
    }

    for (const req of batch) {
      let resolved = normalized.get(req) ?? req;
      const viaRedirect = redirects.has(resolved) || redirects.has(req);
      resolved = redirects.get(resolved) ?? redirects.get(req) ?? resolved;
      const page = byTitle.get(resolved);
      if (!page) {
        result.set(req, null);
        continue;
      }
      const soft = isSoftRedirect(page.content);
      if (soft && soft !== page.title) {
        if (!seenFetch.has(soft)) pending.push(soft);
        result.set(req, { __soft: soft, title: soft, redirectedFrom: req });
        continue;
      }
      result.set(req, {
        ...page,
        redirectedFrom: viaRedirect && resolved !== req ? req : null,
        canonical: resolved,
      });
    }

    process.stdout.write(
      `  fetched unique=${seenFetch.size} pending=${pending.length} resolved=${[...result.values()].filter((v) => v && !v.__soft).length}\r`,
    );
    await sleep(PAUSE_MS);
  }

  // Resolve soft redirect chains onto fully fetched pages
  for (const [req, val] of [...result.entries()]) {
    if (!val?.__soft) continue;
    let target = val.__soft;
    let hops = 0;
    let resolvedPage = null;
    while (hops++ < 6) {
      const page =
        (result.get(target) && !result.get(target).__soft ? result.get(target) : null) ||
        [...result.values()].find((p) => p && !p.__soft && p.title === target);
      if (page) {
        resolvedPage = page;
        break;
      }
      const softHop = result.get(target);
      if (softHop?.__soft) {
        target = softHop.__soft;
        continue;
      }
      break;
    }
    if (resolvedPage) {
      result.set(req, {
        ...resolvedPage,
        redirectedFrom: req,
        canonical: resolvedPage.title,
      });
    } else {
      result.set(req, null);
    }
  }

  process.stdout.write("\n");
  return result;
}

function inferSetId(item) {
  if (item.setId) return item.setId;
  const name = String(item.name ?? "").toLowerCase();
  const id = String(item.id ?? "").toLowerCase();
  const rules = [
    [/trimmed masterwork|tmw/, "trimmed-masterwork"],
    [/\bmasterwork\b/, "masterwork"],
    [/vestments of havoc/, "vestments-of-havoc"],
    [/malevolent/, "malevolent"],
    [/\btorva\b/, "torva"],
    [/\bbandos\b/, "bandos"],
    [/drygore/, "drygore"],
    [/tectonic/, "tectonic"],
    [/elite tectonic/, "elite-tectonic"],
    [/\bvirtus\b/, "virtus"],
    [/sirenic|elite sirenic/, "sirenic"],
    [/seasinger/, "seasinger"],
    [/superior seasinger/, "superior-seasinger"],
    [/deathdealer|death.?dealer/, "deathdealer"],
    [/first necromancer/, "first-necromancer"],
    [/anima core of zaros/, "anima-core-zaros"],
    [/anima core of seren/, "anima-core-seren"],
    [/anima core of sliske/, "anima-core-sliske"],
    [/anima core of zamorak/, "anima-core-zamorak"],
    [/cryptbloom/, "cryptbloom"],
    [/subjugation/, "subjugation"],
    [/ganodermic/, "ganodermic"],
    [/primeval/, "primeval"],
    [/pernix/, "pernix"],
    [/arma(dyl)?\b.*(?:body|helm|skirt|chest|boots|gloves)|armadyl\s+(helmet|chestplate|chainskirt)/, "armadyl"],
    [/death lotus|superior death lotus/, "death-lotus"],
    [/tetsu|superior tetsu/, "tetsu"],
    [/warpriest/, "warpriest"],
    [/barrows/, "barrows"],
  ];
  for (const [re, setId] of rules) {
    if (re.test(name) || re.test(id)) return setId;
  }
  return undefined;
}

async function main() {
  const raw = JSON.parse(await readFile(EQUIP, "utf8"));
  const all = raw.records ?? [];

  const targets = all.filter((r) => {
    if (r.slot == null || r.slot === "") return false;
    return !hasNonZeroBonus(r.bonuses);
  });

  console.log(`equipment records: ${all.length}`);
  console.log(`empty wearables (slot set, no non-zero bonuses): ${targets.length}`);

  // Pre-classify effect-only / aura without network when possible
  const work = targets.map((item) => {
    const candidates = titleCandidates(item);
    const effectReason = isEffectOnlyName(item.name, item.id, item.slot);
    return {
      item,
      candidates,
      primaryTitle: candidates[0] ?? item.name,
      effectReason,
      isAura: isAuraSlot(item.slot),
    };
  });

  // Titles to fetch: all candidates (union), but skip pure effect-only pocket items that we still try once
  const titlesToFetch = [...new Set(work.flatMap((w) => w.candidates).filter(Boolean))];
  console.log(`unique wiki title candidates: ${titlesToFetch.length}`);

  const pages = await fetchPagesByTitle(titlesToFetch);

  const records = [];
  let filled = 0;
  let empty = 0;

  for (const w of work) {
    const { item } = w;
    const out = {
      id: item.id,
      bonuses: {},
      status: "empty",
    };
    if (item.tier != null) out.tier = item.tier;
    const setId = inferSetId(item);
    if (setId) out.setId = setId;

    // Prefer first candidate that resolves to a page
    let page = null;
    let usedTitle = w.primaryTitle;
    let redirected = false;
    for (const t of w.candidates) {
      const p = pages.get(t);
      if (p && !p.__soft) {
        page = p;
        usedTitle = t;
        redirected = Boolean(p.redirectedFrom) || (p.title && p.title.toLowerCase() !== t.toLowerCase());
        break;
      }
    }

    if (!page) {
      // effect-only known classes
      if (w.effectReason === "effect-only") {
        out.status = "empty";
        out.reason = "effect-only";
        out.wikiTitle = usedTitle;
        empty++;
        records.push(out);
        continue;
      }
      if (w.isAura) {
        out.status = "empty";
        out.reason = "aura-no-static-infobox";
        out.wikiTitle = usedTitle;
        empty++;
        records.push(out);
        continue;
      }
      out.status = "error";
      out.reason = "missing-page";
      out.wikiTitle = usedTitle;
      empty++;
      records.push(out);
      continue;
    }

    out.wikiTitle = page.title;
    out.sources = [
      {
        source: "runescape-wiki",
        url: pageUrl(page.title),
        title: page.title,
        revision: page.revid != null ? String(page.revid) : undefined,
        verifiedAt: TODAY,
      },
    ];
    if (redirected) out.status = "redirect";

    const box = extractInfoboxBonuses(page.content);
    if (!box) {
      if (w.effectReason === "effect-only" || /scripture|scrimshaw/i.test(item.name)) {
        out.status = redirected ? "redirect" : "empty";
        out.reason = "effect-only";
        empty++;
        records.push(out);
        continue;
      }
      if (w.isAura) {
        const auraTry = tryAuraStaticDamage(page.content, null);
        if (auraTry.__auraPct != null) {
          // Static % damage aura — no flat equipment bonuses; record reason with pct
          out.status = "empty";
          out.reason = `aura-static-damage-pct:${auraTry.__auraPct}`;
          empty++;
          records.push(out);
          continue;
        }
        out.status = "empty";
        out.reason = "aura-no-static-infobox";
        empty++;
        records.push(out);
        continue;
      }
      out.status = redirected ? "redirect" : "empty";
      out.reason = "no-infobox";
      empty++;
      records.push(out);
      continue;
    }

    const params = parseInfoboxParams(box);
    let bonuses = mapBonuses(params);
    const tier = num(pick(params, "tier"));
    if (tier != null) out.tier = tier;

    if (!hasNonZeroBonus(bonuses) && w.isAura) {
      const auraTry = tryAuraStaticDamage(page.content, params);
      if (auraTry.__auraPct != null) {
        out.status = redirected ? "redirect" : "empty";
        out.reason = `aura-static-damage-pct:${auraTry.__auraPct}`;
        empty++;
        records.push(out);
        continue;
      }
    }

    out.bonuses = bonuses;
    if (hasNonZeroBonus(bonuses)) {
      out.status = redirected ? "redirect" : "ok";
      filled++;
    } else {
      if (w.effectReason === "effect-only" || /scripture|scrimshaw/i.test(item.name)) {
        out.reason = "effect-only";
      } else if (w.isAura) {
        out.reason = "aura-no-static-infobox";
      } else {
        out.reason = "infobox-zero";
      }
      out.status = redirected ? "redirect" : "empty";
      empty++;
    }
    records.push(out);
  }

  // Sort by id for stable diffs
  records.sort((a, b) => a.id.localeCompare(b.id));

  await mkdir(dirname(OUT), { recursive: true });
  const payload = {
    fetchedAt: TODAY,
    targets: targets.length,
    filled,
    empty,
    purpose:
      "Longtail Infobox Bonuses for equipment.json wearables with slot set and no non-zero bonuses. Candidates only — parent merges; do not edit equipment.json from this file.",
    mapping: {
      accuracy: "Infobox Bonuses accuracy → bonuses.accuracy",
      armour: "Infobox Bonuses armour → bonuses.armour",
      prayer: "Infobox Bonuses prayer → bonuses.prayer (omit 0)",
      damage:
        "Infobox strength|melee|ranged|magic|necromancy style bonus → bonuses.damage; else non-zero weapon damage",
    },
    byStatus: records.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
    byReason: records.reduce((acc, r) => {
      if (!r.reason) return acc;
      acc[r.reason] = (acc[r.reason] ?? 0) + 1;
      return acc;
    }, {}),
    records,
  };

  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(`targets=${targets.length} filled=${filled} empty=${empty}`);
  console.log("byStatus", payload.byStatus);
  console.log("byReason", payload.byReason);

  // Sample a few filled
  const samples = records.filter((r) => r.status === "ok" || (r.status === "redirect" && hasNonZeroBonus(r.bonuses))).slice(0, 8);
  for (const s of samples) {
    console.log(" sample", s.id, s.wikiTitle, JSON.stringify(s.bonuses), s.status);
  }
  const emptySamples = records.filter((r) => r.status === "empty" || r.status === "error").slice(0, 12);
  for (const s of emptySamples) {
    console.log(" empty ", s.id, s.reason ?? s.status, s.wikiTitle ?? "");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
