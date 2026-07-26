/**
 * Player-facing prose cleanup for regional data.
 * - Strip agent/audit voice from skilling, catalog, progression
 * - Rebuild Region combo from requiredRegions
 * - Soften false Hard REGION claims
 * - Clean equipment unlock.requirement "user ruling" prefixes
 * - Strip ex-aura name tags, empty Complements, broken · glue
 *
 * Run last in normalize:data so stamp/sync steps cannot re-poison copy.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const write = (p, v) => writeFileSync(join(ROOT, p), `${JSON.stringify(v, null, 2)}\n`);

const REGIONS = [
  "misthalin",
  "havenhythe",
  "karamja",
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "anachronia",
];

const DROP_SEGMENT =
  /^(does not re-emit|do not re-emit|do not invent|do not dual|do not hard-code|do not score|do not treat|do not assign|do not award|do not paste|do not restate|do not list every|do not ship|named residual|package residual|wave-?\w*|final pass|canonical emit|supersedes dual|explicitly requested|first-class residual|economy residual|infrastructure residual|residual package|planner checklist|closes ['"]?wave|prefer this id|prefer this row|prefer the existing id|prefer extreme invention residual|keep structure-rewards|complements [a-z0-9:_-]+ without|was buried only|missing invent|high-value missing|closes the false|audit rank|still-fucked|orthen residual previously|ranch residual|skilling residual companion|also tracked as|parity fix only|detail expansion under)/i;

const STRIP_CLAUSES = [
  /\bDoes not re-emit[^.·]*[.·]?/gi,
  /\bDo not re-emit[^.·]*[.·]?/gi,
  /\bDo not invent[^.·]*[.·]?/gi,
  /\bDo not dual-?claim[^.·]*[.·]?/gi,
  /\bDo not hard-code[^.·]*[.·]?/gi,
  /\bDo not score[^.·]*[.·]?/gi,
  /\bDo not treat[^.·]*[.·]?/gi,
  /\bDo not assign[^.·]*[.·]?/gi,
  /\bDo not award region score[^.·]*[.·]?/gi,
  /\bDo not paste[^.·]*[.·]?/gi,
  /\bDo not restate[^.·]*[.·]?/gi,
  /\bDo not list every[^.·]*[.·]?/gi,
  /\bDo not re-list every[^.·]*[.·]?/gi,
  /\bDo not use pre-[^.·]*[.·]?/gi,
  /\bDo not ship pre-Aura-Overhaul[^.·]*[.·]?/gi,
  /\bDo not ship[^.·]*[.·]?/gi,
  /\bNamed residual[^.·]*[.·]?/gi,
  /\bPackage residual[^.·]*[.·]?/gi,
  /\bFirst-class residual[^.·]*[.·]?/gi,
  /\bFirst-class per-building residual[^.·]*[.·]?/gi,
  /\bEconomy residual[^.·]*[.·]?/gi,
  /\bInfrastructure residual[^.·]*[.·]?/gi,
  /\bResidual package[^.·]*[.·]?/gi,
  /\bOrthen residual previously[^.·]*[.·]?/gi,
  /\bOrthen residual missing as first-class id[^.·]*[.·]?/gi,
  /\bRanch residual for[^.·]*[.·]?/gi,
  /\bSkilling residual companion to and\.?/gi,
  /\bSkilling residual companion to[^.·]*[.·]?/gi,
  /\bObstacle rewards residual:\s*/gi,
  /\bExplicitly requested[^.·]*[.·]?/gi,
  /\bNamed list expansion for planner checklists?[^.·]*[.·]?/gi,
  /\bPlanner checklist residual[^.·]*[.·]?/gi,
  /\bPlanner checklist[^.·]*[.·]?/gi,
  /\bCloses ['"]?wave[^.·]*[.·]?/gi,
  /\bCloses the false[^.·]*[.·]?/gi,
  // agent row/id preference voice
  /\bPrefer this id when[^.·]*[.·]?/gi,
  /\bPrefer this id[^.·]*[.·]?/gi,
  /\bprefer this id[^.·]*[.·]?/gi,
  /\bPrefer this row for[^.·]*[.·]?/gi,
  /\bPrefer this row[^.·]*[.·]?/gi,
  /\bPrefer this equipment row[^.·]*[.·]?/gi,
  /\bPrefer this over TH acquisition assumptions\.?/gi,
  /\bPrefer this when scoring[^.·]*[.·]?/gi,
  /\bprefer this Asgarnia mapping[^.·]*[.·]?/gi,
  /\bfor Equilibrium region taxonomy,\s*/gi,
  /\buntil Jagex publishes a split\.?/gi,
  /\bPrefer the existing id[^.·]*[.·]?/gi,
  /\bPrefer the existing [a-z0-9:_-]+ (equipment )?row[^.·]*[.·]?/gi,
  /\bPrefer existing [a-z0-9:_-]+ (equipment )?row[^.·]*[.·]?/gi,
  /\bPrefer specialised rows for[^.·]*[.·]?/gi,
  /\bPrefer child ids for[^.·]*[.·]?/gi,
  /\bPrefer extreme invention residual when[^.·]*[.·]?/gi,
  /\bPrefer full 85 lap for codex; partial sections for island routing earlier\.?/gi,
  /\bPrefer Pharm Ecology when ranking[^.·]*[.·]?/gi,
  /\bDetail expansion under existing hub id\.?\s*/gi,
  /\bWas buried only[^.·]*[.·]?/gi,
  /\bWas only a[^.·]*[.·]?/gi,
  /\bWas buried in[^.·]*[.·]?/gi,
  /\bWas fully missing\.?/gi,
  /\bComplements [a-z0-9:_-]+ without re-(emitting|listing|authoring)[^.·]*[.·]?/gi,
  /\bComplements\s*(?:\([^)]*\)\s*)+(?:and\s*(?:\([^)]*\)\s*)+)?[^.·]*/gi,
  /\bComplements beans market without re-listing every unchecked source\.?/gi,
  /\bComplements birdhouses and Hunter cluster already indexed for the region\.?/gi,
  /\bComplements resource list\.?/gi,
  /\bComplements without replacing site rows[,.]?/gi,
  /\bComplements without (?:re-emitting|re-authoring|re-listing|duplicating|inventing|overlapping)[^.·]*[.·]?/gi,
  /\bComplements without [^.·]*[.·]?/gi,
  /\bComplements [a-z0-9][a-z0-9:_-]*(?:-[a-z0-9:_-]+)+[^.·]*[.·]?/gi,
  /\bComplements\s*\/\s*[^.·]*/gi,
  /\bComplements\s*[—–]\s*[^.·]*/gi,
  /\bComplements existing and\s*\/\s*[^.·]*/gi,
  /\bComplements activity (?:pointer|detail)[^.·]*[.·]?/gi,
  /\bComplements the system blob[^.·]*[.·]?/gi,
  /\bComplements item ladder\.?/gi,
  /\bDoes not replace [a-z0-9:_-]+[^.·]*[.·]?/gi,
  /\bSkip re-emitting[^.·]*[.·]?/gi,
  /\bDo not re-author[^.·]*[.·]?/gi,
  /\bFINAL PASS[^.·]*[.·]?/gi,
  /\bWave[-\s]?(final|continue|\d+)[^.·]*[.·]?/gi,
  /\bcanonical emit[^.·]*[.·]?/gi,
  /\bsupersedes dual[^.·]*[.·]?/gi,
  /\baudit rank[^.·]*[.·]?/gi,
  /\bmissing from regional-skilling[^.·]*[.·]?/gi,
  /\bHigh-value Invention production permanent missing[^.·]*[.·]?/gi,
  /\bunless League alters the skill\.?/gi,
  /\bInvention unlock skill requirements remain[^.·]*[.·]?/gi,
  /\brates illustrative only[,.]?/gi,
  /\bHigh-value [^.·]*permanent\b(?=\s+Consumable)/gi,
  /\bDo not claim[^.·]*[.·]?/gi,
  /\bDo not hard-require[^.·]*[.·]?/gi,
  /\bDo not plan[^.·]*[.·]?/gi,
  /\bdo not label[^.·]*[.·]?/gi,
  /\bdo not confuse[^.·]*[.·]?/gi,
  /\bdo not double-count[^.·]*[.·]?/gi,
  /\bdo not drop[^.·]*[.·]?/gi,
  /\bAlso tracked as in drop-cleaners enrichment\.?/gi,
  /\bNamed Forinthry regional-skilling id so Daemonheim permanent list is complete\.?/gi,
  /\bStructure-rewards only lists lodge tiers in a blob[^.·]*[.·]?/gi,
  /\bthis residual is the permanent\.?/gi,
  /\bthis row is the permanent\.?/gi,
  /\bthis row first-classes[^.·]*[.·]?/gi,
  /\bfirst-classes the[^.·]*[.·]?/gi,
  /\bNamed\.\s*Parity fix only\.?\s*/gi,
  /\bParity fix only\.?\s*/gi,
  // agent geography jargon
  /\bhard-owns\b/gi,
  /\bhard-gates?\b/gi,
  /\boptional_pressure(?:_regions)?\b/gi,
  /\bstill planner-critical[^.·]*[.·]?/gi,
  /\bTag external meat only when planning[^.·]*[.·]?/gi,
  /\bfirst-class(?:es|ed)?\b/gi,
  /\bas first-class id\b/gi,
  /\branch residual\b/gi,
  /\bAgility infrastructure residual\b/gi,
  /\bHerblore residual\b/gi,
  /\bArchaeology travel residual\b/gi,
  /\bOrthen residual\b/gi,
  /\bproduce residual\b/gi,
  /\binfrastructure residual\b/gi,
  /\bmachine infrastructure residual\b/gi,
  /\boutfit head residual\b/gi,
  /\bpermanent modified skill-outfit head residual\b/gi,
  // internal id pointers
  /\b(?:see|pair with|prefer|keep|under|on|via|after)\s+[a-z][a-z0-9_-]*:[a-z0-9:_-]+[^.·]*/gi,
];

