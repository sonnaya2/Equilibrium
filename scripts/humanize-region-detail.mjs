import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

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
  if (
    /^Complements\b/i.test(s) &&
    /without re-|re-emit|re-author|phantom |first-class|prefer this|system blob|activity pointer/i.test(
      s,
    )
  ) {
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
  return (
    seg
      // Aura Overhaul: live stack wording only (keep "old … aura" history intact)
      .replace(/\bworks with greenfingers auras active\b/gi, "works with Greenfingers passive")
      .replace(/\bworks with greenfingers auras\b/gi, "works with Greenfingers passive")
      // undo over-eager history rewrite from earlier passes
      .replace(/\bReplaces the old Greenfingers passive\b/g, "Replaces the old Greenfingers aura")
      .replace(/^Was only a[^.·]*[.·]?\s*/i, "")
      .replace(/^Was buried[^.·]*[.·]?\s*/i, "")
      .replace(/^Was fully missing\.?\s*/i, "")
      .replace(/^Missing (?:named |combat[^.·]*|t\d+[^.·]*|mid-high[^.·]*)[.·]?\s*/i, "")
      // orphan clause after wiping a leading region:id subject
      .replace(/^Arc reward depth;\s*/i, "")
      .replace(/^this is the Ports hub itself\.?\s*/i, "Player-owned port hub. ")
      .replace(/^Player-owned port hub\.\s*/i, "Player-owned port hub. ")
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
      .trim()
  );
}

