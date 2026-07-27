/**
 * READ-ONLY audit: Major unlocks Rewards/access icon gaps.
 * Simulates ResearchBrowser parent-filter + contentRewardsFull + presentContentRewards.
 * Usage: node --experimental-strip-types tools/_audit_major_reward_icons.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

async function loadTs(rel) {
  return import(pathToFileURL(join(ROOT, rel)).href);
}

const {
  contentRewardsSource,
  presentContentRewards,
  resolveRewardIcon,
  contentRewardTokens,
} = await loadTs("src/lib/dataContentPresentation.ts");
const { resolveRewardIconLabel, REWARD_ICON_BY_LABEL } = await loadTs(
  "src/lib/rewardIconAliases.ts",
);
const {
  upgradeIconPath,
  equipmentIconPath,
  slugifyIconLabel,
  dataEntityIconPath,
} = await loadTs("src/lib/gameArt.ts");

const catalog = JSON.parse(
  readFileSync(join(ROOT, "data/research/catalog.json"), "utf8"),
);

// --- ported from ResearchBrowser.tsx (keep in sync for audit fidelity) ---
function cleanText(value) {
  if (!value) return "";
  return value
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\[(?:edit|citation needed|source|note\s*\d*)\]/gi, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .trim();
}

function contentName(value) {
  return cleanText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\/\s*early Archaeology$/i, "")
    .replace(/\s+construction and Slayer hub$/i, "")
    .replace(/\s*\/\s*Underworld$/i, "")
    .replace(/\s+(?:Feldip Hills|Armadylean|Zamorakian|Dragonkin)\s+Archaeology$/i, "")
    .replace(/\s+Dig Site\s+(?:full mastery|mini-site)$/i, " Dig Site")
    .replace(/\s+/g, " ")
    .trim();
}

const CONTENT_ACCESS = {
  "Varrock Dig Site / early Archaeology":
    "Archaeology Guild shop · Mysterious monolith · Museum donation bin",
  "Pale wisps near Draynor": "Pale energy",
  "Fort Forinthry": "Fort buildings · chapel · Slayer hub",
  "Fort Forinthry construction and Slayer hub": "Fort buildings · chapel · Slayer hub",
  "City of Um / Underworld": "Ritual site · City of Um",
  "Hermod, the Spirit of War": "Deathdealer robe armour",
};

const CONTENT_REWARD_KEYS = {
  "Sanctum of Rebirth": "Sanctum of Rebirth uniques",
  "Rasial, the First Necromancer": "First Necromancer's equipment",
  "The Gate of Elidinis": "Gate of Elidinis uniques",
  "Vermyx, Brood Mother": "Sanctum of Rebirth uniques",
  "Kezalam, the Wanderer": "Sanctum of Rebirth uniques",
  "Nakatra, Devourer Eternal": "Sanctum of Rebirth uniques",
  Nex: "Nex equipment",
  "Nex: Angel of Death": "Nex: Angel of Death progression",
  Raksha: "Raksha ability upgrades",
  "Kerapac, the bound": "Kerapac progression",
  "Arch-Glacor": "Arch-Glacor progression",
  Croesus: "Croesus progression",
  "TzKal-Zuk": "TzKal-Zuk progression",
  "Zemouregal & Vorkath": "Zemouregal & Vorkath progression",
  Vorago: "Vorago progression",
  "Bandos equipment": "Bandos equipment",
  "Armadyl equipment": "Armadyl equipment",
  "Subjugation equipment": "Subjugation equipment",
};

function upgradeListScore(name, detail) {
  const n = name.toLowerCase();
  const d = detail.toLowerCase();
  let score = 0;
  if (/^[^()]{3,40} progression$/i.test(name.trim())) score += 45;
  if (/\buniques?\b/.test(n)) score += 50;
  if (/\bequipment\b/.test(n) && !/ladder|residual|package/.test(n)) score += 30;
  if (/\bprogression\b/.test(n)) score += 15;
  if (/unlocks:\s*/i.test(detail)) score += 40;
  if ((detail.match(/,/g) ?? []).length >= 1) score += 15;
  if ((detail.match(/,/g) ?? []).length >= 3) score += 15;
  if (
    detail.length > 0 &&
    detail.length < 160 &&
    !/effects:/i.test(detail) &&
    (detail.match(/,/g) ?? []).length >= 2
  ) {
    score += 40;
  }
  if (detail.length > 0 && detail.length < 160) score += 10;
  if (detail.length > 280) score -= 30;
  if (/effects:\s*/i.test(detail) && !/unlocks:\s*/i.test(detail)) score -= 25;
  if (/working league mapping|catalyst|unannounced|locality boundary/i.test(d)) score -= 80;
  if (/densify|residual|thin hub|working taxonomy|working misthalin/i.test(d)) score -= 35;
  if (/\bability upgrades\b|\bboot upgrades\b/i.test(n)) score += 25;
  return score;
}

