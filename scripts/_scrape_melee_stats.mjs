/**
 * One-shot: scrape melee wearable combat stats from RS Wiki Infobox Bonuses.
 * Writes ONLY scraped-data/equipment-stats-melee-2026-07-26.json
 * Does NOT touch data/combat/equipment.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wikiApi } from "./lib/runescape-wiki.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = "2026-07-26";
const OUT = join(ROOT, "scraped-data", `equipment-stats-melee-${TODAY}.json`);
const EQUIP = join(ROOT, "data", "combat", "equipment.json");

const BATCH = 20;
const PAUSE_MS = 350;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

function titleFromName(name) {
  return String(name ?? "").trim();
}

/** Extract first {{Infobox Bonuses ... }} block (handles nested braces lightly). */
function extractInfoboxBonuses(wikitext) {
  const start = wikitext.search(/\{\{\s*Infobox\s+Bonuses\b/i);
  if (start < 0) return null;
  let i = start + 2;
  let depth = 1;
  while (i < wikitext.length && depth > 0) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i += 2;
      continue;
    }
    if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i += 2;
      continue;
    }
    i++;
  }
  if (depth !== 0) return null;
  return wikitext.slice(start, i);
}

/** Parse |key = value lines; versioned keys like damage1 take unversioned first. */
function parseInfoboxParams(box) {
  const params = {};
  // strip template name line
  const body = box.replace(/^\{\{\s*Infobox\s+Bonuses[^\n|]*\n?/i, "");
  const re = /^\|\s*([a-zA-Z0-9_]+)\s*=\s*(.*?)\s*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const key = m[1].toLowerCase();
    let val = m[2].trim();
    // strip wiki markup lightly
    val = val
      .replace(/\{\{[^}]*\}\}/g, " ")
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
  const s = String(v).replace(/,/g, "").trim();
  if (!s || s === "-" || s === "–" || s === "—" || /^n\/?a$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Prefer unversioned, then version 1 fields. */
function pick(params, ...keys) {
  for (const k of keys) {
    const base = k.toLowerCase();
    if (params[base] != null && params[base] !== "") return params[base];
    if (params[`${base}1`] != null && params[`${base}1`] !== "") return params[`${base}1`];
  }
  return null;
}

function mapBonuses(params) {
  const bonuses = {};
  // Weapons: damage; armour power: strength (melee style dmg) or damage
  const dmg =
    num(pick(params, "damage")) ??
    num(pick(params, "strength")) ??
    num(pick(params, "melee")) ??
    null;
  const accuracy = num(pick(params, "accuracy"));
  const armour = num(pick(params, "armour"));
  const prayer = num(pick(params, "prayer"));

  if (dmg != null) bonuses.damage = dmg;
  if (accuracy != null) bonuses.accuracy = accuracy;
  if (armour != null) bonuses.armour = armour;
  if (prayer != null) bonuses.prayer = prayer;
  return bonuses;
}

function inferSetId(item) {
  if (item.setId) return item.setId;
  const name = String(item.name ?? "").toLowerCase();
  const id = String(item.id ?? "").toLowerCase();
  const rules = [
    [/trimmed masterwork|tmw|item:trimmed-masterwork/, "trimmed-masterwork"],
    [/masterwork|item:masterwork/, "masterwork"],
    [/vestments of havoc|vestments-of-havoc/, "vestments-of-havoc"],
    [/malevolent/, "malevolent"],
    [/torva/, "torva"],
    [/bandos/, "bandos"],
    [/drygore/, "drygore"],
    [/\bleng\b|ek-zekkil|dark ice|item:leng|item:ek-zekkil/, "leng"],
    [/chaotic/, "chaotic"],
    [/tetsu/, "tetsu"],
    [/anima core.*zaros|zaros.*anima|refined anima core of zaros/, "anima-core-zaros"],
    [/anima core/, "anima-core"],
    [/superior sestrogon|sestrogon/, "sestrogon"],
    [/jaws of the abyss/, "jaws-of-the-abyss"],
    [/terrasaur/, "terrasaur"],
    [/khopesh|twin fury|crimson|igneous kal/, "khopesh"],
    [/elder rune.*plus|plus ?5/, "elder-rune"],
    [/barrows|torags|dharok|guthan|verac|ahrim|karil|ahrims/, "barrows"],
    [/dragon rider|dragonrider/, "dragon-rider"],
    [/gloves of passage|passage/, "gloves-of-passage"],
    [/cinderbane/, "cinderbane"],
    [/lava whip|lava-whip/, "lava"],
    [/abyssal/, "abyssal"],
    [/noxious/, "noxious"],
    [/zaros godsword|zgs/, "zaros-godsword"],
    [/animo|praesul|praesulic/, "praesul"],
    [/keris|akhs|tumeken.*light|devourer/, "tumeken"],
    [/essence of finality|eof/, "essence-of-finality"],
    [/reaver|reavers/, "reaver"],
    [/blast diffusion|blast-diffusion/, "blast-diffusion"],
    [/enhanced devoted|devoted/, "devoted"],
    [/champion.*ring|ring of death|asylum surgeon|luck of the dwarves|reaver.?s ring|channeler.?s/, "ring"],
    [/amulet of souls|reaper necklace|essence of finality amulet|salve|fury|blood amulet/, "amulet"],
    [/ignea|igneous/, "igneous"],
    [/obsidian/, "obsidian"],
    [/brawler|fighter torso|void/, "void-or-hybrid"],
    [/superior death lotus|death lotus/, "death-lotus"],
    [/sea singer|seasinger/, "seasinger"],
  ];
  for (const [re, setId] of rules) {
    if (re.test(name) || re.test(id)) return setId;
  }
  // family from leading tokens of id
  const slug = id.replace(/^item:/, "");
  const parts = slug.split("-").filter(Boolean);
  if (parts.length >= 2) {
    // drop slot suffixes
    const drop = new Set([
      "helm", "helmet", "full", "mask", "body", "platebody", "top", "robe",
      "legs", "skirt", "tassets", "platelegs", "gloves", "gauntlets", "vambraces",
      "boots", "shoes", "mainhand", "offhand", "off", "hand", "2h", "twohand",
      "sword", "rapier", "mace", "longsword", "dagger", "scimitar", "spear",
      "halberd", "maul", "battleaxe", "warhammer", "claw", "claws", "whip",
      "shield", "defender", "kiteshield", "square",
    ]);
    const keep = parts.filter((p) => !drop.has(p));
    if (keep.length >= 1 && keep.length <= 3) return keep.slice(0, 3).join("-");
  }
  return undefined;
}

function isSoftRedirect(content) {
  const m = String(content ?? "").trim().match(/^#REDIRECT\s*\[\[([^\]]+)\]\]/i);
  return m ? m[1].split("|")[0].trim() : null;
}

async function fetchPagesByTitle(titles) {
  // MediaWiki multi-title query; batch carefully; follow #REDIRECT soft redirects
  const result = new Map();
  const pending = titles.slice();
  const seenFetch = new Set();
  while (pending.length) {
    const batch = [];
    while (batch.length < BATCH && pending.length) {
      const t = pending.shift();
      if (seenFetch.has(t)) continue;
      seenFetch.add(t);
      batch.push(t);
    }
    if (!batch.length) break;
    const data = await wikiApi({
      action: "query",
      prop: "revisions",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      redirects: "1",
      titles: batch.join("|"),
    });
    const redirects = new Map();
    for (const r of data?.query?.redirects ?? []) redirects.set(r.from, r.to);
    const normalized = new Map();
    for (const n of data?.query?.normalized ?? []) normalized.set(n.from, n.to);
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
      resolved = redirects.get(resolved) ?? redirects.get(req) ?? resolved;
      const page = byTitle.get(resolved);
      if (!page) continue;
      const soft = isSoftRedirect(page.content);
      if (soft && soft !== page.title) {
        // re-fetch target; map original req to eventual page
        pending.push(soft);
        // stash mapping via a placeholder resolved later
        result.set(req, { __soft: soft, title: soft });
        continue;
      }
      result.set(req, page);
    }
    process.stdout.write(`  fetched unique=${seenFetch.size} resolved=${[...result.values()].filter((v) => !v.__soft).length}\r`);
    await sleep(PAUSE_MS);
  }
  // Resolve soft redirect chains: req -> soft title -> page
  for (const [req, val] of [...result.entries()]) {
    if (!val?.__soft) continue;
    let target = val.__soft;
    let hops = 0;
    while (hops++ < 5) {
      const page = result.get(target) || [...result.values()].find((p) => p.title === target && !p.__soft);
      if (page && !page.__soft) {
        result.set(req, page);
        break;
      }
      if (page?.__soft) {
        target = page.__soft;
        continue;
      }
      // try any key that resolved to this title
      const hit = [...result.entries()].find(([, p]) => p.title === target && !p.__soft);
      if (hit) {
        result.set(req, hit[1]);
        break;
      }
      break;
    }
    if (result.get(req)?.__soft) result.delete(req);
  }
  process.stdout.write("\n");
  return result;
}

function pageUrl(title) {
  return `https://runescape.wiki/w/${encodeURIComponent(title).replace(/%20/g, "_")}`;
}

async function main() {
  const raw = JSON.parse(await readFile(EQUIP, "utf8"));
  const melee = (raw.records ?? []).filter(
    (r) => r.style === "melee" && r.slot != null && r.slot !== "",
  );
  console.log(`Melee wearables with slot: ${melee.length}`);

  // Build title list from sources url or name
  const titleFor = new Map(); // id -> title
  for (const item of melee) {
    const fromUrl = wikiTitleFromUrl(item.sources?.[0]?.url);
    const title = fromUrl || titleFromName(item.name);
    titleFor.set(item.id, title);
  }

  // unique titles
  const uniqueTitles = [...new Set(titleFor.values())];
  console.log(`Unique wiki titles: ${uniqueTitles.length}`);

  const pages = await fetchPagesByTitle(uniqueTitles);

  const records = [];
  let filled = 0;
  let empty = 0;
  let missingPage = 0;

  for (const item of melee) {
    const title = titleFor.get(item.id);
    const page = pages.get(title);
    const out = {
      id: item.id,
      bonuses: {},
      sources: [
        {
          source: "runescape-wiki",
          url: page ? pageUrl(page.title) : pageUrl(title),
          verifiedAt: TODAY,
        },
      ],
    };

    const setId = inferSetId(item);
    if (setId) out.setId = setId;
    if (item.tier != null) out.tier = item.tier;

    if (!page) {
      missingPage++;
      empty++;
      // keep existing bonuses from equipment.json only if present? Rule: never invent — leave empty if not found
      records.push(out);
      continue;
    }

    const box = extractInfoboxBonuses(page.content);
    if (!box) {
      empty++;
      records.push(out);
      continue;
    }
    const params = parseInfoboxParams(box);
    const bonuses = mapBonuses(params);
    const tier = num(pick(params, "tier"));
    if (tier != null) out.tier = tier;
    out.bonuses = bonuses;

    if (Object.keys(bonuses).length > 0) filled++;
    else empty++;

    records.push(out);
  }

  await mkdir(dirname(OUT), { recursive: true });
  const payload = {
    fetchedAt: TODAY,
    style: "melee",
    count: records.length,
    filled,
    empty,
    missingPage,
    records,
  };
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(`filled=${filled} empty=${empty} missingPage=${missingPage} total=${records.length}`);

  // sample a few high-tier for sanity
  const samples = ["item:drygore-rapier", "item:torva-full-helm", "item:tumekens-light", "item:masterwork-platebody"];
  for (const id of samples) {
    const r = records.find((x) => x.id === id);
    if (r) console.log(" sample", id, JSON.stringify(r.bonuses), "tier", r.tier, "set", r.setId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