function humanizeDetail(detail, requiredRegions = []) {
  if (typeof detail !== "string" || !detail.trim()) return detail;
  const req = Array.isArray(requiredRegions) ? requiredRegions.filter(Boolean) : [];
  const reqSet = new Set(req);

  let segments = detail
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];

  for (let seg of segments) {
    if (/^Region combo \(all required\):/i.test(seg)) {
      if (req.length > 1) out.push(`Region combo (all required): ${req.join(" + ")}`);
      continue;
    }
    if (/^Region chain \(support pressure\):/i.test(seg)) continue;

    if (/^Region pressure:/i.test(seg) && req.length) {
      for (const reg of REGIONS) {
        if (reqSet.has(reg)) continue;
        seg = seg.replace(new RegExp(`Hard ${reg}\\b[^.·,]*(?:[.,]|$)`, "gi"), "");
        seg = seg.replace(
          new RegExp(`${titleCaseRegion(reg)} hard-owns[^.·,]*(?:[.,]|$)`, "gi"),
          "",
        );
        seg = seg.replace(
          new RegExp(`${titleCaseRegion(reg)} optional:[^.·,]*(?:[.,]|$)`, "gi"),
          "",
        );
      }
      seg = seg
        .replace(/^Region pressure:\s*/i, "Region pressure: ")
        .replace(/\s{2,}/g, " ")
        .trim();
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
    seg = seg
      .replace(
        /\b(?:ranch |Orthen |Agility |Herblore |produce |machine |outfit head )?residual\b/gi,
        "",
      )
      .replace(/\bpermanent residual\b/gi, "permanent unlock")
      .replace(/\s{2,}/g, " ")
      .replace(/·\s*·/g, "·")
      .replace(/^\s*[,.;:·\-—–]+\s*|\s*[,.;:·\-—–]+\s*$/g, "")
      .trim();

    seg = polishPlayerCopy(seg);

    if (!seg || isNoiseSegment(seg)) continue;
    if (seg.length < 12 && !/^(Unlocks|Effects|Hard|Region)/i.test(seg)) continue;

    seg = seg
      .replace(/^(Also|And)\s+/i, "")
      .replace(/^Pair with\b[^·]*(?:·\s*)?/i, "")
      .replace(/^Prefer\b[^.·]*[.·]?\s*/i, "")
      .replace(/^Complements\b[^.·]*[.·]?\s*/i, "")
      .replace(
        /^Consumable per application but the blueprint discovery is the permanent account unlock\.?\s*/i,
        "",
      )
      .replace(/^Consumable charges but permanent discovery[^.·]*[.·]?\s*/i, "")
      .replace(/^Consumable but permanent shop unlock[^.·]*[.·]?\s*/i, "")
      .replace(/^High-value only package\.?\s*/i, "")
      .replace(/^Explicitly excludes[^.·]*[.·]?\s*/i, "")
      .replace(/Multi dig-site collectors add[^.·]*[.·]?\s*/gi, "")
      .replace(/treat chains with dual hard gates on their dedicated relic rows\.?\s*/gi, "")
      .replace(
        /Planner shortlist of permanent \(or relic-hand\) first completions[^.·]*[.·]?\s*/gi,
        "",
      )
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

  if ((result.match(/not Asgarnia-locked/g) || []).length) {
    result = result
      .replace(/[^.·]*not Asgarnia-locked[^.·]*[.!]?\s*/gi, " ")
      .replace(/[^.·]*Guild machine-room scenery stays Asgarnia place geography only\.?\s*/gi, " ")
      .trim();
    if (
      !/Invention (skill )?unlock and workbench|workbench manufacture are global|workbench craft is global/i.test(
        result,
      )
    ) {
      result = `${result} · Invention workbench craft is global (not region-locked).`.trim();
    }
  }

  result = result
    .replace(/\bpermanent\s+Consumable\b/g, "permanent. Consumable")
    .replace(/\bpermanent\s+([A-Z])/g, "permanent. $1")
    .replace(/\.\s*\./g, ".")
    .replace(/\.\s*·/g, " ·")
    .replace(/\s{2,}/g, " ")
    .replace(/·\s*·/g, "·")
    .replace(/,\s*,/g, ",")
    .replace(/·\s*,/g, " · ")
    .replace(/,\s*·/g, " · ")
    .replace(/\s*[—–]\s*·/g, " ·")
    .replace(/\s*\(not a(?=\s*·|$)/gi, "")
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
  if (/Loyalty\/Solomon store aura/i.test(s))
    return "Loyalty / Solomon store aura (not region-gated)";
  if (/invent\/POP craft/i.test(s))
    return "Invention / Player-owned ports craft (not region-gated)";
  if (/invent fletching global/i.test(s)) return "Invention / Fletching craft (not region-gated)";
  if (/invent-global offhand/i.test(s)) return "Invention craft off-hand (not region-gated)";
  if (/master casket|Global reward/i.test(s))
    return "Treasure Trails / global reward (not region-gated)";
  if (/skilling bow/i.test(s)) return "Skilling bow (not a League combat region gate)";
  if (/base sirenic multi-source/i.test(s))
    return "Sirenic craft — multi-source material pressure (no single hard region)";
  if (/Runespan reward/i.test(s)) return "Runespan reward (not a hard elective region gate)";
  return s || text;
}

const ASGARNIA_CONTENT_DROP = new Set([
  "God Wars Dungeon 1",
  "Player-owned port",
  "Rimmington Construction supply loop",
]);

const ASGARNIA_UPGRADE_DROP = new Set([
  "Bandos equipment (GWD1 melee power ladder)",
  "Combat scrimshaw pocket package (POP)",
  "Essence of Finality amulet (neck BiS chain)",
  "Essence of Finality ornament kit (style bonus)",
  "Familiarisation (weekly triple-charm D&D)",
  "Flash Powder Factory Herblore outfits",
  "Flash Powder Factory minigame and reward shop",
  "Games necklace teleport package",
  "God Wars Dungeon 1 (+ Nex)",
  "God Wars Dungeon 1 equipment",
  "Godswords (GWD1 hilt + shard assembly)",
  "Herb patch network (global herb-run map)",
  "Hops patch network (Entrana + run geography)",
  "Invention Guild named machine room",
  "Invention machines (Invention Guild + Fort Workshop power)",
  "Large Summoning obelisk production network",
  "Magic golem outfit",
  "Masterwork melee plate / glorious-bar smithing chain",
  "Masterwork Spear of Annihilation",
  "Mining Guild metal-bank smithing loop",
  "Mining Guild resource dungeon",
  "Modified blacksmith's helmet",
  "Modified botanist's mask",
  "Nex equipment",
  "Nex T80 power armour (Torva / Pernix / Virtus)",
  "Nex: Angel of Death progression",
  "Ore box tier upgrades",
  "Pernix armour",
  "Pikkupstix Summoning shop and large obelisk (Taverley)",
  "Player-owned house Aquarium and Prawnbroker",
  "Player-owned house portal towns and Construction utilities",
  "Player-owned ports skilling rewards (Asgarnia Arc mapping)",
  "Ports Reward Shop (Boni Waiko) permanent scrolls + trade-goods access",
  "POH gilded altar (Chapel offering)",
  "Praesul codex style curses (Malevolence / Desolation / Affliction / Ruination)",
  "Rimmington Construction supply loop",
  "Rogue equipment",
  "Rogue equipment (Flash Powder Factory rubble)",
  "Rogues' Den banking, safes, and Thieving",
  "Rogues' Den banking, safes, and Thieving hub",
  "Saradomin godsword special (heal switch)",
  "Scrimshaw Crafter (Player-owned port workshop)",
  "Scrimshaw of sacrifice (+ superior POP upgrade)",
  "Scrimshaw of the elements",
  "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
  "Seasinger (Ports / Arc)",
  "Silverhawk boots (Agility XP from feathers/down)",
  "Skilling scrimshaw craft package (Player-owned port)",
  "Sojobo Arc contracts hub (Waiko)",
  "Taverley / Burthorpe early–mid skilling hub",
  "Temple of Aminishi (ED1)",
  "Thaler skilling rewards hub (Stanley Limelight Traders)",
  "The Arc skilling destinations (Equilibrium Asgarnia mapping)",
  "The Arc Waiko reward shop (chime economy)",
  "Toolbelt attach: Seedicide",
  "Torva armour and praesulic essence (melee)",
  "Trimmed / custom-fit trimmed masterwork melee armour",
  "Turael / Spria (Burthorpe starter Slayer Masters)",
  "Turtling perk (tank gizmo)",
  "Virtus equipment and Praesulic essence",
  "Vorago",
  "Vorago progression",
  "Waiko commodity sell permanent upgrades",
  "Waiko contracts-per-day permanent upgrades",
  "Waiko grill (permanent Arc Cooking station)",
  "Waiko uncharted supplies permanent upgrades (cap + cost)",
  "Whale's Maw campfire + deposit box permanent unlocks",
  "Wicked hood (Runecrafting talisman storage + altar teleports)",
]);

const KANDARIN_CONTENT_DROP = new Set([
  "Ardougne farming patches and Manor Farm access geography",
  "Catherby fishing and farming hub",
  "Fishing Guild",
  "Kuradal's Dungeon and ferocious ring hub",
  "Manor Farm (Farming Guild) and reputation rewards",
  "Manor Farm animal perks",
  "Player-Owned Farm / Manor Farm",
]);

const KANDARIN_UPGRADE_DROP = new Set([
  "Ardougne farming patches and Manor Farm access geography",
  "Catherby fishing and farming hub",
  "Farmers' Market and master farmer outfit",
  "Ferocious ring",
  "Fish Flingers (Isla Anglerine D&D)",
  "Fishing Guild",
  "Gnome Restaurant and sous chef's outfit",
  "Kuradal (Ancient Cavern Slayer Master)",
  "Kuradal's Dungeon and ferocious ring hub",
  "Manor Farm (Farming Guild) and reputation rewards",
  "Master farmer outfit",
  "Oo'glog spa pools (As a First Resort)",
  "Player-Owned Farm",
  "Seer's headband",
  "Seers' Village combat achievement rewards",
  "Seers' Village skilling hub",
  "Shark / fury shark fishing outfits",
  "Skillchompa supply hub (wild + PoF ladder)",
  "Skillchompas",
  "Skills necklace (guild teleports)",
  "Sous chef's outfit",
  "Spottier cape (Hunter weight-reduction cape)",
]);

const FREMENNIK_CONTENT_DROP = new Set([
  "Blast Furnace (Keldagrim)",
  "Keldagrim brewery (Laughing Miner Pub)",
  "Keldagrim dwarven hub",
  "Lava Flow Mine skilling unlocks",
  "Livid Farm Lunar spell unlocks",
  "Lunar Isle skilling hub",
  "Lunar spellbook and Lunar utility",
  "Neitiznot yak Crafting and Cooking loop",
  "Penguin Agility Course (Iceberg)",
  "Rellekka Fremennik hub",
]);

const FREMENNIK_UPGRADE_DROP = new Set([
  "Bake Pie (Lunar)",
  "Blast Furnace (Keldagrim)",
  "Cooking dual-brewery network (Keldagrim + Phasmatys)",
  "Citharede Abbey illuminated god books",
  "Dagannoth Kings",
  "Dagannoth Kings uniques",
  "Elite Fremennik combat rewards",
  "Elite skilling outfits core set (ironman fragment paths)",
  "Enchanted lyre",
  "Fremennik sea boots",
  "Fremennik sea boots 1-4",
  "Humidify (Lunar)",
  "Keldagrim brewery (Laughing Miner Pub)",
  "Keldagrim dwarven hub",
  "Keldagrim dwarven traders and multi-step chests",
  "Lava Flow Mine skilling unlocks",
  "Lava geyser Imcando fragment path",
  "Liquid Gold Nymph golden mining suit path",
  "Livid Farm Lunar spell unlocks",
  "Lunar Isle skilling hub",
  "Lunar spellbook",
  "Lunar spellbook unlock",
  "Magic golem outfit",
  "Magic Imbue (Lunar)",
  "Make Leather (Lunar)",
  "Neitiznot yak Crafting and Cooking loop",
  "NPC Contact (Lunar)",
  "Penguin Agility Course (Iceberg)",
  "Plank Make (Lunar)",
  "Player-owned house Aquarium and Prawnbroker",
  "Rellekka Fremennik hub",
  "Repair Rune Pouch (Livid Farm Lunar)",
  "Ring of slaying (craft unlock)",
  "Sparkling wisp colony",
  "String Jewellery (Lunar)",
  "Superglass Make (Lunar)",
  "Telekinetic Grind (Lunar)",
  "Ungael ritual site pressure",
]);

const REMOVED_QUEUE_NAMES = new Set([
  ...ASGARNIA_CONTENT_DROP,
  ...ASGARNIA_UPGRADE_DROP,
  ...KANDARIN_CONTENT_DROP,
  ...KANDARIN_UPGRADE_DROP,
  ...FREMENNIK_CONTENT_DROP,
  ...FREMENNIK_UPGRADE_DROP,
  "Anachronia Agility codex-page progression",
  "Anachronia Agility Course section ladder",
  "Artificer's measure component region map",
  "Barrows chest diary skilling utility",
  "Barrows defenders / shields progression",
  "Blisterwood and Sunspear weapon chain",
  "Burgh de Rott skilling hub",
  "Canifis farming and Slayer Tower hub",
  "Canifis–Mort'ton trapdoor shortcut",
  "Columbarium ring",
  "Cooking dual-brewery network (Keldagrim + Phasmatys)",
  "Darkmeyer Thieving and Ring of Vitur",
  "Dundee's Crocodile Upgrades",
  "Ectophial",
  "Ectofuntus Pool of Slime (slime pit)",
  "Ectofuntus Prayer worship",
  "Essential oils (base-camp spa tier 3)",
  "Fairy ring network (Zanaris hub)",
  "Full slayer helmet and point upgrades (reinforced through corrupted)",
  "Games necklace Burgh de Rott teleport",
  "Gemstone cavern (Shilo underground)",
  "Ghast familiar (Temple Trekking)",
  "Ghostly essence (attuned ectoplasmator supply)",
  "Hard Morytania Barrows rewards",
  "Hardwood Grove teaks and mahoganies",
  "Hunter Lodge (base-camp BGH permanent)",
  "Mazchna / Achtryn (Canifis Slayer Masters)",
  "Modified first age tiara",
  "Mort Myre fungi Bloom harvest",
  "Musa Point fishing dock and Stiles",
  "Nature Grotto altar of nature",
  "Orthen Dig Site full mastery (monolith + recipes)",
  "Port Phasmatys brewery",
  "Port Phasmatys skilling hub",
  "Quick traps (BGH permanent trap speed)",
  "Raksha ability upgrades",
  "Raksha boot upgrades",
  "Raksha, the Shadow Colossus",
  "Ring of imbuing",
  "Ring of Vitur",
  "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
  "Shilo Village underground gem mine",
  "Skeka hypnowand Anachronia piece sources",
  "Sunken Pyramid / player-owned Slayer dungeon",
  "Tai Bwo Wannai Cleanup and trading sticks",
  "Terrasaur maul components",
  "Time altar / 110 Runecrafting",
  "Toolbelt attach: Seedicide",
]);

function applyRegionCorrections(catalog) {
  const anachronia = catalog.regions?.find((region) => region.id === "anachronia");
  const asgarnia = catalog.regions?.find((region) => region.id === "asgarnia");
  const desert = catalog.regions?.find((region) => region.id === "desert");
  const fremennik = catalog.regions?.find((region) => region.id === "fremennik");
  const forinthry = catalog.regions?.find((region) => region.id === "forinthry");
  const karamja = catalog.regions?.find((region) => region.id === "karamja");
  const kandarin = catalog.regions?.find((region) => region.id === "kandarin");
  const misthalin = catalog.regions?.find((region) => region.id === "misthalin");
  const morytania = catalog.regions?.find((region) => region.id === "morytania");
  if (
    !anachronia ||
    !asgarnia ||
    !desert ||
    !fremennik ||
    !forinthry ||
    !karamja ||
    !kandarin ||
    !misthalin ||
    !morytania
  ) {
    throw new Error(
      "Missing a catalog region required by the final correction pass",
    );
  }

  const verifiedAt = catalog.snapshotDate;
  const wikiSource = (title, page) => ({
    source: "runescape-wiki",
    url: `https://runescape.wiki/w/${page}`,
    title,
    verifiedAt,
  });
  const removedUpgradeNames = new Set([
    "Cooking dual-brewery network (Keldagrim + Phasmatys)",
    "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
    "Toolbelt attach: Seedicide",
  ]);
  for (const region of catalog.regions) {
    region.upgrades = region.upgrades.filter((row) => !removedUpgradeNames.has(row.name));
  }
  for (const region of [anachronia, kandarin]) {
    region.upgrades = region.upgrades.filter(
      (row) => row.name !== "Bait and Switch + Always Adze dual monolith skilling paths",
    );
  }

  const agilityCourse = anachronia.content.find((row) => row.name === "Anachronia Agility Course");
  if (agilityCourse) {
    Object.assign(agilityCourse, {
      kind: "Agility course",
      detail:
        "Seven-section island course and transit route. Full laps award codex pages for Double Surge and Double Escape, plus totem pieces and base-camp resources.",
      confidence: "confirmed_wiki",
      source: wikiSource("Anachronia Agility Course", "Anachronia_Agility_Course"),
    });
  }
  const timeAltar = anachronia.content.find((row) => row.name === "Time altar");
  if (timeAltar) {
    Object.assign(timeAltar, {
      kind: "Runecrafting altar",
      detail:
        "North-west Anachronia altar for crafting time runes. Requires 100 Runecrafting and an enchanted key",
      confidence: "confirmed_wiki",
      source: wikiSource("Time altar", "Time_altar"),
    });
  }
  const dinosaurFarmBuyers = anachronia.upgrades.find(
    (row) =>
      row.name === "Anachronia Dinosaur Farm animal buyers" ||
      row.name === "Dinosaur Farm animal buyers",
  );
  if (dinosaurFarmBuyers) {
    Object.assign(dinosaurFarmBuyers, {
      name: "Dinosaur Farm animal buyers",
      category: "Farming",
      detail:
        "Sell raised frogs, salamanders, jadinkos and dinosaurs for beans. Choose one small, medium and large buyer from the advertisement board",
      requirements: [
        "Anachronia Dinosaur Farm access",
        "Raised animals accepted by the selected buyer",
      ],
      source: wikiSource("Dinosaur Farm animal buyers", "Animal_buyer"),
    });
  }
  anachronia.upgrades = anachronia.upgrades.filter(
    (row) =>
      ![
        "Anachronia Agility codex-page progression",
        "Anachronia Agility Course",
        "Anachronia Agility Course section ladder",
        "Artificer's measure component region map",
        "Essential oils (base-camp spa tier 3)",
        "Hunter Lodge (base-camp BGH permanent)",
        "Quick traps (BGH permanent trap speed)",
        "Ring of imbuing",
        "Skeka hypnowand Anachronia piece sources",
        "Terrasaur maul components",
        "Time altar",
        "Time altar / 110 Runecrafting",
      ].includes(row.name),
  );
  const anachroniaHypnowand = anachronia.upgrades.find((row) => row.name === "Skeka's hypnowand");
  if (anachroniaHypnowand) {
    Object.assign(anachroniaHypnowand, {
      category: "Hunter skilling off-hand",
      detail:
        "Requires the aged journal from Daemonheim Dig Site. Pieces drop from Anachronia Big Game Hunter, Rex Matriarchs, vile blooms, and the Agility Course · Region combo (all required): forinthry + anachronia",
      source: wikiSource("Skeka's hypnowand", "Skeka%27s_hypnowand"),
    });
  }
  const terrasaurMaul = anachronia.upgrades.find((row) => row.name === "Terrasaur maul");
  if (terrasaurMaul) {
    Object.assign(terrasaurMaul, {
      category: "Tier 80 two-handed melee weapon",
      detail:
        "Assembled from the tribal fin, superior long bone, and volcanic fragments dropped by tier-3 Anachronia Big Game Hunter dinosaurs. Stronger against ranged-classed enemies",
      requirements: ["80 Strength", "93 Crafting and Smithing", "Tier-3 Big Game Hunter"],
      source: wikiSource("Terrasaur maul", "Terrasaur_maul"),
    });
  }
  const gemstoneArmour =
    anachronia.upgrades.find((row) => row.name === "Gemstone armour") ??
    anachronia.upgrades.find((row) => row.name.startsWith("Gemstone armour ("));
  anachronia.upgrades = anachronia.upgrades.filter(
    (row) => !row.name.startsWith("Gemstone armour"),
  );
  if (gemstoneArmour) {
    Object.assign(gemstoneArmour, {
      name: "Gemstone armour",
      category: "Tier 80 hybrid armour",
      detail:
        "Five-piece hybrid set dropped by Anachronia gemstone dragons. Wearing three or more pieces enables the Enchanted Touch set effect",
      source: wikiSource("Gemstone armour", "Gemstone_armour"),
    });
    anachronia.upgrades.push(gemstoneArmour);
  }
  const orthen = anachronia.content.find((row) => row.name === "Orthen Dig Site");
  if (orthen) {
    Object.assign(orthen, {
      kind: "Archaeology dig site",
      detail:
        "Four excavation sites, an island teleport network, dragonkin potion recipes, Orthen furnace core, Flow State, Death Note, and the full-mastery monolith power upgrade",
      confidence: "confirmed_wiki",
      source: wikiSource("Orthen Dig Site", "Orthen_Dig_Site"),
    });
  }
  anachronia.upgrades = anachronia.upgrades.filter(
    (row) =>
      !["Orthen Dig Site", "Orthen Dig Site full mastery (monolith + recipes)"].includes(row.name),
  );
  const raksha = anachronia.content.find((row) => row.name === "Raksha");
  if (raksha) {
    Object.assign(raksha, {
      kind: "Boss",
      detail: "Solo or duo boss beneath the Orthen ruins",
      confidence: "confirmed_wiki",
      source: wikiSource("Raksha, the Shadow Colossus", "Raksha,_the_Shadow_Colossus"),
    });
  }
  anachronia.upgrades = anachronia.upgrades.filter(
    (row) =>
      !["Raksha ability upgrades", "Raksha boot upgrades", "Raksha, the Shadow Colossus"].includes(
        row.name,
      ),
  );

  desert.content = desert.content.filter(
    (row) =>
      !["Dundee's Crocodile Upgrades", "Sunken Pyramid / player-owned Slayer dungeon"].includes(
        row.name,
      ),
  );
  const whirligigs = {
    name: "Whirligigs",
    kind: "Hunter",
    detail: "Crocodile Hunter activity for whirligig shells and prayer powders.",
    confidence: "confirmed_wiki",
    source: wikiSource("Whirligig", "Whirligig"),
  };
  const currentWhirligigs = desert.content.find((row) => row.name === whirligigs.name);
  if (currentWhirligigs) Object.assign(currentWhirligigs, whirligigs);
  else desert.content.push(whirligigs);

  const sophanemDungeon = desert.content.find(
    (row) => row.name === "Corrupted creatures & soul devourers",
  );
  if (sophanemDungeon) {
    sophanemDungeon.kind = "Slayer dungeon";
    sophanemDungeon.detail = "Sophanem Slayer Dungeon for corrupted creatures and soul devourers.";
    sophanemDungeon.source.title = "Sophanem Slayer Dungeon";
  }
  const sumona = desert.content.find((row) => row.name === "Sumona (Pollnivneach Slayer Master)");
  if (sumona) {
    sumona.name = "Sumona";
    sumona.kind = "Slayer master";
    sumona.detail = "Slayer master in Pollnivneach.";
    sumona.source.title = "Sumona";
  }

  const forinthryMajors = [
    {
      name: "Magic axe hut chest",
      kind: "Thieving",
      detail: "Deep Wilderness chest with muddy keys and rune hatchets.",
      source: wikiSource("Chest (magic axe hut)", "Chest_(magic_axe_hut)"),
    },
    {
      name: "Bandit Camp shops",
      kind: "Shops",
      detail: "Skulled-only Wilderness camp with Bandit Duty Free and Tony's Pizza Bases.",
      source: wikiSource("Bandit Duty Free", "Bandit_Duty_Free"),
    },
    {
      name: "Infernal Puzzle Box",
      kind: "Combat unlock",
      detail:
        "Upgradeable box with Wilderness and Infernus effects, adrenaline retention, bloodwood bonuses, and tier-6 tool-belt storage.",
      source: wikiSource("Infernal Puzzle Box", "Infernal_Puzzle_Box"),
    },
  ];
  for (const major of forinthryMajors) {
    const current = forinthry.content.find((row) => row.name === major.name);
    const next = { ...major, confidence: "confirmed_wiki" };
    if (current) Object.assign(current, next);
    else forinthry.content.push(next);
  }

  karamja.content = karamja.content.filter(
    (row) =>
      ![
        "Musa Point fishing dock and Stiles",
        "Gemstone cavern (Shilo underground)",
        "Shilo Village underground gem mine",
      ].includes(row.name),
  );
  karamja.upgrades = karamja.upgrades.filter(
    (row) =>
      ![
        "Gemstone cavern (Shilo underground)",
        "Hardwood Grove teaks and mahoganies",
        "Shilo Village underground gem mine",
        "Tai Bwo Wannai Cleanup and trading sticks",
      ].includes(row.name),
  );

  const karamjaContent = [
    {
      name: "Shilo Village gem mine and Gemstone cavern",
      kind: "Mining and Slayer",
      detail:
        "Gem rocks in the Shilo Village mine and the underground Gemstone cavern reached with Karamja gloves 3.",
      source: wikiSource("Shilo Village mine", "Shilo_Village_mine"),
    },
    {
      name: "Hardwood Grove",
      kind: "Woodcutting",
      detail: "Nine teak trees and four mahogany trees. Entry costs 100 trading sticks.",
      source: wikiSource("Hardwood grove", "Hardwood_grove"),
    },
    {
      name: "Tai Bwo Wannai Cleanup",
      kind: "Woodcutting",
      detail: "Earn trading sticks for Hardwood Grove and village shops.",
      source: wikiSource("Tai Bwo Wannai Cleanup", "Tai_Bwo_Wannai_Cleanup"),
    },
  ];
  for (const correction of karamjaContent) {
    const current = karamja.content.find(
      (row) =>
        row.name === correction.name ||
        (correction.name === "Hardwood Grove" &&
          row.name === "Hardwood Grove teaks and mahoganies") ||
        (correction.name === "Tai Bwo Wannai Cleanup" &&
          row.name === "Tai Bwo Wannai Cleanup and trading sticks"),
    );
    const next = { ...correction, confidence: "confirmed_wiki" };
    if (current) Object.assign(current, next);
    else karamja.content.push(next);
  }

  const fightKiln = karamja.content.find((row) => row.name === "Fight Kiln");
  if (fightKiln) {
    fightKiln.kind = "Combat";
    fightKiln.detail = "Wave challenge awarding the four TokHaar-Kal capes.";
  }
  const karambwan = karamja.content.find((row) => row.name === "Karambwan vessel fishing");
  if (karambwan) {
    karambwan.kind = "Fishing";
    karambwan.detail = "Catch raw karambwans with a vessel baited with raw karambwanji.";
  }
  const overgrownIdols = karamja.content.find((row) => row.name === "Karamja overgrown idols");
  if (overgrownIdols) {
    overgrownIdols.kind = "Woodcutting";
    overgrownIdols.detail = "Clear the Gara-Dul idols for a temporary Woodcutting buff.";
  }
  const abomination = karamja.content.find((row) => row.name === "Abomination");
  if (abomination) {
    abomination.kind = "Boss";
    abomination.detail = "Brimhaven Dungeon boss that drops the Abomination cape.";
  }

  const darkmeyer = morytania.content.find((row) =>
    ["Darkmeyer", "Darkmeyer Thieving"].includes(row.name),
  );
  const darkmeyerMajor = {
    ...(darkmeyer ?? {}),
    name: "Darkmeyer Thieving",
    kind: "Thieving",
    detail:
      "Darkmeyer meat, magic, and potion stalls plus Vyrewatch tither and vyrelord/vyrelady consumer pickpockets.",
    confidence: "confirmed_wiki",
    source: wikiSource(
      "Heists & Thieving Level increase - New Skilling Update",
      "Update:Heists_%26_Thieving_Level_increase_-_New_Skilling_Update",
    ),
  };
  if (darkmeyer) Object.assign(darkmeyer, darkmeyerMajor);
  else morytania.content.push(darkmeyerMajor);

  for (const region of [misthalin, morytania]) {
    region.upgrades = region.upgrades.filter(
      (row) => row.name !== "Fairy ring network (Zanaris hub)",
    );
  }

  const sunspear =
    morytania.upgrades.find((row) => row.name === "Sunspear") ??
    morytania.upgrades.find((row) => row.name === "Blisterwood and Sunspear weapon chain");
  morytania.content = morytania.content.filter(
    (row) =>
      ![
        "Burgh de Rott skilling hub",
        "Mort Myre fungi Bloom harvest",
        "Nature Grotto altar of nature",
        "Port Phasmatys",
      ].includes(row.name),
  );
  const canifisPatch = morytania.content.find(
    (row) =>
      row.name === "Canifis" ||
      row.name === "Canifis farming and Slayer Tower hub" ||
      row.name === "Canifis mushroom patch",
  );
  const canifisPatchData = {
    name: "Canifis mushroom patch",
    kind: "Farming",
    detail:
      "Mushroom patch west of Canifis. Morytania medium prevents disease; elite doubles the yield.",
    confidence: "confirmed_wiki",
    source: wikiSource("Mushroom patch", "Mushroom_patch"),
  };
  if (canifisPatch) Object.assign(canifisPatch, canifisPatchData);
  else morytania.content.push(canifisPatchData);

  const phasmatysPatches = morytania.content.find(
    (row) => row.name === "Port Phasmatys farming patches",
  );
  const phasmatysPatchData = {
    name: "Port Phasmatys farming patches",
    kind: "Farming",
    detail: "Two allotment patches, one flower patch, and one herb patch west of Port Phasmatys.",
    confidence: "confirmed_wiki",
    source: wikiSource("Farming patch", "Farming_patch"),
  };
  if (phasmatysPatches) Object.assign(phasmatysPatches, phasmatysPatchData);
  else morytania.content.push(phasmatysPatchData);
  const ectofuntus = morytania.content.find((row) => row.name === "Ectofuntus");
  if (ectofuntus) {
    ectofuntus.kind = "Prayer";
    ectofuntus.detail =
      "Four-times Prayer XP from bonemeal or ashes and slime, plus ecto-tokens and the First age outfit shop.";
    ectofuntus.source = wikiSource("Ectofuntus", "Ectofuntus");
  }
  morytania.upgrades = morytania.upgrades.filter(
    (row) =>
      ![
        "Barrows chest diary skilling utility",
        "Barrows defenders / shields progression",
        "Blisterwood and Sunspear weapon chain",
        "Burgh de Rott skilling hub",
        "Canifis farming and Slayer Tower hub",
        "Canifis–Mort'ton trapdoor shortcut",
        "Columbarium ring",
        "Darkmeyer Thieving and Ring of Vitur",
        "Ectophial",
        "Ectofuntus Pool of Slime (slime pit)",
        "Ectofuntus Prayer worship",
        "Full slayer helmet and point upgrades (reinforced through corrupted)",
        "Games necklace Burgh de Rott teleport",
        "Ghast familiar (Temple Trekking)",
        "Ghostly essence (attuned ectoplasmator supply)",
        "Hard Morytania Barrows rewards",
        "Mazchna / Achtryn (Canifis Slayer Masters)",
        "Modified first age tiara",
        "Mort Myre fungi Bloom harvest",
        "Nature Grotto altar of nature",
        "Port Phasmatys brewery",
        "Port Phasmatys farming patches",
        "Port Phasmatys skilling hub",
        "Ring of Vitur",
        "Ring of slaying (craft unlock)",
        "Slayer helmet (craft unlock + base helm)",
      ].includes(row.name),
  );
  if (sunspear) {
    Object.assign(sunspear, {
      name: "Sunspear",
      category: "Hybrid weapon",
      detail: "Switches between melee, ranged, and magic forms and automatically cremates vyres",
      source: wikiSource("Sunspear", "Sunspear"),
    });
    if (!morytania.upgrades.includes(sunspear)) morytania.upgrades.push(sunspear);
  }

  asgarnia.content = asgarnia.content.filter((row) => !ASGARNIA_CONTENT_DROP.has(row.name));

  const roguesDen = asgarnia.content.find(
    (row) => row.name === "Rogues' Den banking, safes, and Thieving hub",
  );
  if (roguesDen) {
    roguesDen.name = "Rogues' Den";
    roguesDen.kind = "Thieving hub";
    roguesDen.detail = "Bank chest, four wall safes, and the entrance to Flash Powder Factory.";
    roguesDen.source.title = "Rogues' Den";
  }

  const flashPowder = asgarnia.content.find(
    (row) => row.name === "Flash Powder Factory minigame and reward shop",
  );
  if (flashPowder) {
    flashPowder.kind = "Minigame";
    flashPowder.detail =
      "Brian points buy the Botanist's outfit and Factory outfit; fallen rubble can drop Rogue equipment.";
  }

  const nex = asgarnia.content.find((row) => row.name === "Nex");
  if (nex) {
    nex.kind = "Boss";
    nex.detail = "God Wars Dungeon boss and source of Torva, Pernix, Virtus, and the Zaryte bow.";
    nex.confidence = "confirmed_wiki";
  }

  const queenBlackDragon = asgarnia.content.find((row) => row.name === "Queen Black Dragon");
  if (queenBlackDragon) {
    queenBlackDragon.kind = "Boss";
    queenBlackDragon.detail = "Drops the Dragon kiteshield.";
  }
  asgarnia.upgrades = asgarnia.upgrades.filter((row) => row.name !== "Queen Black Dragon");

  const majors = [
    {
      name: "The Arc",
      kind: "Eastern Lands",
      detail: "Waiko, uncharted isles, contracts, and the chime shop.",
      confidence: "confirmed_wiki",
      source: wikiSource("The Arc", "The_Arc"),
    },
    {
      name: "Elite Dungeon 1",
      kind: "Elite Dungeon",
      detail: "Temple of Aminishi, with the Sanctum Guardian, Masuta the Ascended, and Seiryu.",
      confidence: "confirmed_wiki",
      source: wikiSource("Temple of Aminishi", "Temple_of_Aminishi"),
    },
    {
      name: "Starbloom armour",
      kind: "Crafting armour",
      detail: "Tier 85 armour crafted at the Crafting Guild and upgraded to tier 90.",
      confidence: "confirmed_wiki",
      source: wikiSource("Starbloom equipment", "Starbloom_equipment"),
    },
    {
      name: "Praesul codex",
      kind: "Prayer unlock",
      detail:
        "One codex unlocks Malevolence, Desolation, Affliction, or Ruination. Each curse requires its own codex.",
      confidence: "confirmed_wiki",
      source: wikiSource("Praesul codex", "Praesul_codex"),
    },
    {
      name: "Scrimshaws",
      kind: "Ports pocket items",
      detail:
        "Combat and skilling pocket items made from ancient bones at Player-owned Ports, plus the sacrifice line.",
      confidence: "confirmed_wiki",
      source: wikiSource("Scrimshaw", "Scrimshaw"),
    },
    {
      name: "Ports armour",
      kind: "Level 85 tank armour",
      detail: "Tetsu melee armour, Death Lotus ranged armour, and Seasinger's magic robes.",
      confidence: "confirmed_wiki",
      source: wikiSource("Player-owned port rewards", "Player-owned_port/Rewards"),
    },
  ];
  for (const major of majors) {
    const current = asgarnia.content.find((row) => row.name === major.name);
    if (current) Object.assign(current, major);
    else asgarnia.content.push(major);
  }

  const hydrixMoves = [
    {
      prefix: "Amulet of souls",
      name: "Amulet of souls",
      category: "Combat necklace",
      detail:
        "Improves Soul Split healing and protection prayers. A fully charged amulet is required for Essence of Finality",
    },
    {
      prefix: "Deathtouch bracelet",
      name: "Deathtouch bracelet",
      category: "Hybrid power gloves",
      detail: "Hydrix gloves with a chance to reflect part of incoming damage",
    },
    {
      prefix: "Reaper necklace",
      name: "Reaper necklace",
      category: "Combat necklace",
      detail:
        "Successful hits build hit chance. A fully charged necklace is required for Essence of Finality",
    },
    {
      prefix: "Ring of death",
      name: "Ring of death",
      category: "Hybrid combat ring",
      detail:
        "Restores adrenaline after some kills and can revive the wearer with a damaging bleed",
    },
  ];
  const asgarniaHydrix = asgarnia.upgrades.filter((row) =>
    hydrixMoves.some((move) => row.name.startsWith(move.prefix)),
  );
  const combatBracelet = asgarnia.upgrades.find((row) => row.name === "Combat bracelet");
  asgarnia.upgrades = asgarnia.upgrades.filter(
    (row) =>
      row !== combatBracelet &&
      !asgarniaHydrix.includes(row) &&
      !ASGARNIA_UPGRADE_DROP.has(row.name) &&
      !/scrimshaw/i.test(row.name) &&
      !/^(?:Seasinger|Tetsu (?:armour|equipment)|Death Lotus (?:armour|equipment))/i.test(
        row.name,
      ) &&
      !/Invention Guild machine infrastructure/i.test(row.category),
  );

  const inventionGuild = asgarnia.upgrades.find((row) => row.name === "Invention Guild");
  if (inventionGuild) {
    inventionGuild.category = "Invention workshop and machines";
    inventionGuild.detail =
      "Inventor's workbenches, technology blueprints, generators, and the offline machine room";
  }

  const miningGuild = asgarnia.upgrades.find((row) => row.name === "Mining Guild");
  if (miningGuild) {
    miningGuild.category = "Mining and Smithing hub";
    miningGuild.detail =
      "Ore bank, furnaces, resource dungeon, and direct access to the Artisans' Workshop";
  }

  const blacksmith = asgarnia.upgrades.find((row) => row.name === "Blacksmith's outfit");
  if (blacksmith) {
    blacksmith.detail =
      "Up to 6% Smithing XP. The modified helmet adds Artisans' Workshop teleports and a chance to smelt an extra ore";
  }

  const botanist = asgarnia.upgrades.find((row) => row.name === "Botanist's outfit");
  if (botanist) {
    botanist.detail =
      "Up to 6% Herblore XP. The modified mask can duplicate potions and teleport to the Catherby herb patch";
  }

  const factory = asgarnia.upgrades.find((row) => row.name.startsWith("Factory outfit"));
  if (factory) {
    factory.detail =
      "Three pieces can produce four-dose potions. The full set also grants herb-cleaning XP when making unfinished potions";
  }

  const angelOfDeath = asgarnia.upgrades.find((row) => row.name === "Nex: Angel of Death");
  if (angelOfDeath) {
    angelOfDeath.category = "Boss rewards";
    angelOfDeath.detail = "Wand of the praesul, Imperium core, and the Praesul codex";
  }

  const vorago = asgarnia.content.find((row) => row.name === "Vorago");
  if (vorago) {
    vorago.kind = "Boss";
    vorago.detail = "Group boss that drops seismic weapons and tectonic energy.";
  }

  const royalCrossbow = asgarnia.upgrades.find((row) => row.name === "Royal crossbow");
  if (royalCrossbow) {
    royalCrossbow.category = "Tier 80 two-handed crossbow";
    royalCrossbow.detail =
      "Completed from the four royal components dropped by the Queen Black Dragon";
  }

  const lumberjackShard = asgarnia.upgrades.find((row) => row.name === "Shard of the Lumberjack");
  if (lumberjackShard) {
    lumberjackShard.category = "Hatchet upgrade component";
    lumberjackShard.detail =
      "Required with a crystal hatchet and Imcando hatchet to make the Hatchet of ember and glade";
  }

  const livingRockCaverns = asgarnia.upgrades.find((row) => row.name === "Living Rock Caverns");
  if (livingRockCaverns) {
    livingRockCaverns.category = "Mining and Fishing cavern";
    livingRockCaverns.detail =
      "Rocktail and cavefish fishing, concentrated coal and gold deposits, and living rock creatures";
  }

  const customFit = asgarnia.upgrades.find((row) =>
    row.name.startsWith("Custom-fit trimmed masterwork"),
  );
  if (customFit) {
    customFit.name = "Custom-fit trimmed masterwork";
    customFit.category = "Tier 92 melee armour upgrade";
    customFit.detail =
      "Elof custom-fits trimmed masterwork at the Artisans' Workshop. The full self-sufficient chain requires Asgarnia and Morytania · Region combo (all required): asgarnia + morytania";
    customFit.regionHints = ["asgarnia", "morytania"];
    customFit.requiredRegions = ["asgarnia", "morytania"];
    customFit.regionRequirementType = "all_required";
    customFit.comboLabel = "Region combo (all required): asgarnia + morytania";
    customFit.isRegionCombo = true;
  }

  const misthalinEof = misthalin.upgrades.find((row) =>
    row.name.startsWith("Essence of Finality amulet"),
  );
  if (misthalinEof) {
    misthalinEof.category = "Combat necklace";
    misthalinEof.detail =
      "Combines the amulet of souls and reaper necklace, and stores one weapon special attack";
  }

  for (const move of hydrixMoves) {
    const source = asgarniaHydrix.find((row) => row.name.startsWith(move.prefix));
    const current = misthalin.upgrades.find((row) => row.name.startsWith(move.prefix));
    if (!source && !current) continue;
    const row = {
      ...(source ?? current),
      ...move,
      regionId: "misthalin",
      regionHints: ["misthalin"],
      requiredRegions: ["misthalin"],
      regionRequirementType: "single",
      comboLabel: "",
      isRegionCombo: false,
    };
    delete row.prefix;
    if (current) Object.assign(current, row);
    else misthalin.upgrades.push(row);
  }

  kandarin.content = kandarin.content.filter((row) => !KANDARIN_CONTENT_DROP.has(row.name));

  const kuradal = kandarin.content.find(
    (row) => row.name === "Kuradal" || row.name.startsWith("Kuradal ("),
  );
  if (kuradal) {
    kuradal.name = "Kuradal";
    kuradal.kind = "Slayer master";
    kuradal.detail = "Slayer master, Slayer points, Kuradal's Dungeon, and ferocious ring access.";
    kuradal.source.title = "Kuradal";
  }
  const legiones = kandarin.content.find((row) => row.name === "Legiones");
  if (legiones) {
    legiones.kind = "Bosses";
    legiones.detail =
      "Six Monastery of Ascension bosses whose signets assemble the Ascension crossbows.";
  }
  const muspah = kandarin.content.find((row) => row.name === "Muspah");
  if (muspah) {
    muspah.kind = "Freneskae combat";
    muspah.detail = "Freneskae creatures that drop muspah spines, dragon wards, and dragon knives.";
  }

  const seersVillage = kandarin.content.find((row) => row.name === "Seers' Village skilling hub");
  if (seersVillage) {
    seersVillage.name = "Seers' Village";
    seersVillage.kind = "Skilling town";
    seersVillage.detail =
      "Flax and a spinning wheel, maple and yew trees, coal trucks, Elemental Workshop, and Area Task rewards";
    seersVillage.source.title = "Seers' Village";
  }

  const manorFarm = {
    name: "Manor Farm",
    kind: "Farming",
    detail: "Animal pens, buyers, beans, Farmers' Market rewards, reputation, and animal perks.",
    confidence: "confirmed_wiki",
    source: wikiSource("Player-owned farm", "Player-owned_farm"),
  };
  const currentManorFarm = kandarin.content.find((row) => row.name === manorFarm.name);
  if (currentManorFarm) Object.assign(currentManorFarm, manorFarm);
  else kandarin.content.push(manorFarm);

  const existingSousChef = kandarin.upgrades.find(
    (row) =>
      row.name === "Sous chef's outfit" || row.name === "Gnome Restaurant and sous chef's outfit",
  );
  kandarin.upgrades = kandarin.upgrades.filter((row) => !KANDARIN_UPGRADE_DROP.has(row.name));

  const divinersOutfit = kandarin.upgrades.find((row) => row.name === "Diviner's outfit");
  const divinersRow = {
    ...(divinersOutfit ?? {}),
    name: "Diviner's outfit",
    category: "Divination XP outfit",
    detail:
      "Up to 6% Divination XP. The modified headwear adds colony teleports and a chance to save half the energy used when weaving or transmuting",
    requirements: [],
    confidence: "confirmed_wiki",
    source: wikiSource("Diviner's outfit", "Diviner%27s_outfit"),
    regionId: "kandarin",
    regionHints: ["kandarin"],
    requiredRegions: [],
    regionRequirementType: "single",
    comboLabel: "",
    isRegionCombo: false,
  };
  if (divinersOutfit) Object.assign(divinersOutfit, divinersRow);
  else kandarin.upgrades.push(divinersRow);

  kandarin.upgrades.push({
    ...(existingSousChef ?? {}),
    name: "Gnome Restaurant and sous chef's outfit",
    category: "Cooking XP outfit",
    detail:
      "Earned from hard Gnome Restaurant deliveries. Up to 6% Cooking XP; the modified toque adds three daily Cooking Guild teleports and a 5% chance to bank duplicate food",
    requirements: ["Hard Gnome Restaurant deliveries"],
    confidence: "confirmed_wiki",
    source: wikiSource("Sous chef's outfit", "Sous_chef%27s_outfit"),
    regionId: "kandarin",
    regionHints: ["kandarin"],
    requiredRegions: [],
    regionRequirementType: "single",
    comboLabel: "",
    isRegionCombo: false,
  });

  const legendsRecharge = kandarin.upgrades.find(
    (row) => row.name === "Legends' Guild totem jewellery recharge",
  );
  const legendsRow = {
    ...(legendsRecharge ?? combatBracelet ?? {}),
    name: "Legends' Guild totem jewellery recharge",
    category: "Jewellery recharge",
    detail: "The Legends' Guild totem recharges skills necklaces and combat bracelets",
    requirements: ["Partial completion of Legends' Quest"],
    confidence: "confirmed_wiki",
    source: wikiSource("Legends' Guild", "Legends%27_Guild"),
    regionId: "kandarin",
    regionHints: ["kandarin"],
    requiredRegions: ["kandarin"],
    regionRequirementType: "single",
    comboLabel: "",
    isRegionCombo: false,
  };
  if (legendsRecharge) Object.assign(legendsRecharge, legendsRow);
  else kandarin.upgrades.push(legendsRow);

  fremennik.content = fremennik.content.filter((row) => !FREMENNIK_CONTENT_DROP.has(row.name));

  const fremennikMajors = [
    {
      name: "Lunar Isle",
      kind: "Magic hub",
      detail: "Lunar spellbook and astral altar.",
      confidence: "confirmed_wiki",
      source: wikiSource("Lunar Isle", "Lunar_Isle"),
    },
    {
      name: "Livid Farm",
      kind: "Magic rewards",
      detail: "Produce points unlock the Livid Farm Lunar spells and wishes.",
      confidence: "confirmed_wiki",
      source: wikiSource("Rewards (Livid Farm)", "Rewards_(Livid_Farm)"),
    },
    {
      name: "Penguin Agility Course",
      kind: "Agility",
      detail: "Agility course on the Iceberg.",
      confidence: "confirmed_wiki",
      source: wikiSource("Penguin Agility Course", "Penguin_Agility_Course"),
    },
    {
      name: "Blast Furnace",
      kind: "Smithing",
      detail: "Coal-free bars and a nearby bank chest.",
      confidence: "confirmed_wiki",
      source: wikiSource("Blast Furnace", "Blast_Furnace"),
    },
    {
      name: "Sparkling wisp colony",
      kind: "Divination",
      detail: "Level 40 Divination colony south-east of Rellekka.",
      confidence: "confirmed_wiki",
      source: wikiSource("Sparkling wisp", "Sparkling_wisp"),
    },
    {
      name: "Dagannoth Kings",
      kind: "Boss",
      detail: "Waterbirth Island bosses that drop combat rings and the dragon hatchet.",
      confidence: "confirmed_wiki",
      source: wikiSource("Dagannoth Kings", "Dagannoth_Kings"),
    },
    {
      name: "Keldagrim",
      kind: "Thieving",
      detail: "Dwarven traders.",
      confidence: "confirmed_wiki",
      source: wikiSource("Keldagrim", "Keldagrim"),
    },
    {
      name: "Lava Flow Mine",
      kind: "Mining",
      detail: "Golden mining suit and Imcando pickaxe fragments.",
      confidence: "confirmed_wiki",
      source: wikiSource("Lava Flow Mine", "Lava_Flow_Mine"),
    },
    {
      name: "Neitiznot yaks",
      kind: "Crafting and Cooking",
      detail: "Yak-hide armour materials, yak hair, and raw yak meat.",
      confidence: "confirmed_wiki",
      source: wikiSource("Neitiznot", "Neitiznot"),
    },
  ];
  for (const major of fremennikMajors) {
    const current = fremennik.content.find((row) => row.name === major.name);
    if (current) Object.assign(current, major);
    else fremennik.content.push(major);
  }

  const seaBoots = fremennik.upgrades.find((row) =>
    ["Fremennik sea boots", "Fremennik sea boots 1-4"].includes(row.name),
  );
  fremennik.upgrades = fremennik.upgrades.filter((row) => !FREMENNIK_UPGRADE_DROP.has(row.name));

  fremennik.upgrades.push({
    ...(seaBoots ?? {}),
    name: "Fremennik sea boots",
    category: "Achievement rewards",
    detail:
      "Lyre teleports, Miscellania utility, noted Dagannoth bones, and bonus damage against the Dagannoth Kings",
    requirements: ["Fremennik achievements"],
    confidence: "confirmed_wiki",
    source: wikiSource("Fremennik sea boots", "Fremennik_sea_boots"),
    regionId: "fremennik",
    regionHints: ["fremennik"],
    requiredRegions: ["fremennik"],
    regionRequirementType: "single",
    comboLabel: "",
    isRegionCombo: false,
  });

  const goldenMiningSuit = fremennik.upgrades.find((row) => row.name === "Golden mining suit");
  if (goldenMiningSuit) {
    goldenMiningSuit.category = "Mining XP outfit";
    goldenMiningSuit.detail =
      "The five-piece outfit grants 6% Mining XP and is awarded by the Liquid Gold Nymph";
  }

  if (!fremennik.upgrades.some((row) => row.name === "Hand cannon")) {
    fremennik.upgrades.push({
      name: "Hand cannon",
      category: "Tier 75 two-handed ranged weapon",
      detail: "Dropped by hand cannoneers after Forgiveness of a Chaos Dwarf",
      requirements: ["Forgiveness of a Chaos Dwarf"],
      confidence: "confirmed_wiki",
      source: wikiSource("Hand cannon", "Hand_cannon"),
      regionId: "fremennik",
      regionHints: ["fremennik"],
      requiredRegions: ["fremennik"],
      regionRequirementType: "single",
      comboLabel: "",
      isRegionCombo: false,
    });
  }
}

const skPath = "data/research/regional-skilling-unlocks.json";
const sk = read(skPath);
const removedRegionalIds = new Set([
  "cross-region:artificers-measure-components",
  "cross-region:cooking-brewery-network",
  "cross-region:herblore-efficiency-stack",
  "karamja:musa-point-fishing-stiles",
  "karamja:shilo-gem-mine",
  "morytania:canifis-farming-and-slayer-hub",
  "morytania:mazchna-slayer-master",
  "multi-region:toolbelt-seedicide-attach",
]);
for (const row of sk.records || []) {
  if (REMOVED_QUEUE_NAMES.has(row.name) && row.id) removedRegionalIds.add(row.id);
}
sk.records = (sk.records || []).filter(
  (row) => !removedRegionalIds.has(row.id) && !REMOVED_QUEUE_NAMES.has(row.name),
);
const gemstoneRegional = sk.records.find((row) => row.id === "karamja:gemstone-cavern");
if (gemstoneRegional) {
  gemstoneRegional.name = "Shilo Village gem mine and Gemstone cavern";
  gemstoneRegional.category = "Mining and Slayer";
  gemstoneRegional.detail =
    "Gem rocks in the Shilo Village mine and the underground Gemstone cavern reached with Karamja gloves 3";
  gemstoneRegional.source = {
    source: "runescape-wiki",
    url: "https://runescape.wiki/w/Shilo_Village_mine",
    title: "Shilo Village gem mine and Gemstone cavern",
    verifiedAt: sk.snapshotDate,
  };
}
const canifisRegional = {
  id: "morytania:canifis-mushroom-patch",
  name: "Canifis mushroom patch",
  recordType: "activity",
  regionHints: ["morytania"],
  requiredRegions: [],
  regionRequirementType: "single",
  comboLabel: "",
  isRegionCombo: false,
  category: "Farming",
  detail:
    "Mushroom patch west of Canifis. Morytania medium prevents disease; elite doubles the yield",
  requirements: [],
  confidence: "confirmed_wiki",
  source: {
    source: "runescape-wiki",
    url: "https://runescape.wiki/w/Mushroom_patch",
    title: "Canifis mushroom patch",
    verifiedAt: sk.snapshotDate,
  },
  sourceFile: "scripts/humanize-region-detail.mjs",
};
const currentCanifisRegional = sk.records.find((row) => row.id === canifisRegional.id);
if (currentCanifisRegional) Object.assign(currentCanifisRegional, canifisRegional);
else sk.records.push(canifisRegional);
const phasmatysRegional = sk.records.find((row) => row.id === "morytania:phasmatys-farming-patches");
if (phasmatysRegional) {
  phasmatysRegional.detail =
    "Two allotment patches, one flower patch, and one herb patch west of Port Phasmatys";
  phasmatysRegional.source = {
    source: "runescape-wiki",
    url: "https://runescape.wiki/w/Farming_patch",
    title: "Port Phasmatys farming patches",
    verifiedAt: sk.snapshotDate,
  };
}
const sumonaRegional = sk.records.find((row) => row.id === "desert:sumona-slayer-master");
if (sumonaRegional) sumonaRegional.detail = "Slayer master in Pollnivneach";
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

const combatPath = "data/research/regional-combat-unlocks.json";
const combat = read(combatPath);
for (const row of combat.records || []) {
  if (REMOVED_QUEUE_NAMES.has(row.name) && row.id) removedRegionalIds.add(row.id);
}
combat.records = (combat.records || []).filter(
  (row) => !removedRegionalIds.has(row.id) && !REMOVED_QUEUE_NAMES.has(row.name),
);
write(combatPath, combat);

const catPath = "data/research/catalog.json";
const cat = read(catPath);
let catChanged = 0;
applyRegionCorrections(cat);
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
dedupeRegionUpgrades(cat);
write(catPath, cat);

const progPath = "data/reference/progression-unlocks.json";
const prog = read(progPath);
for (const rows of Object.values(prog)) {
  if (!Array.isArray(rows)) continue;
  for (const row of rows) {
    if (REMOVED_QUEUE_NAMES.has(row.name) && row.id) removedRegionalIds.add(row.id);
  }
}
for (const [section, rows] of Object.entries(prog)) {
  if (Array.isArray(rows)) {
    prog[section] = rows.filter(
      (row) => !removedRegionalIds.has(row.id) && !REMOVED_QUEUE_NAMES.has(row.name),
    );
  }
}
const gemstoneProgression = prog.activity_unlocks.find((row) => row.id === "karamja:gemstone-cavern");
if (gemstoneProgression) {
  gemstoneProgression.name = "Shilo Village gem mine and Gemstone cavern";
  gemstoneProgression.category = "Mining and Slayer";
  gemstoneProgression.notes =
    "The Shilo Village mine supplies gem rocks; Karamja gloves 3 open the underground Gemstone cavern and teleport to the mine";
  gemstoneProgression.source_urls = [
    "https://runescape.wiki/w/Shilo_Village_mine",
    "https://runescape.wiki/w/Gemstone_cavern",
  ];
}
const canifisProgression = {
  id: "morytania:canifis-mushroom-patch",
  name: "Canifis mushroom patch",
  category: "Farming",
  region_hint: "morytania",
  unlocks: ["Mushroom patch west of Canifis"],
  notes: "The Morytania medium achievements prevent disease; elite achievements double yield",
  source_urls: ["https://runescape.wiki/w/Mushroom_patch"],
  confidence: "confirmed_wiki",
};
const currentCanifisProgression = prog.activity_unlocks.find(
  (row) => row.id === canifisProgression.id,
);
if (currentCanifisProgression) Object.assign(currentCanifisProgression, canifisProgression);
else prog.activity_unlocks.push(canifisProgression);
const sumonaProgression = prog.activity_unlocks.find((row) => row.id === "desert:sumona-slayer-master");
if (sumonaProgression) sumonaProgression.notes = "Slayer master in Pollnivneach";
for (const rows of Object.values(prog)) {
  if (!Array.isArray(rows)) continue;
  for (const row of rows) {
    if (Array.isArray(row.links_existing_ids)) {
      row.links_existing_ids = row.links_existing_ids.filter((id) => !removedRegionalIds.has(id));
    }
    if (Array.isArray(row.effects)) {
      row.effects = row.effects.map((effect) =>
        effect === "Works with toolbelt seedicide after multi-region:toolbelt-seedicide-attach"
          ? "Works with toolbelt seedicide"
          : effect,
      );
    }
  }
}
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
const eqUser = eqAfter.records.filter((r) =>
  /user ruling/i.test(r.unlock?.requirement || ""),
).length;

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