function contentRewardsFull(row, upgrades) {
  const access = CONTENT_ACCESS[row.name] ?? CONTENT_ACCESS[contentName(row.name)];
  if (access) return access;

  const key =
    CONTENT_REWARD_KEYS[row.name] ??
    contentName(row.name).replace(/^The\s+/i, "").replace(/,.*/, "");
  const keyLower = key.toLocaleLowerCase();

  const matches = upgrades
    .map((candidate) => {
      const name = cleanText(candidate.name);
      const detail = cleanText(candidate.detail ?? "");
      const nameLower = name.toLocaleLowerCase();
      const stem = keyLower.split(/\s+/)[0].replace(/,$/, "");
      const hit =
        nameLower === keyLower ||
        nameLower.startsWith(keyLower) ||
        (stem.length >= 4 && nameLower.startsWith(stem));
      if (!hit || !detail) return null;
      let score = upgradeListScore(name, detail);
      if (nameLower === keyLower) score += 100;
      else if (nameLower.startsWith(keyLower)) score += 60;
      else score -= 10;
      return { name, detail, score };
    })
    .filter((x) => x != null)
    .sort((a, b) => b.score - a.score);

  if (matches.length) {
    const best = matches[0];
    const stem = (keyLower.split(/\s+/)[0] ?? keyLower).replace(/,$/, "");
    const picked = [best];
    for (const m of matches.slice(1)) {
      if (picked.length >= 3) break;
      if (m.score < 35) continue;
      if (m.score < best.score - 20) continue;
      if (!m.name.toLocaleLowerCase().startsWith(stem)) continue;
      if ((m.detail.match(/,/g) ?? []).length < 1 && !/unlocks:/i.test(m.detail)) continue;
      if (/densify|residual|thin hub|working misthalin|working taxonomy/i.test(m.detail)) {
        continue;
      }
      picked.push(m);
    }
    const lists = [];
    const seen = new Set();
    for (const m of picked) {
      const src = contentRewardsSource(m.detail);
      if (!src || src === "—") continue;
      const sig = src.toLocaleLowerCase();
      if (seen.has(sig)) continue;
      seen.add(sig);
      lists.push(src);
    }
    if (lists.length) return lists.join(", ");
  }

  const detail = cleanText(row.detail ?? "");
  if (detail && !/(?:working league mapping|catalyst|unannounced|locality boundary)/i.test(detail)) {
    return detail;
  }
  return "—";
}