function stripInternalIds(text) {
  return text
    // drop whole "region:id is …" agent compare clauses before bare-id wipe
    .replace(
      /\b(?:cross-region|multi-region|invention|combat|boss|asgarnia|kandarin|misthalin|fremennik|forinthry|desert|morytania|tirannwn|anachronia|karamja|havenhythe|prifddinas):[a-z0-9][a-z0-9:_-]*\s+(?:is|already|remains|lists|covers|owns|names|tracks)\b[^.·;]*/gi,
      "",
    )
    .replace(
      /\b(?:cross-region|multi-region|invention|combat|boss|asgarnia|kandarin|misthalin|fremennik|forinthry|desert|morytania|tirannwn|anachronia|karamja|havenhythe|prifddinas):[a-z0-9][a-z0-9:_-]*/gi,
      "",
    )
    .replace(/\(\s*\)/g, "")
    .replace(/\(\s*(?:fuel|perks|and)?\s*(?:\/\s*)?\)/gi, "")
    .replace(/\bComplements\s+and\b/gi, "")
    .replace(/\bComplements\s*·/gi, "·")
    .replace(/\bComplements\s*$/gi, "")
    .replace(/\bComplements\s*[,;]/gi, "")
    .replace(/\bComplements\s+(?=[A-Z])/g, "")
    .replace(/\.\s*Complements\s*$/gi, ".")
    .replace(/\bcompanion to and\b/gi, "companion")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:·])/g, "$1")
    .trim();
}