/** Packages bound by contentRewardsFull (for wrong-binding report). */
function boundPackages(row, upgrades) {
  const access = CONTENT_ACCESS[row.name] ?? CONTENT_ACCESS[contentName(row.name)];
  if (access) return { kind: "access", access, packages: [] };

  const key =
    CONTENT_REWARD_KEYS[row.name] ??
    contentName(row.name).replace(/^The\s+/i, "").replace(/,.*/, "");
  const keyLower = key.toLocaleLowerCase();
  const explicitKey = Boolean(CONTENT_REWARD_KEYS[row.name]);

  const matches = upgrades
    .map((candidate) => {
      const name = cleanText(candidate.name);
      const detail = cleanText(candidate.detail ?? "");
      const nameLower = name.toLocaleLowerCase();
      const stem = keyLower.split(/\s+/)[0].replace(/,$/, "");
      const hit =
        nameLower === keyLower ||
        nameLower.startsWith(keyLower) ||
        (stem.length >= 4 && nameLower.startsWith(stem));
      if (!hit || !detail) return null;
      let score = upgradeListScore(name, detail);
      if (nameLower === keyLower) score += 100;
      else if (nameLower.startsWith(keyLower)) score += 60;
      else score -= 10;
      const matchKind =
        nameLower === keyLower
          ? "exact"
          : nameLower.startsWith(keyLower)
            ? "prefix"
            : "stem";
      return { name, detail, score, matchKind };
    })
    .filter((x) => x != null)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return { kind: "fallback-detail", key, explicitKey, packages: [] };

  const best = matches[0];
  const stem = (keyLower.split(/\s+/)[0] ?? keyLower).replace(/,$/, "");
  const picked = [best];
  for (const m of matches.slice(1)) {
    if (picked.length >= 3) break;
    if (m.score < 35) continue;
    if (m.score < best.score - 20) continue;
    if (!m.name.toLocaleLowerCase().startsWith(stem)) continue;
    if ((m.detail.match(/,/g) ?? []).length < 1 && !/unlocks:/i.test(m.detail)) continue;
    if (/densify|residual|thin hub|working misthalin|working taxonomy/i.test(m.detail)) continue;
    picked.push(m);
  }
  return { kind: "upgrade-match", key, explicitKey, packages: picked };
}

function isMajorContent(row, allContent, upgrades) {
  return !allContent.some(
    (parent) =>
      parent !== row &&
      cleanText(parent.name).toLowerCase() === cleanText(row.kind).toLowerCase() &&
      contentRewardsFull(parent, upgrades) === contentRewardsFull(row, upgrades),
  );
}

// --- public/game file index ---
function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

const publicGame = join(ROOT, "public/game").replace(/\\/g, "/");
const allGameFiles = walkFiles(publicGame);
const basenameToPaths = new Map(); // slug (no ext) -> web paths
const allWebPaths = new Set();
for (const abs of allGameFiles) {
  const rel = abs.slice(abs.indexOf("/public/game/") >= 0
    ? abs.indexOf("/public/game/") + "/public".length
    : abs.toLowerCase().indexOf("public/game/") + "public".length);
  // more robust:
  const idx = abs.toLowerCase().lastIndexOf("public/game/");
  const web = "/" + abs.slice(idx + "public/".length);
  allWebPaths.add(web.toLowerCase());
  const base = basename(abs).replace(/\.(png|jpg|jpeg|gif|webp)$/i, "").toLowerCase();
  if (!basenameToPaths.has(base)) basenameToPaths.set(base, []);
  basenameToPaths.get(base).push(web);
}

function publicExists(webPath) {
  if (!webPath || !webPath.startsWith("/game/")) return false;
  const abs = join(ROOT, "public", webPath.slice(1));
  return existsSync(abs);
}