function isNoiseSegment(seg) {
  const s = seg.trim();
  if (!s) return true;
  if (DROP_SEGMENT.test(s)) return true;
  if (
    /do not (re-emit|invent|claim|score|paste|restate|award|hard-require|plan|label|confuse|ship)|first-class residual|residual of |wave-|canonical|supersedes|explicitly requested|planner checklist|regional-skilling id|enrichment|prefer this (id|row)/i.test(
      s,
    ) &&
    s.length < 200
  ) {
    return true;
  }
  // orphan glue after stripping
  if (
    /^(Also|And|Pair with|Prefer|Complements|Consumable charges but|Consumable per|Named\.?|Parity fix)\b/i.test(
      s,
    ) &&
    s.length < 60
  ) {
    return true;
  }
  // empty Complements / dash-only fragments
  if (/^Complements\.?$/i.test(s)) return true;
  if (/^Complements\b/i.test(s) && /without re-|re-emit|re-author|phantom |first-class|prefer this|system blob|activity pointer/i.test(s)) {
    return true;
  }
  if (/^[—–\-·,.;:\s]+$/.test(s)) return true;
  return false;
}

function titleCaseRegion(id) {
  if (id === "forinthry") return "Forinthry";
  if (id === "tirannwn") return "Tirannwn";
  if (id === "havenhythe") return "Havenhythe";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function polishPlayerCopy(seg) {
  return seg
    // Aura Overhaul: live stack wording only (keep "old … aura" history intact)
    .replace(/\bworks with greenfingers auras active\b/gi, "works with Greenfingers passive")
    .replace(/\bworks with greenfingers auras\b/gi, "works with Greenfingers passive")
    // undo over-eager history rewrite from earlier passes
    .replace(/\bReplaces the old Greenfingers passive\b/g, "Replaces the old Greenfingers aura")
    // agent openers left after strip
    .replace(/^Was only a[^.·]*[.·]?\s*/i, "")
    .replace(/^Was buried[^.·]*[.·]?\s*/i, "")
    .replace(/^Was fully missing\.?\s*/i, "")
    .replace(/^Missing (?:named |combat[^.·]*|t\d+[^.·]*|mid-high[^.·]*)[.·]?\s*/i, "")
    // orphan clause after wiping a leading region:id subject
    .replace(/^Arc reward depth;\s*/i, "")
    .replace(/^this is the Ports hub itself\.?\s*/i, "Player-owned port hub. ")
    // hanging em-dash before segment glue left by agent strip
    .replace(/\s*[—–]\s*$/g, "")
    .replace(/^[—–]\s*/g, "")
    .replace(/\s*[—–]\s*·/g, " ·")
    .replace(/·\s*[—–]\s*/g, " · ")
    // orphan Complements / glue after id wipe
    .replace(/\bComplements\s*$/gi, "")
    .replace(/\bComplements\s*·/gi, "·")
    .replace(/\.\s*Complements\b/gi, ".")
    // double punctuation / empty list glue
    .replace(/,\s*,/g, ",")
    .replace(/·\s*,/g, " · ")
    .replace(/,\s*·/g, " · ")
    .replace(/\.\s*\./g, ".")
    .replace(/^\s*(?:is|was|and)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanizeDetail(detail, requiredRegions = []) {
  if (typeof detail !== "string" || !detail.trim()) return detail;
  const req = Array.isArray(requiredRegions) ? requiredRegions.filter(Boolean) : [];
  const reqSet = new Set(req);

  let segments = detail.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
  const out = [];

  for (let seg of segments) {
    if (/^Region combo \(all required\):/i.test(seg)) {
      if (req.length > 1) out.push(`Region combo (all required): ${req.join(" + ")}`);
      continue;
    }
    if (/^Region chain \(support pressure\):/i.test(seg)) continue;

    // Soften "Region pressure: Hard Asgarnia..." invent noise when not hard-req
    if (/^Region pressure:/i.test(seg) && req.length) {
      for (const reg of REGIONS) {
        if (reqSet.has(reg)) continue;
        seg = seg.replace(new RegExp(`Hard ${reg}\\b[^.·,]*(?:[.,]|$)`, "gi"), "");
        seg = seg.replace(new RegExp(`${titleCaseRegion(reg)} hard-owns[^.·,]*(?:[.,]|$)`, "gi"), "");
        seg = seg.replace(new RegExp(`${titleCaseRegion(reg)} optional:[^.·,]*(?:[.,]|$)`, "gi"), "");
      }
      seg = seg.replace(/^Region pressure:\s*/i, "Region pressure: ").replace(/\s{2,}/g, " ").trim();
      if (/^Region pressure:\s*$/i.test(seg) || seg.length < 24) continue;
    }

    const hardMatch = seg.match(/^Hard ([A-Za-z][A-Za-z -]+?)(?:\s|\.|$)/i);
    if (hardMatch && req.length) {
      const claimed = hardMatch[1].trim().toLowerCase().replace(/\s+/g, "");
      const ok = req.some(
        (r) => claimed.includes(r) || r.includes(claimed.replace(/province|region/g, "")),
      );
      if (!ok && REGIONS.some((r) => claimed.includes(r))) {
        if (/^Hard [^.]+$/i.test(seg) || seg.length < 100) {
          out.push(`Hard ${titleCaseRegion(req[0])}.`);
          continue;
        }
        for (const reg of REGIONS) {
          if (reqSet.has(reg)) continue;
          seg = seg.replace(new RegExp(`Hard ${reg}\\b[^.·]*[.·]?`, "gi"), " ");
        }
      }
    }

    if (isNoiseSegment(seg)) continue;

    for (const re of STRIP_CLAUSES) seg = seg.replace(re, " ");
    seg = stripInternalIds(seg);
    // residual used as agent noun → drop the word when agent-ish
    seg = seg
      .replace(/\b(?:ranch |Orthen |Agility |Herblore |produce |machine |outfit head )?residual\b/gi, "")
      .replace(/\bpermanent residual\b/gi, "permanent unlock")
      .replace(/\s{2,}/g, " ")
      .replace(/·\s*·/g, "·")
      .replace(/^\s*[,.;:·\-—–]+\s*|\s*[,.;:·\-—–]+\s*$/g, "")
      .trim();

    seg = polishPlayerCopy(seg);

    if (!seg || isNoiseSegment(seg)) continue;
    if (seg.length < 12 && !/^(Unlocks|Effects|Hard|Region)/i.test(seg)) continue;

    // Fix bad openings left after stripping lead sentences
    seg = seg
      .replace(/^(Also|And)\s+/i, "")
      .replace(/^Pair with\b[^·]*(?:·\s*)?/i, "")
      .replace(/^Prefer\b[^.·]*[.·]?\s*/i, "")
      .replace(/^Complements\b[^.·]*[.·]?\s*/i, "")
      .replace(/^Consumable per application but the blueprint discovery is the permanent account unlock\.?\s*/i, "")
      .replace(/^Consumable charges but permanent discovery[^.·]*[.·]?\s*/i, "")
      .replace(/^Consumable but permanent shop unlock[^.·]*[.·]?\s*/i, "")
      .replace(/^High-value only package\.?\s*/i, "")
      .replace(/^Explicitly excludes[^.·]*[.·]?\s*/i, "")
      .replace(/Multi dig-site collectors add[^.·]*[.·]?\s*/gi, "")
      .replace(/treat chains with dual hard gates on their dedicated relic rows\.?\s*/gi, "")
      .replace(/Planner shortlist of permanent \(or relic-hand\) first completions[^.·]*[.·]?\s*/gi, "")
      .replace(/not every chronote-only collection:\s*/gi, "");

    seg = polishPlayerCopy(seg);

    if (!seg || seg.length < 12) continue;
    out.push(seg);
  }

  if (req.length > 1 && !out.some((s) => /Region combo \(all required\):/i.test(s))) {
    out.splice(Math.min(1, out.length), 0, `Region combo (all required): ${req.join(" + ")}`);
  }

  let result = out.join(" · ");

  if (req.length) {
    for (const reg of REGIONS) {
      if (reqSet.has(reg)) continue;
      result = result.replace(new RegExp(`Hard ${reg}\\b[^.·]*[.·]?`, "gi"), " ");
    }
  }

  // Shorten invent global note spam to one short clause
  if ((result.match(/not Asgarnia-locked/g) || []).length) {
    result = result
      .replace(/[^.·]*not Asgarnia-locked[^.·]*[.!]?\s*/gi, " ")
      .replace(/[^.·]*Guild machine-room scenery stays Asgarnia place geography only\.?\s*/gi, " ")
      .trim();
    if (!/Invention (skill )?unlock and workbench|workbench manufacture are global|workbench craft is global/i.test(result)) {
      result = `${result} · Invention workbench craft is global (not region-locked).`.trim();
    }
  }

  result = result
    .replace(/\bpermanent\s+Consumable\b/g, "permanent. Consumable")
    .replace(/\bpermanent\s+([A-Z])/g, "permanent. $1")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/·\s*·/g, "·")
    .replace(/,\s*,/g, ",")
    .replace(/·\s*,/g, " · ")
    .replace(/,\s*·/g, " · ")
    .replace(/\s*[—–]\s*·/g, " ·")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .trim();

  return result;
}

function humanizeName(name) {
  if (typeof name !== "string") return name;
  return name
    .replace(/\s*\(ex-?aura\)\s*/gi, " ")
    .replace(/\s*\(first-class(?:\s+hub)?\)\s*/gi, " ")
    .replace(/\s+residual\b/gi, "")
    .replace(/\s+package residual\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanizeCategory(cat) {
  if (typeof cat !== "string") return cat;
  return cat
    .replace(/\s+residual\b/gi, "")
    .replace(/\binfrastructure residual\b/gi, "infrastructure")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanizeRequirement(text) {
  if (typeof text !== "string") return text;
  let s = text
    .replace(/^user region ruling[^:]*:\s*/i, "")
    .replace(/^user ruling[^:]*:\s*/i, "")
    .replace(/\s*—\s*no hard re.*$/i, "")
    .replace(/\s*—\s*not League region-.*$/i, "")
    .replace(/\s*—\s*not region-hard.*$/i, "")
    .replace(/\s*—\s*leave empty.*$/i, "")
    .replace(/\s*—\s*not Asgarnia-gated.*$/i, "")
    .replace(/\s*—\s*Misthalin-accessible not regi.*$/i, "")
    .trim();
  // Normalize known intentional empty-region reasons
  if (/Loyalty\/Solomon store aura/i.test(s)) return "Loyalty / Solomon store aura (not region-gated)";
  if (/invent\/POP craft/i.test(s)) return "Invention / Player-owned ports craft (not region-gated)";
  if (/invent fletching global/i.test(s)) return "Invention / Fletching craft (not region-gated)";
  if (/invent-global offhand/i.test(s)) return "Invention craft off-hand (not region-gated)";
  if (/master casket|Global reward/i.test(s)) return "Treasure Trails / global reward (not region-gated)";
  if (/skilling bow/i.test(s)) return "Skilling bow (not a League combat region gate)";
  if (/base sirenic multi-source/i.test(s)) return "Sirenic craft — multi-source material pressure (no single hard region)";
  if (/Runespan reward/i.test(s)) return "Runespan reward (not a hard elective region gate)";
  return s || text;
}

// ─── skilling ────────────────────────────────────────────────────────────────
const skPath = "data/research/regional-skilling-unlocks.json";
const sk = read(skPath);
let skChanged = 0;
for (const row of sk.records || []) {
  let changed = false;
  if (typeof row.detail === "string") {
    const next = humanizeDetail(row.detail, row.requiredRegions || []);
    if (next !== row.detail) {
      row.detail = next;
      changed = true;
    }
  }
  if (typeof row.name === "string") {
    const next = humanizeName(row.name);
    if (next !== row.name) {
      row.name = next;
      changed = true;
    }
  }
  if (typeof row.category === "string") {
    const next = humanizeCategory(row.category);
    if (next !== row.category) {
      row.category = next;
      changed = true;
    }
  }
  if (changed) skChanged++;
}
write(skPath, sk);

// ─── catalog ─────────────────────────────────────────────────────────────────
const catPath = "data/research/catalog.json";
const cat = read(catPath);
let catChanged = 0;
for (const region of cat.regions || []) {
  for (const u of region.upgrades || []) {
    let changed = false;
    if (typeof u.detail === "string") {
      const next = humanizeDetail(u.detail, u.requiredRegions || []);
      if (next !== u.detail) {
        u.detail = next;
        changed = true;
      }
    }
    if (typeof u.name === "string") {
      const next = humanizeName(u.name);
      if (next !== u.name) {
        u.name = next;
        changed = true;
      }
    }
    if (typeof u.category === "string") {
      const next = humanizeCategory(u.category);
      if (next !== u.category) {
        u.category = next;
        changed = true;
      }
    }
    if (changed) catChanged++;
  }
}
write(catPath, cat);

// ─── progression ─────────────────────────────────────────────────────────────
const progPath = "data/reference/progression-unlocks.json";
const prog = read(progPath);
let progChanged = 0;
for (const section of [
  "quest_unlocks",
  "account_unlocks",
  "activity_unlocks",
  "equipment_models",
  "ability_unlocks",
  "prayer_unlocks",
  "consumable_unlocks",
]) {
  if (!Array.isArray(prog[section])) continue;
  for (const row of prog[section]) {
    for (const field of ["notes", "detail", "league_treatment"]) {
      if (typeof row[field] !== "string") continue;
      const next = humanizeDetail(row[field], row.required_regions || row.requiredRegions || []);
      if (next !== row[field]) {
        row[field] = next;
        progChanged++;
      }
    }
    if (typeof row.name === "string") {
      const next = humanizeName(row.name);
      if (next !== row.name) {
        row.name = next;
        progChanged++;
      }
    }
  }
}
write(progPath, prog);

// ─── equipment (after stamp — this script runs last) ─────────────────────────
const eqPath = "data/combat/equipment.json";
const eq = read(eqPath);
let eqChanged = 0;
for (const row of eq.records || []) {
  if (!row.unlock || typeof row.unlock.requirement !== "string") continue;
  const next = humanizeRequirement(row.unlock.requirement);
  if (next !== row.unlock.requirement) {
    row.unlock.requirement = next;
    eqChanged++;
  }
}
write(eqPath, eq);

// verify
const after = read(skPath);
const audit =
  /do not re-emit|do not invent|do not ship|first-class residual|wave-\d|FINAL PASS|supersedes dual|canonical emit|explicitly requested|user ruling|hard-owns|optional_pressure|planner checklist|named residual|residual package|prefer this id|ex-aura|companion to and|works with greenfingers auras/i;
let left = 0;
const leftSamples = [];
for (const r of after.records || []) {
  const blob = `${r.detail || ""} ${r.name || ""} ${r.category || ""}`;
  if (audit.test(blob)) {
    left++;
    if (leftSamples.length < 8) {
      const m = blob.match(audit);
      leftSamples.push({ id: r.id, hit: m?.[0] });
    }
  }
}
const eqAfter = read(eqPath);
const eqUser = eqAfter.records.filter((r) => /user ruling/i.test(r.unlock?.requirement || "")).length;

const catAfter = read(catPath);
let catLeft = 0;
for (const region of catAfter.regions || []) {
  for (const u of region.upgrades || []) {
    const blob = `${u.detail || ""} ${u.name || ""} ${u.category || ""}`;
    if (audit.test(blob)) catLeft++;
  }
}

console.log(
  JSON.stringify(
    {
      skillingRowsTouched: skChanged,
      catalogUpgradesTouched: catChanged,
      progressionFieldsTouched: progChanged,
      equipmentRequirementsTouched: eqChanged,
      skillingAuditMarkersLeft: left,
      catalogAuditMarkersLeft: catLeft,
      equipmentUserRulingLeft: eqUser,
      skillingLeftSamples: leftSamples,
    },
    null,
    2,
  ),
);