function slugify(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function labelSlugMismatch(label, src) {
  if (!src) return false;
  const file = basename(src).replace(/\.(png|jpg|jpeg|gif|webp)$/i, "").toLowerCase();
  const nameSlug = slugify(label);
  const nameTokens = nameSlug.split("-").filter((t) => t.length >= 3);
  const fileTokens = file.split("-").filter((t) => t.length >= 3);
  if (!nameTokens.length || !fileTokens.length) return true;
  const shared = nameTokens.some(
    (t) =>
      file.includes(t) ||
      fileTokens.some((ft) => ft.includes(t) || t.includes(ft)),
  );
  // known intentional family mappings: body piece for set, etc.
  const familyOk =
    /\b(armour|armor|equipment|set|robes?|weapons?|components?|uniques?)\b/i.test(label) &&
    shared;
  if (familyOk) return false;
  return !shared;
}

// --- main scan ---
const zeroIconRows = [];
const failTokenCounts = new Map(); // token lower -> { label, count, rows:[] }
const suspicious = [];
const wrongBindings = [];
const missingContentRewardKeys = [];
const majorRowsAll = [];

const BOSSISH =
  /\b(boss|king|queen|beast|general|commander|nex|zuk|kerapac|croesus|glacor|rasial|vorago|araxx|telos|raksha|solak|hermod|nakatra|vermyx|kezalam|amascut|vorkath|zemouregal|magister|legio|durzag|yakamaru|corporeal|mole|jad|graardor|zilyana|kree|kril|vindicta|helwyr|gregorovic|twin|zamorak|elidinis|gate of|sanctum|rise of the six|barrows|dagannoth|kalphite|queen black|tormented|bork|chaos elemental)\b/i;

for (const region of catalog.regions) {
  const content = region.content || [];
  const upgrades = region.upgrades || [];
  const majors = content.filter((row) => isMajorContent(row, content, upgrades));

  for (const row of majors) {
    const rewardsFull = contentRewardsFull(row, upgrades);
    const presented = presentContentRewards(rewardsFull);
    const binding = boundPackages(row, upgrades);

    const entry = {
      region: region.id,
      regionName: region.name,
      name: row.name,
      kind: row.kind,
      rewardsFull: rewardsFull.slice(0, 280),
      sourceText: presented.sourceText.slice(0, 280),
      displayText: presented.displayText,
      tokens: presented.tokens,
      iconCount: presented.icons.length,
      icons: presented.icons,
      overflowResolved: presented.overflowResolved,
      binding,
    };
    majorRowsAll.push(entry);

    // 1. rewards text but 0 icons
    if (
      presented.sourceText &&
      presented.sourceText !== "—" &&
      presented.icons.length === 0
    ) {
      zeroIconRows.push({
        region: region.id,
        name: row.name,
        kind: row.kind,
        sourceText: presented.sourceText.slice(0, 200),
        tokens: presented.tokens,
        tokenCount: presented.tokens.length,
        bindingKey: binding.key ?? null,
        packages: (binding.packages || []).map((p) => p.name),
      });
    }

    // 2. failing tokens
    for (const tok of presented.tokens) {
      const src = resolveRewardIcon(tok);
      if (!src) {
        const k = tok.toLowerCase();
        const cur = failTokenCounts.get(k) || { label: tok, count: 0, regions: new Set(), rows: new Set() };
        cur.count++;
        cur.regions.add(region.id);
        cur.rows.add(row.name);
        failTokenCounts.set(k, cur);
      } else if (labelSlugMismatch(tok, src)) {
        suspicious.push({
          region: region.id,
          row: row.name,
          token: tok,
          src,
          fileExists: publicExists(src),
        });
      }
    }

    // 4. wrong upgrade packages (stem collision / residual / unrelated boss)
    if (binding.kind === "upgrade-match" && binding.packages.length) {
      const pkgNames = binding.packages.map((p) => p.name);
      const rowStem = contentName(row.name)
        .replace(/^The\s+/i, "")
        .replace(/,.*/, "")
        .toLowerCase()
        .split(/\s+/)[0];
      const issues = [];
      for (const p of binding.packages) {
        const pn = p.name.toLowerCase();
        // residual / densify
        if (/residual|densify|thin hub|working taxonomy|working misthalin/i.test(p.name + " " + p.detail)) {
          issues.push(`residual/prose package: ${p.name}`);
        }
        // stem match only when not explicit key and package is clearly another boss/content
        if (p.matchKind === "stem" && !binding.explicitKey) {
          // package starts with different multi-word identity
          const pkgHead = p.name.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
          const rowHead = contentName(row.name).replace(/^The\s+/i, "").toLowerCase();
          if (
            rowStem.length >= 4 &&
            !pn.startsWith(rowHead.slice(0, Math.min(rowHead.length, 12))) &&
            !pn.includes(rowStem)
          ) {
            issues.push(`stem collision (no row stem in pkg): ${p.name} [key=${binding.key}]`);
          }
          // known bad: short stems matching unrelated
          if (
            (rowStem === "nex" && !/nex/.test(pn)) ||
            (rowStem === "solak" && !/solak|lost grove|erethdor|blightbound|grimoire/i.test(pn)) ||
            (rowStem === "telos" && !/telos|seren godbow|staff of sliske|zaros godsword/i.test(p.detail + p.name))
          ) {
            issues.push(`suspicious stem bind: ${p.name}`);
          }
        }
        // CONTENT_REWARD_KEYS pointing to shared package for distinct bosses (Sanctum triple)
        if (
          binding.explicitKey &&
          /sanctum of rebirth uniques/i.test(p.name) &&
          !/sanctum of rebirth/i.test(row.name) &&
          /vermyx|kezalam|nakatra/i.test(row.name)
        ) {
          issues.push(
            `shared Sanctum package for sub-boss ${row.name} (may be intentional but flattens uniques)`,
          );
        }
        // score very low still picked as best
        if (p === binding.packages[0] && p.score < 40 && p.matchKind === "stem") {
          issues.push(`low-score stem best (${p.score}): ${p.name}`);
        }
      }
      // package name shares no meaningful token with row name (and not access override)
      const best = binding.packages[0];
      if (best && best.matchKind === "stem") {
        const rowTokens = slugify(contentName(row.name))
          .split("-")
          .filter((t) => t.length >= 4);
        const pkgTokens = slugify(best.name)
          .split("-")
          .filter((t) => t.length >= 4);
        const overlap = rowTokens.some((t) => pkgTokens.some((p) => p.includes(t) || t.includes(p)));
        if (!overlap && rowTokens.length) {
          issues.push(`zero token overlap row↔package: ${best.name}`);
        }
      }

      if (issues.length) {
        wrongBindings.push({
          region: region.id,
          row: row.name,
          kind: row.kind,
          key: binding.key,
          explicitKey: binding.explicitKey,
          packages: pkgNames,
          matchKinds: binding.packages.map((p) => `${p.matchKind}:${p.score}`),
          issues,
          rewardsPreview: rewardsFull.slice(0, 160),
        });
      }
    }

    // 6. boss-ish rows without CONTENT_REWARD_KEYS
    const isBossish =
      BOSSISH.test(row.name) ||
      BOSSISH.test(row.kind || "") ||
      /boss/i.test(row.kind || "");
    if (isBossish && !CONTENT_REWARD_KEYS[row.name] && !CONTENT_ACCESS[row.name]) {
      // check if stem matching got something reasonable
      const got = binding.kind === "upgrade-match" && binding.packages.length > 0;
      const bestName = binding.packages?.[0]?.name ?? null;
      const bestScore = binding.packages?.[0]?.score ?? null;
      const matchKind = binding.packages?.[0]?.matchKind ?? null;
      // missing key if: no package, or only weak stem, or residual
      const weak =
        !got ||
        matchKind === "stem" ||
        (bestScore != null && bestScore < 80) ||
        /residual|densify|working/i.test(bestName || "");
      if (weak || !got) {
        missingContentRewardKeys.push({
          region: region.id,
          row: row.name,
          kind: row.kind,
          hasKey: false,
          boundPackage: bestName,
          matchKind,
          score: bestScore,
          tokensResolved: presented.icons.length,
          tokensTotal: presented.tokens.length,
          sourcePreview: presented.sourceText.slice(0, 120),
        });
      }
    }
  }
}

// top fail tokens
const topFailTokens = [...failTokenCounts.values()]
  .map((v) => ({
    label: v.label,
    count: v.count,
    regions: [...v.regions].sort(),
    sampleRows: [...v.rows].slice(0, 5),
  }))
  .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  .slice(0, 50);

// 5. highest-ROI next aliases where files EXIST
// For each failing token, try to find a public file by slug / fuzzy
function findCandidatePaths(label) {
  const slug = slugify(label);
  const candidates = [];
  // exact basename
  if (basenameToPaths.has(slug)) {
    for (const p of basenameToPaths.get(slug)) candidates.push({ path: p, how: "exact-basename" });
  }
  // stripped trailing noise
  const stripped = slug
    .replace(/-(components?|equipment|upgrades?|armour-sets?|armor-sets?|sets?|materials?)$/g, "");
  if (stripped !== slug && basenameToPaths.has(stripped)) {
    for (const p of basenameToPaths.get(stripped)) candidates.push({ path: p, how: "stripped-basename" });
  }
  // common upgrade locations with slug
  const tryPaths = [
    `/game/upgrades/progression/${slug}.png`,
    `/game/upgrades/ability-codices/${slug}.png`,
    `/game/upgrades/skilling-offhands/${slug}.png`,
    `/game/upgrades/combat-utility/${slug}.png`,
    `/game/upgrades/permanent-unlocks/${slug}.png`,
    `/game/upgrades/permanent-equipment/${slug}.png`,
    `/game/upgrades/skilling-production/${slug}.png`,
    `/game/upgrades/${slug}.png`,
    `/game/combat/equipment/${slug}.png`,
    `/game/combat/abilities/melee/${slug}.png`,
    `/game/combat/abilities/magic/${slug}.png`,
    `/game/combat/abilities/ranged/${slug}.png`,
    `/game/combat/abilities/necromancy/${slug}.png`,
  ];
  if (stripped !== slug) {
    for (const t of [
      `/game/upgrades/progression/${stripped}.png`,
      `/game/upgrades/ability-codices/${stripped}.png`,
      `/game/combat/equipment/${stripped}.png`,
      `/game/upgrades/${stripped}.png`,
    ]) {
      tryPaths.push(t);
    }
  }
  for (const t of tryPaths) {
    if (publicExists(t)) candidates.push({ path: t, how: "path-guess" });
  }

  // fuzzy: basename contains all major tokens
  const tokens = slug.split("-").filter((t) => t.length >= 4);
  if (tokens.length >= 2) {
    for (const [base, paths] of basenameToPaths) {
      if (tokens.every((t) => base.includes(t))) {
        for (const p of paths) {
          // prefer upgrades/equipment
          if (/\/(upgrades|combat\/equipment|combat\/abilities)\//.test(p)) {
            candidates.push({ path: p, how: "fuzzy-all-tokens" });
          }
        }
      }
    }
  }
  // dedupe
  const seen = new Set();
  return candidates.filter((c) => {
    const k = c.path.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Also check upgradeIconPath / equipment for failing tokens — if those resolve, path exists via index
const roiCandidates = [];
for (const fail of topFailTokens) {
  // expand: use all fail tokens not just top 50 for ROI? Use full map sorted
}
const allFails = [...failTokenCounts.values()].sort((a, b) => b.count - a.count);
for (const fail of allFails) {
  const label = fail.label;
  // already has alias?
  if (resolveRewardIconLabel(label)) continue;
  // does resolveRewardIcon already work via upgrade/equip?
  if (resolveRewardIcon(label)) continue;

  const cands = findCandidatePaths(label);
  // also check if upgradeIconPath would work if we only need alias for equipment gating
  const up = upgradeIconPath(label);
  const equip = equipmentIconPath(slugifyIconLabel(label));
  const entity = dataEntityIconPath({ name: label });

  // Filter to reward-safe paths that exist
  let best = null;
  for (const c of cands) {
    if (!publicExists(c.path)) continue;
    if (!/^\/game\/(upgrades|combat\/equipment|combat\/abilities|combat)\//.test(c.path)) continue;
    // skip scenery/activities/bosses for reward chips? activities not strict-reward
    if (/^\/game\/(activities|bosses|regions|skills)\//.test(c.path)) continue;
    best = c;
    break;
  }
  // if upgrade path resolves in index, use it
  if (!best && up && publicExists(up) && up.startsWith("/game/upgrades/")) {
    best = { path: up, how: "upgradeIconPath" };
  }
  if (!best && equip && publicExists(equip)) {
    best = { path: equip, how: "equipmentIconPath" };
  }

  if (best) {
    roiCandidates.push({
      label,
      count: fail.count,
      regions: [...fail.regions].sort(),
      sampleRows: [...fail.rows].slice(0, 4),
      suggestedPath: best.path,
      how: best.how,
      fileExists: true,
    });
  }
}

// score ROI: count * (1 if progression/equip else 0.8) * uniqueness
roiCandidates.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
const topRoi = roiCandidates.slice(0, 20);

// zero icon rows: top 40 by region grouping
zeroIconRows.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
// prefer those with tokens (tokenizable but unresolved) first, then prose
const zeroPrioritized = [...zeroIconRows].sort((a, b) => {
  if (b.tokenCount !== a.tokenCount) return b.tokenCount - a.tokenCount;
  return a.region.localeCompare(b.region) || a.name.localeCompare(b.name);
});

// dedupe suspicious
const susKey = new Set();
const suspiciousUnique = [];
for (const s of suspicious) {
  const k = `${s.token}=>${s.src}`;
  if (susKey.has(k)) continue;
  susKey.add(k);
  suspiciousUnique.push(s);
}

// stats
const majorWithText = majorRowsAll.filter((r) => r.sourceText && r.sourceText !== "—");
const majorWithIcons = majorWithText.filter((r) => r.iconCount > 0);
const majorZeroIcons = majorWithText.filter((r) => r.iconCount === 0);

const report = {
  generatedAt: new Date().toISOString(),
  stats: {
    majorRows: majorRowsAll.length,
    majorWithRewardText: majorWithText.length,
    majorWithAtLeastOneIcon: majorWithIcons.length,
    majorWithTextButZeroIcons: majorZeroIcons.length,
    uniqueFailingTokens: failTokenCounts.size,
    failTokenOccurrences: [...failTokenCounts.values()].reduce((s, v) => s + v.count, 0),
    suspiciousMappings: suspiciousUnique.length,
    wrongBindings: wrongBindings.length,
    missingContentRewardKeys: missingContentRewardKeys.length,
    roiAliasesWithExistingFiles: roiCandidates.length,
  },
  zeroIconRows: zeroPrioritized.slice(0, 40),
  zeroIconRowsAllCount: zeroIconRows.length,
  topFailTokens,
  suspicious: suspiciousUnique.slice(0, 40),
  wrongBindings: wrongBindings.slice(0, 40),
  topRoiAliases: topRoi,
  missingContentRewardKeys: missingContentRewardKeys
    .sort((a, b) => a.region.localeCompare(b.region) || a.row.localeCompare(b.row))
    .slice(0, 60),
  // extra: per-region zero counts
  zeroByRegion: Object.fromEntries(
    [...new Set(zeroIconRows.map((r) => r.region))].map((id) => [
      id,
      zeroIconRows.filter((r) => r.region === id).length,
    ]),
  ),
};

writeFileSync(
  join(ROOT, "tmp-major-reward-icon-audit.json"),
  JSON.stringify(report, null, 2),
);

// human-readable summary to stdout
console.log("=== Major unlocks reward icon audit ===");
console.log(JSON.stringify(report.stats, null, 2));
console.log("\n--- 1. Rows with rewards text but 0 icons (top 40) ---");
for (const r of report.zeroIconRows) {
  console.log(
    `[${r.region}] ${r.name} | tokens=${r.tokenCount} | pkgs=${(r.packages || []).join(" ; ") || "—"}`,
  );
  console.log(`  src: ${r.sourceText}`);
  if (r.tokens.length) console.log(`  fail tokens: ${r.tokens.join(" | ")}`);
}
console.log("\n--- 2. Top failing tokens (50) ---");
for (const t of report.topFailTokens) {
  console.log(`  ${t.count}x  "${t.label}"  @ ${t.regions.join(",")}`);
}
console.log("\n--- 3. Suspicious label↔slug (sample) ---");
for (const s of report.suspicious.slice(0, 25)) {
  console.log(`  "${s.token}" → ${s.src}  exists=${s.fileExists}`);
}
console.log("\n--- 4. Wrong upgrade package bindings ---");
for (const w of report.wrongBindings) {
  console.log(`[${w.region}] ${w.row} key=${w.key} explicit=${w.explicitKey}`);
  console.log(`  pkgs: ${w.packages.join(" ; ")}`);
  console.log(`  issues: ${w.issues.join(" | ")}`);
}
console.log("\n--- 5. Highest-ROI next 20 aliases (files exist) ---");
for (const r of report.topRoiAliases) {
  console.log(`  ${r.count}x  "${r.label}" → ${r.suggestedPath} (${r.how})`);
}
console.log("\n--- 6. Boss rows missing CONTENT_REWARD_KEYS ---");
for (const m of report.missingContentRewardKeys) {
  console.log(
    `[${m.region}] ${m.row} | bound=${m.boundPackage || "—"} (${m.matchKind || "none"}, score=${m.score ?? "—"}) icons=${m.tokensResolved}/${m.tokensTotal}`,
  );
}
console.log("\nWrote tmp-major-reward-icon-audit.json");
