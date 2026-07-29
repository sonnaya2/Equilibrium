/**
 * Treats Invention progression as global. Asgarnia remains only on geographic
 * place rows such as the Guild machine room.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const write = (p, v) => writeFileSync(join(ROOT, p), `${JSON.stringify(v, null, 2)}\n`);

const log = [];
const GLOBAL_NOTE =
  "Invention skill unlock and workbench manufacture are global (not Asgarnia-locked). Guild machine-room scenery stays Asgarnia place geography only.";

/** Place-only Asgarnia hosts (Guild machines / Arc). Not skill gates. */
const KEEP_ASGARNIA_HARD = new Set([
  "asgarnia:invention-generators",
  "cross-region:invention-machines-guild",
  "asgarnia:invention-guild",
  "asgarnia:invention-guild-machines-named",
  "asgarnia:alchemiser",
  "asgarnia:auto-disassembler",
  "asgarnia:partial-potion-producer",
  "asgarnia:plank-maker-machine",
  "asgarnia:automatic-hide-tanner",
  "asgarnia:crystal-tool-siphon-blueprint",
  "asgarnia:arc-journal-teletabs",
  "asgarnia:waiko-grill",
  "asgarnia:arc-skilling-access",
]);

/** Slug (no prefix) → hard required regions. Empty = global manufacture. */
const FORCE_REQUIRED_BY_SLUG = new Map([
  ["extreme-invention-boost-path", ["kandarin"]],
  ["extreme-invention-supply", ["kandarin"]],
  ["elder-divination-outfit-path", []],
  ["abyssal-link-relic", ["kandarin"]],
  [
    "grace-of-the-elves-porter-chain",
    ["tirannwn", "desert", "morytania", "kandarin", "misthalin"],
  ],
  ["hatchet-of-bloom-and-blight", ["tirannwn", "misthalin", "fremennik"]],
  ["hatchet-of-ember-and-glade", ["tirannwn", "misthalin", "fremennik"]],
  ["pickaxe-of-life-and-death", ["fremennik", "tirannwn"]],
  ["dark-facet-of-passage", ["forinthry"]],
  ["alchemical-onyx", []],
  ["alchemical-hydrix", []],
  ["auto-sanctifier", []],
  ["divine-charge-crafting", []],
  ["empty-divine-charge", []],
  ["fishing-rod-o-matic", []],
  ["herb-protector", []],
  ["invention-skilling-tools", []],
  ["invention-skilling-perk-ladder", []],
  ["passage-of-the-abyss", []],
  ["potion-reservoir", []],
  ["urn-enhancer", []],
  ["skilling-accumulators-package", []],
  // Howl / Stormguard is Kandarin dig geography, not Asgarnia skill home
  ["ancient-invention-blueprints", ["kandarin"]],
  ["ancient-gizmo-shells", []],
  ["ancient-components-discovery", []],
  ["ancient-tools-enhanced", []],
]);

/** @deprecated full-id map kept as alias for FORCE lookups during transition */
const FORCE_REQUIRED = new Map(
  [...FORCE_REQUIRED_BY_SLUG.entries()].flatMap(([slug, req]) => [
    [`asgarnia:${slug}`, req],
    [`invention:${slug}`, req],
    [`cross-region:${slug}`, req],
    [`kandarin:${slug}`, req],
    [`forinthry:${slug}`, req],
  ]),
);

const idRenames = new Map(); // oldId → newId

function slugOf(id) {
  const s = String(id || "");
  const i = s.indexOf(":");
  return i >= 0 ? s.slice(i + 1) : s;
}

function forceReqFor(id) {
  const s = String(id || "");
  if (FORCE_REQUIRED.has(s)) return FORCE_REQUIRED.get(s);
  const slug = slugOf(s);
  if (FORCE_REQUIRED_BY_SLUG.has(slug)) return FORCE_REQUIRED_BY_SLUG.get(slug);
  return null;
}

function keepAsgarniaPlace(id) {
  const s = String(id || "");
  if (KEEP_ASGARNIA_HARD.has(s)) return true;
  const slug = slugOf(s);
  return [...KEEP_ASGARNIA_HARD].some((k) => slugOf(k) === slug);
}

const INVENTION_ID_RE =
  /invention|gizmo|augment|siphon|divine[- ]?charge|junk[- ]?(refin|chance)|rod-o-matic|hammer-tron|pyro-matic|sanctifier|spring[- ]?cleaner|urn[- ]?enhancer|xp[- ]?capacitor|alchemical[- ]?(onyx|hydrix)|herb[- ]?protector|potion[- ]?reservoir|passage[- ]?of[- ]?the[- ]?abyss|mechanised|extreme[- ]?invention|ancient[- ]?(component|tools|gizmo|invention)|equipment[- ]?(dissolver|separator|siphon)|scavenging|brooch|skilling[- ]?accumulator|charge[- ]?pack|auto[- ]?sanctifier|empty[- ]?divine|abyssal[- ]?link|elder[- ]?divination|grace[- ]?of[- ]?the[- ]?elves|dark[- ]?facet[- ]?of[- ]?passage|hatchet[- ]?of[- ]?(bloom|ember)|pickaxe[- ]?of[- ]?life/i;

const INVENTION_NAME_RE =
  /invention|gizmo|augmentor|augmentable|siphon|divine charge|junk refin|junk chance|rod-o-matic|hammer-tron|pyro-matic|auto-sanctifier|spring cleaner|urn enhancer|xp capacitor|alchemical (onyx|hydrix)|herb protector|potion reservoir|passage of the abyss|mechanised siphon|extreme invention|ancient component|ancient (tools|gizmo|invention)|equipment (dissolver|separator|siphon)|skilling accumulator|elder divination outfit|grace of the elves|abyssal link|dark facet of passage|hatchet of (bloom|ember)|pickaxe of life and death|brooch of the gods craft|charge pack/i;

function isInventionManufactureRow(row) {
  const id = String(row.id || "");
  const name = String(row.name || "");
  const cat = String(row.category || "");
  if (keepAsgarniaPlace(id)) return false;
  // Already rehomed invent: prefix
  if (id.startsWith("invention:")) return true;
  if (INVENTION_ID_RE.test(id) || INVENTION_NAME_RE.test(name) || INVENTION_NAME_RE.test(cat)) {
    return true;
  }
  // Detail-only invent framing with asgarnia hard gate
  const detail = String(row.detail || row.league_treatment || "");
  if (
    /Hard Asgarnia for Invention|Invention unlocked via Asgarnia|Asgarnia hard-owns Invention|Invention skill home|Invention unlock geography|Invention Guild manufacture framing|Invention Guild discovery/i.test(
      detail,
    )
  ) {
    // Exclude pure Arc / diary / non-invent host rows that only mention invent in passing
    if (/arc journal|waiko grill|scrimshaw|essence of finality/i.test(name)) return false;
    return /invention|gizmo|augment|siphon|workbench|blueprint/i.test(name + cat + detail);
  }
  return false;
}

function scrubText(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  // Generic Hard Asgarnia fragments that survived first pass
  out = out.replace(/Hard Asgarnia for discovery hub taxonomy\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for blueprint discovery geography\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for blueprint discovery\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for self-sufficient blueprint unlock\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for the three research discoveries\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for manufacture\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for discovery\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for craft\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia\./gi, `${GLOBAL_NOTE} `);
  out = out.replace(
    /Asgarnia manufacture hub; ancient components from multi-region restored artefacts\.?/gi,
    "Ancient gizmo shells craft at Invention workbench (global); ancient components from multi-region restored artefacts. ",
  );
  out = out.replace(
    /Asgarnia hard-owns Stormguard \/ Howl blueprint geography under current Equilibrium mapping and Invention manufacture home\.?/gi,
    "Stormguard / Howl blueprint geography is Kandarin; Invention manufacture is global. ",
  );
  out = out.replace(
    /Asgarnia hard-owns blueprint discovery geography \(Invention Guild \/ inventor's workbench hub taxonomy\) and the machine-charge consumer side\.?/gi,
    "Divine charge craft is global; Guild generators that spend machine charge sit in Asgarnia. ",
  );
  out = out.replace(
    /Asgarnia owns Invention workbench discovery taxonomy\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Asgarnia hard-owns workbench discovery taxonomy[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /natural hub is Invention Guild \(Asgarnia\)\.?/gi,
    "craft is global at any inventor's workbench (Guild building remains Asgarnia place). ",
  );
  out = out.replace(
    /Stormguard Citadel is Armadylean dig-site geography under Asgarnia in current Equilibrium mapping\.?/gi,
    "Stormguard Citadel is Armadylean dig-site geography under Kandarin in current Equilibrium mapping. ",
  );
  out = out.replace(
    /Region combo \(all required\):\s*asgarnia\s*\+\s*/gi,
    "Region combo (all required): ",
  );
  out = out.replace(
    /Region chain \(support pressure\):\s*asgarnia\s*\/\s*/gi,
    "Region chain (support pressure): ",
  );
  out = out.replace(/Region combo \(all required\):\s*·/gi, "·");
  out = out.replace(/Region combo \(all required\):\s*$/gi, "");
  out = out.replace(
    /Invention unlocked via Asgarnia Invention Guild tutorial path/gi,
    "Invention unlocked (80 Crafting / Divination / Smithing tutorial path — not region-gated)",
  );
  out = out.replace(
    /Invention unlocked \(Asgarnia Invention Guild tutorial path\)/gi,
    "Invention unlocked (80 Crafting / Divination / Smithing tutorial path — not region-gated)",
  );
  out = out.replace(
    /Hard Asgarnia for Invention unlock geography[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(/Hard Asgarnia for Invention skill home[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention Guild manufacture framing[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention Guild discovery path[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention Guild\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention manufacture[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention tech trees? and manufacture[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention tech tree[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention craft[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention device path[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Invention\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(/Hard Asgarnia for Ancient Invention tools[^.]*\.?/gi, `${GLOBAL_NOTE} `);
  out = out.replace(
    /Hard Asgarnia for Invention Guild \+ Ancient Invention manufacture framing[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Asgarnia hard-owns Invention[^.]*\.?/gi,
    "Invention manufacture is global; Asgarnia only hosts Guild place geography when relevant. ",
  );
  out = out.replace(
    /Asgarnia hard-owns Invention Guild[^.]*\.?/gi,
    "Invention manufacture is global; Guild machine room stays Asgarnia place geography only. ",
  );
  out = out.replace(
    /Hard Asgarnia for Invention Guild discovery\/manufacture framing and charge-pack infrastructure\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Hard Asgarnia for Invention Guild \+ Ancient Invention manufacture framing[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Hard Asgarnia for Invention manufacture and Artisans' Workshop host geography\.?/gi,
    "Invention manufacture is global; Artisans' Workshop host geography remains Asgarnia when relevant. ",
  );
  out = out.replace(
    /Hard Asgarnia for Invention manufacture and All Fired Up ring\/gloves adjacency\.?/gi,
    "Invention manufacture is global; All Fired Up reward geography may still pressure Asgarnia. ",
  );
  out = out.replace(
    /Hard Asgarnia for Invention Guild discovery of the three blueprints \+ augmentor manufacture\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Hard Asgarnia for Invention Guild manufacture framing[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Hard Asgarnia for Invention manufacture and alchemical onyx craft home\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Alchemical hydrix manufacture \(Asgarnia Invention Guild\) after blueprint discovery/gi,
    "Alchemical hydrix manufacture after blueprint discovery (Invention workbench global)",
  );
  out = out.replace(
    /Asgarnia Invention Guild for discovery\/perks use-case of the boost/gi,
    "Invention boost usable at any workbench (not Asgarnia-gated)",
  );
  out = out.replace(
    /Ancient Invention manufacture still pressures Asgarnia Invention Guild workbench optionally\.?/gi,
    "Ancient Invention manufacture is global craft; Stormguard dig pressure may still be Kandarin. ",
  );
  out = out.replace(
    /Hard Asgarnia \+ Anachronia for full self-supply\.?/gi,
    "Hard Kandarin for Manor Farm mycelial webbing (Invention craft is global). ",
  );
  out = out.replace(
    /Asgarnia \+ Anachronia hard for complete self-sufficient extreme invent loops\.?/gi,
    "Kandarin hard for Manor Farm webbing self-supply; Invention craft is global. ",
  );
  out = out.replace(
    /Asgarnia hard:\s*Invention Guild discovery \+ inventor's workbench craft path for elite fragment outfits\.?/gi,
    "Invention elite craft is global (not Asgarnia-locked). ",
  );
  out = out.replace(
    /Asgarnia hard:\s*Invention[^.]*\.?/gi,
    "Invention craft is global (not Asgarnia-locked). ",
  );
  out = out.replace(
    /Asgarnia Invention Guild inventor's workbench manufacture[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Asgarnia Invention Guild infrastructure for gizmo work[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Asgarnia Invention Guild manufacture of the alchemical hydrix[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Hard Asgarnia \+ Anachronia for full self-supply\.?/gi,
    "Hard Kandarin for Manor Farm mycelial webbing (Invention craft is global). ",
  );
  out = out.replace(
    /Asgarnia \+ Anachronia hard for complete self-sufficient extreme invent loops\.?/gi,
    "Kandarin hard for Manor Farm webbing self-supply; Invention craft is global. ",
  );
  out = out.replace(
    /Asgarnia owns Invention tutorial \/ Guild \/ workbench discovery taxonomy[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Asgarnia owns primary workbench\/guild discovery geography[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Tutorial\/charge-pack research is Asgarnia Invention Guild geography[^.]*\.?/gi,
    "Charge-pack research is global Invention progression. ",
  );
  out = out.replace(
    /Hard Asgarnia for Invention Guild workbench manufacture framing[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Hard Asgarnia Invention manufacture framing[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Invention manufacture pressures Asgarnia Guild[^.]*\.?/gi,
    "Invention manufacture is global (workbench not region-locked). ",
  );
  out = out.replace(
    /Region pressure: Asgarnia: Invention Guild discovery\/craft home[^.]*\.?/gi,
    `Region pressure: ${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Asgarnia: Invention workbench \/ Ancient Invention component path\.?/gi,
    "Ancient Invention component path is global craft; Stormguard dig pressure may still be Kandarin. ",
  );
  out = out.replace(
    /Base-game Invention tutorial geography is Asgarnia, but Equilibrium tutorial treatment is not yet public\./gi,
    "Invention unlock is not Asgarnia-gated for Equilibrium planning (skill/workbench global).",
  );
  out = out.replace(
    /Asgarnia for Invention Guild unless Equilibrium globalises Invention tutorial\/machines\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Require Kandarin for Cache\/diviners route and Asgarnia for Invention elite craft[^.]*\.?/gi,
    "Kandarin Cache/diviners route is optional pressure; Invention elite craft is global (not Asgarnia-locked). ",
  );
  out = out.replace(
    /Asgarnia is forge\/Invention support\.?/gi,
    "Invention manufacture is global; forge geography stays regional support only. ",
  );
  out = out.replace(
    /Asgarnia Invention is manufacture pressure[^.]*\.?/gi,
    "Invention manufacture is global (not a hard Asgarnia gate). ",
  );
  out = out.replace(
    /Track Asgarnia Invention manufacture[^.]*\.?/gi,
    "Invention manufacture is global; track energy tiers the player can reach. ",
  );
  out = out.replace(
    /Invention manufacture pressures Asgarnia workbench\/guild[^.]*\.?/gi,
    `${GLOBAL_NOTE} `,
  );
  out = out.replace(
    /Hard Asgarnia\.(?=\s|$)/gi,
    `${GLOBAL_NOTE}`,
  );
  // Dedupe every "not Asgarnia-locked" clause to a single trailing GLOBAL_NOTE
  if ((out.match(/not Asgarnia-locked/g) || []).length > 0) {
    out = out
      .replace(/[^.·]*not Asgarnia-locked[^.·]*[.!]?\s*/gi, " ")
      .replace(/[^.·]*Guild machine-room scenery stays Asgarnia place geography only\.?\s*/gi, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/·\s*·/g, "·")
      .trim();
    if (!out.includes("not Asgarnia-locked")) {
      out = `${out} · ${GLOBAL_NOTE}`;
    }
  }
  // Collapse double spaces / orphan bullets
  out = out.replace(/\s{2,}/g, " ").replace(/·\s*·/g, "·").replace(/\s+·\s*$/g, "").trim();
  return out;
}

function scrubRequirements(list) {
  if (!Array.isArray(list)) return list;
  return list.map((item) => {
    if (typeof item !== "string") return item;
    return scrubText(item);
  });
}

/** Scrub nested region_pressure string arrays / objects. */
function scrubRegionPressure(value) {
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubRegionPressure);
  if (value && typeof value === "object") {
    const out = { ...value };
    for (const key of Object.keys(out)) {
      if (typeof out[key] === "string") out[key] = scrubText(out[key]);
      else if (Array.isArray(out[key]) || (out[key] && typeof out[key] === "object")) {
        out[key] = scrubRegionPressure(out[key]);
      }
    }
    return out;
  }
  return value;
}

function dropAsgarnia(req) {
  if (!Array.isArray(req)) return [];
  return req.filter((r) => r && r !== "asgarnia");
}

function recomputeCombo(row) {
  const req = Array.isArray(row.requiredRegions)
    ? row.requiredRegions
    : Array.isArray(row.required_regions)
      ? row.required_regions
      : [];
  if (req.length > 1) {
    row.regionRequirementType = "all_required";
    row.isRegionCombo = true;
    row.comboLabel = `Region combo (all required): ${req.join(" + ")}`;
  } else if (req.length === 1) {
    row.regionRequirementType = row.regionRequirementType === "support" ? "support" : "single";
    row.isRegionCombo = false;
    if (row.comboLabel && /asgarnia/i.test(row.comboLabel) && !req.includes("asgarnia")) {
      row.comboLabel = "";
    }
  } else {
    row.regionRequirementType =
      Array.isArray(row.regionHints) && row.regionHints.length > 1 ? "support" : "single";
    row.isRegionCombo = false;
    if (row.comboLabel && /asgarnia|all required/i.test(row.comboLabel)) {
      row.comboLabel = "";
    }
  }
}

function setRequired(row, next) {
  row.requiredRegions = [...next];
  row.required_regions = [...next];
}

function patchRequired(row, id) {
  const forced = forceReqFor(id);
  if (forced) {
    const before = JSON.stringify(row.requiredRegions || row.required_regions || []);
    setRequired(row, forced);
    return before !== JSON.stringify(forced);
  }

  const reqKey = Array.isArray(row.requiredRegions)
    ? "requiredRegions"
    : Array.isArray(row.required_regions)
      ? "required_regions"
      : null;
  if (!reqKey) return false;
  const before = [...row[reqKey]];
  if (!before.includes("asgarnia")) return false;
  const next = dropAsgarnia(before);
  setRequired(row, next);
  return before.join(",") !== next.join(",");
}

/**
 * Stop parking global Invention manufacture under Asgarnia.
 * - strip asgarnia from regionHints
 * - rename asgarnia:slug → invention:slug (or single-req host / cross-region)
 * UI region filter matches id prefix + hints, so both must leave Asgarnia.
 */
function rehomeOffAsgarnia(row, sourceLabel) {
  const id = String(row.id || "");
  if (!id || keepAsgarniaPlace(id)) return false;
  if (!isInventionManufactureRow(row) && !forceReqFor(id)) return false;

  let changed = false;
  const req = Array.isArray(row.requiredRegions)
    ? row.requiredRegions
    : Array.isArray(row.required_regions)
      ? row.required_regions
      : [];

  for (const key of ["regionHints", "region_hints"]) {
    if (!Array.isArray(row[key])) continue;
    const stripped = row[key].filter((r) => r && r !== "asgarnia");
    const next = req.length ? [...new Set([...req, ...stripped.filter((r) => !req.includes(r))])] : stripped;
    // For pure global manufacture, clear soft Asgarnia-only host lists
    const finalHints = req.length ? [...req] : next.filter((r) => r !== "asgarnia");
    if (JSON.stringify(row[key]) !== JSON.stringify(finalHints)) {
      row[key] = finalHints;
      changed = true;
    }
  }
  if (!Array.isArray(row.regionHints)) {
    row.regionHints = req.length ? [...req] : [];
    changed = true;
  } else if (!req.length && row.regionHints.includes("asgarnia")) {
    row.regionHints = row.regionHints.filter((r) => r !== "asgarnia");
    changed = true;
  }

  // Rehome ids as well as region fields because filtering also matches id prefixes.
  if (id.startsWith("asgarnia:")) {
    const slug = slugOf(id);
    let newId;
    if (req.length === 1) newId = `${req[0]}:${slug}`;
    else if (req.length > 1) newId = `cross-region:${slug}`;
    else newId = `invention:${slug}`;
    if (newId !== id) {
      idRenames.set(id, newId);
      row.id = newId;
      changed = true;
      log.push(`rehome ${sourceLabel} ${id} → ${newId} hints=${JSON.stringify(row.regionHints || [])}`);
    }
  }

  recomputeCombo(row);
  return changed;
}

function patchRow(row, sourceLabel) {
  const id = String(row.id || "");
  const name = String(row.name || "");
  let changed = false;

  if (typeof row.detail === "string") {
    const scrubbed = scrubText(row.detail);
    if (scrubbed !== row.detail) {
      row.detail = scrubbed;
      changed = true;
    }
  }
  if (typeof row.league_treatment === "string") {
    const scrubbed = scrubText(row.league_treatment);
    if (scrubbed !== row.league_treatment) {
      row.league_treatment = scrubbed;
      changed = true;
    }
  }
  if (typeof row.notes === "string") {
    const scrubbed = scrubText(row.notes);
    if (scrubbed !== row.notes) {
      row.notes = scrubbed;
      changed = true;
    }
  }
  if (Array.isArray(row.requirements)) {
    const scrubbed = scrubRequirements(row.requirements);
    if (JSON.stringify(scrubbed) !== JSON.stringify(row.requirements)) {
      row.requirements = scrubbed;
      changed = true;
    }
  }
  if (row.region_pressure != null) {
    const scrubbed = scrubRegionPressure(row.region_pressure);
    if (JSON.stringify(scrubbed) !== JSON.stringify(row.region_pressure)) {
      row.region_pressure = scrubbed;
      changed = true;
    }
  }
  if (Array.isArray(row.region_pressure_notes)) {
    const scrubbed = scrubRequirements(row.region_pressure_notes);
    if (JSON.stringify(scrubbed) !== JSON.stringify(row.region_pressure_notes)) {
      row.region_pressure_notes = scrubbed;
      changed = true;
    }
  }

  if (keepAsgarniaPlace(id)) {
    if (typeof row.detail === "string" && /Invention unlocked|skill home/i.test(row.detail)) {
      const next = scrubText(row.detail);
      if (next !== row.detail) {
        row.detail = next;
        changed = true;
      }
    }
    if (changed) log.push(`copy-only ${sourceLabel} ${id || name}`);
    return changed;
  }

  if (!isInventionManufactureRow(row) && !forceReqFor(id)) {
    if (changed) log.push(`copy-only ${sourceLabel} ${id || name}`);
    return changed;
  }

  if (patchRequired(row, id || name)) {
    changed = true;
    recomputeCombo(row);
    log.push(
      `cleared asgarnia ${sourceLabel} ${id || name} → req=${JSON.stringify(row.requiredRegions || row.required_regions || [])}`,
    );
  } else if (forceReqFor(id)) {
    recomputeCombo(row);
    log.push(`forced req ${sourceLabel} ${id} → ${JSON.stringify(forceReqFor(id))}`);
  }

  if (rehomeOffAsgarnia(row, sourceLabel)) changed = true;

  if (
    (isInventionManufactureRow(row) || forceReqFor(row.id || id)) &&
    typeof row.detail === "string" &&
    !keepAsgarniaPlace(row.id || id)
  ) {
    if (!row.detail.includes("not Asgarnia-locked")) {
      row.detail = `${row.detail} · ${GLOBAL_NOTE}`;
      changed = true;
    }
    const cleaned = scrubText(row.detail);
    if (cleaned !== row.detail) {
      row.detail = cleaned;
      changed = true;
    }
  }

  return changed;
}

const skillingPath = "data/research/regional-skilling-unlocks.json";
const skilling = read(skillingPath);
let skillingChanged = 0;
for (const row of skilling.records || []) {
  if (patchRow(row, "skilling")) skillingChanged++;
}

// Rewrite old asgarnia: invent id refs inside details after renames
function rewriteIdRefs(text) {
  if (typeof text !== "string" || !text || !idRenames.size) return text;
  let out = text;
  for (const [from, to] of idRenames) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}
for (const row of skilling.records || []) {
  if (typeof row.detail === "string") row.detail = rewriteIdRefs(row.detail);
  if (Array.isArray(row.requirements)) {
    row.requirements = row.requirements.map((r) =>
      typeof r === "string" ? rewriteIdRefs(r) : r,
    );
  }
}
// Soft-hint strip: multi-stacks that only carried Asgarnia for invent craft pressure
const SOFT_STRIP_ASGARNIA = new Set([
  "cross-region:gote-dark-facet-ritual-shard-sustain",
  "cross-region:signs-of-the-porter-supply",
]);
for (const row of skilling.records || []) {
  if (!SOFT_STRIP_ASGARNIA.has(row.id)) continue;
  const req = row.requiredRegions || [];
  if (req.includes("asgarnia")) continue;
  if (Array.isArray(row.regionHints) && row.regionHints.includes("asgarnia")) {
    row.regionHints = row.regionHints.filter((r) => r !== "asgarnia");
    recomputeCombo(row);
    log.push(`soft-strip asgarnia hints ${row.id}`);
  }
}

// Build full asgarnia:slug → current id map from live skilling (covers prior renames)
const liveBySlug = new Map();
for (const row of skilling.records || []) {
  if (!row.id || !String(row.id).includes(":")) continue;
  liveBySlug.set(slugOf(row.id), row.id);
}
const REHOMED_SLUGS = [
  "augmentor",
  "invention-gizmo-shells",
  "divine-charge-crafting",
  "junk-refiner",
  "spring-cleaner",
  "equipment-siphon",
  "charge-pack-infrastructure",
  "gizmo-dissolver",
  "fishing-rod-o-matic",
  "enhanced-fishing-rod-o-matic",
  "hammer-tron",
  "pyro-matic",
  "alchemical-onyx",
  "alchemical-hydrix",
  "passage-of-the-abyss",
  "xp-capacitor-5000",
  "mechanised-siphon",
  "urn-enhancer",
  "ancient-invention-blueprints",
  "ancient-gizmo-shells",
  "ancient-components-discovery",
  "ancient-tools-enhanced",
  "extreme-invention-boost-path",
  "equipment-dissolver",
  "equipment-separator",
  "herb-protector",
  "potion-reservoir",
  "auto-sanctifier",
  "empty-divine-charge",
  "junk-chance-reduction",
  "invention-skilling-tools",
  "invention-skilling-perk-ladder",
  "augmentable-gather-tools-research",
  "brooch-of-the-gods",
  "skilling-accumulators-package",
];
for (const slug of REHOMED_SLUGS) {
  const live = liveBySlug.get(slug);
  if (!live) continue;
  const oldId = `asgarnia:${slug}`;
  if (live !== oldId) idRenames.set(oldId, live);
}

function rewriteAllIdRefs(value) {
  if (typeof value === "string") {
    let out = value;
    for (const [from, to] of idRenames) {
      if (out.includes(from)) out = out.split(from).join(to);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(rewriteAllIdRefs);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = rewriteAllIdRefs(value[key]);
    }
  }
  return value;
}

for (const row of skilling.records || []) {
  if (typeof row.detail === "string") {
    let next = scrubText(rewriteIdRefs(row.detail));
    const req = row.requiredRegions || [];
    // left over after Asgarnia was stripped from hard reqs.
    if (
      (String(row.id || "").startsWith("invention:") || forceReqFor(row.id)) &&
      !req.length &&
      !keepAsgarniaPlace(row.id)
    ) {
      next = next
        .replace(/Region combo \(all required\):[^·]*·\s*/gi, "")
        .replace(/Region chain \(support pressure\):[^·]*·\s*/gi, "");
    }
    // Single-region invent rows: if detail combo still lists asgarnia, strip it
    if (req.length && !req.includes("asgarnia")) {
      next = next.replace(
        /Region combo \(all required\):\s*asgarnia\s*\+\s*/gi,
        "Region combo (all required): ",
      );
    }
    next = scrubText(next);
    if (next !== row.detail) row.detail = next;
  }
  if (Array.isArray(row.requirements)) {
    row.requirements = row.requirements.map((r) =>
      typeof r === "string" ? scrubText(rewriteIdRefs(r)) : r,
    );
  }
}

write(skillingPath, skilling);
log.push(`skilling rows touched: ${skillingChanged}`);
log.push(`id renames: ${idRenames.size}`);

const catalogPath = "data/research/catalog.json";
const catalog = read(catalogPath);
const skillingByName = new Map((skilling.records || []).map((r) => [r.name, r]));
let catalogChanged = 0;

function inventCatalogPayload(match, hostId) {
  return {
    name: match.name,
    category: match.category,
    detail: match.detail,
    requirements: match.requirements || [],
    confidence: match.confidence,
    source: match.source,
    regionId: hostId,
    regionHints: match.regionHints || [],
    requiredRegions: match.requiredRegions || [],
    regionRequirementType: match.regionRequirementType,
    comboLabel: match.comboLabel || "",
    isRegionCombo: match.isRegionCombo,
  };
}

for (const region of catalog.regions || []) {
  const before = region.upgrades?.length || 0;
  region.upgrades = (region.upgrades || []).filter((u) => {
    const match = skillingByName.get(u.name);
    if (!match) return true;

    const inventish =
      isInventionManufactureRow(match) ||
      String(match.id).startsWith("invention:") ||
      forceReqFor(match.id);

    if (!inventish && !keepAsgarniaPlace(match.id)) return true;

    // Place-only Asgarnia machines stay on Asgarnia host
    if (keepAsgarniaPlace(match.id)) {
      if (region.id === "asgarnia") {
        Object.assign(u, inventCatalogPayload(match, "asgarnia"));
        return true;
      }
      if (region.id !== "asgarnia" && String(match.id).startsWith("asgarnia:")) {
        return false;
      }
      return true;
    }

    // Global / multi invent: only host on hard required regions (none = drop everywhere)
    const hosts = match.requiredRegions || [];
    if (!hosts.includes(region.id)) {
      catalogChanged++;
      return false;
    }
    Object.assign(u, inventCatalogPayload(match, region.id));
    return true;
  });
  if ((region.upgrades?.length || 0) !== before) {
    log.push(`catalog ${region.id}: ${before} → ${region.upgrades.length} upgrades`);
  }
}

for (const match of skilling.records || []) {
  if (keepAsgarniaPlace(match.id)) continue;
  if (!isInventionManufactureRow(match) && !forceReqFor(match.id)) continue;
  const hosts = match.requiredRegions || [];
  for (const hostId of hosts) {
    const region = (catalog.regions || []).find((r) => r.id === hostId);
    if (!region) continue;
    region.upgrades ||= [];
    if (region.upgrades.some((u) => u.name === match.name)) continue;
    region.upgrades.push(inventCatalogPayload(match, hostId));
    catalogChanged++;
    log.push(`catalog host+ ${hostId}: ${match.name}`);
  }
}

const asgRegion = (catalog.regions || []).find((r) => r.id === "asgarnia");
if (asgRegion) {
  const before = asgRegion.upgrades.length;
  asgRegion.upgrades = asgRegion.upgrades.filter((u) => {
    const synthetic = {
      id: u.id || `asgarnia:${u.name}`,
      name: u.name,
      category: u.category,
      detail: u.detail,
      requiredRegions: u.requiredRegions,
    };
    // Keep real Asgarnia place names / guild
    if (
      /Invention Guild|Alchemiser|Auto disassembler|hide tanner|Plank maker|Partial potion producer|generators|crystal tool siphon|Waiko|Arc journal/i.test(
        u.name || "",
      )
    ) {
      return true;
    }
    const req = u.requiredRegions || [];
    if (req.includes("asgarnia")) return true;
    if (
      isInventionManufactureRow(synthetic) ||
      /Invention|gizmo shell|gizmo perk|augmentor|siphon|divine charge|junk refin/i.test(
        `${u.name} ${u.category || ""}`,
      )
    ) {
      // Multi-req without asgarnia: not an Asgarnia host
      if (req.length && !req.includes("asgarnia")) {
        log.push(`catalog drop asgarnia leftover (other hard req): ${u.name}`);
        catalogChanged++;
        return false;
      }
      if (!req.length) {
        log.push(`catalog drop asgarnia leftover (global invent): ${u.name}`);
        catalogChanged++;
        return false;
      }
    }
    // Strip asgarnia soft hint from multi-req invent chains hosted only for pressure
    if (
      Array.isArray(u.regionHints) &&
      u.regionHints.includes("asgarnia") &&
      req.length &&
      !req.includes("asgarnia") &&
      /Invention|Archaeology relic/i.test(`${u.name} ${u.category || ""}`)
    ) {
      u.regionHints = u.regionHints.filter((r) => r !== "asgarnia");
      log.push(`catalog strip asgarnia hint: ${u.name}`);
      catalogChanged++;
    }
    return true;
  });
  log.push(`catalog asgarnia upgrades ${before} → ${asgRegion.upgrades.length}`);
}

dedupeRegionUpgrades(catalog);
write(catalogPath, catalog);
log.push(`catalog upgrades touched: ${catalogChanged}`);

const progPath = "data/reference/progression-unlocks.json";
const prog = read(progPath);
let progChanged = 0;
const PROG_SECTIONS = [
  "quest_unlocks",
  "account_unlocks",
  "activity_unlocks",
  "equipment_models",
  "ability_unlocks",
  "prayer_unlocks",
  "consumable_unlocks",
];
for (const section of PROG_SECTIONS) {
  if (!Array.isArray(prog[section])) continue;
  for (const row of prog[section]) {
    if (patchRow(row, `progression:${section}`)) progChanged++;
  }
}
const progBefore = JSON.stringify(prog);
rewriteAllIdRefs(prog);
// scrub string fields on invent-related rows again
for (const section of PROG_SECTIONS) {
  if (!Array.isArray(prog[section])) continue;
  for (const row of prog[section]) {
    for (const field of ["notes", "detail", "league_treatment"]) {
      if (typeof row[field] === "string") row[field] = scrubText(row[field]);
    }
    if (Array.isArray(row.requirements)) {
      row.requirements = row.requirements.map((r) =>
        typeof r === "string" ? scrubText(r) : r,
      );
    }
    if (row.region_pressure != null) row.region_pressure = scrubRegionPressure(row.region_pressure);
    if (Array.isArray(row.links_existing_ids)) {
      row.links_existing_ids = row.links_existing_ids.map((id) => {
        if (typeof id !== "string") return id;
        return idRenames.get(id) || id;
      });
    }
  }
}
if (JSON.stringify(prog) !== progBefore) progChanged++;
write(progPath, prog);
log.push(`progression rows touched: ${progChanged}`);

// Catalog string rewrite for any leftover asgarnia: invent id mentions
rewriteAllIdRefs(catalog);
write(catalogPath, catalog);

const enrDir = join(ROOT, "scraped-data");
const enrFiles = readdirSync(enrDir).filter((f) =>
  /^progression-enrichment-regional-skilling.*\.json$/.test(f),
);
let enrChanged = 0;
for (const file of enrFiles) {
  const path = `scraped-data/${file}`;
  const data = read(path);
  let fileHit = 0;
  for (const key of Object.keys(data)) {
    if (!Array.isArray(data[key])) continue;
    for (const row of data[key]) {
      if (!row || typeof row !== "object") continue;
      // Enrichment uses required_regions snake_case
      const id = String(row.id || "");
      const forced = forceReqFor(id);
      if (forced) {
        row.required_regions = [...forced];
        if (Array.isArray(row.region_hints)) {
          row.region_hints = forced.length
            ? [...forced]
            : row.region_hints.filter((r) => r !== "asgarnia");
        }
        if (Array.isArray(row.region_hint) === false && row.region_hint === "asgarnia" && !forced.length) {
          row.region_hint = forced[0] || "global";
        }
        for (const field of ["notes", "detail", "league_treatment", "region_pressure_note"]) {
          if (typeof row[field] === "string") row[field] = scrubText(row[field]);
        }
        // Rename asgarnia: enrichment ids so next skilling sync does not re-host under Asgarnia
        if (id.startsWith("asgarnia:") && !keepAsgarniaPlace(id)) {
          const slug = slugOf(id);
          row.id =
            forced.length === 1
              ? `${forced[0]}:${slug}`
              : forced.length > 1
                ? `cross-region:${slug}`
                : `invention:${slug}`;
        }
        fileHit++;
        continue;
      }
      if (!isInventionManufactureRow({ ...row, requiredRegions: row.required_regions })) {
        for (const field of ["notes", "detail", "league_treatment"]) {
          if (typeof row[field] === "string") {
            const scrubbed = scrubText(row[field]);
            if (scrubbed !== row[field]) {
              row[field] = scrubbed;
              fileHit++;
            }
          }
        }
        continue;
      }
      if (Array.isArray(row.required_regions) && row.required_regions.includes("asgarnia")) {
        row.required_regions = dropAsgarnia(row.required_regions);
        fileHit++;
      }
      if (Array.isArray(row.region_hints) && row.region_hints.includes("asgarnia")) {
        row.region_hints = row.region_hints.filter((r) => r !== "asgarnia");
        fileHit++;
      }
      if (id.startsWith("asgarnia:") && !keepAsgarniaPlace(id)) {
        const slug = slugOf(id);
        const req = row.required_regions || [];
        row.id =
          req.length === 1
            ? `${req[0]}:${slug}`
            : req.length > 1
              ? `cross-region:${slug}`
              : `invention:${slug}`;
        fileHit++;
      }
      for (const field of ["notes", "detail", "league_treatment"]) {
        if (typeof row[field] === "string") row[field] = scrubText(row[field]);
      }
    }
  }
  if (fileHit) {
    write(path, data);
    enrChanged += fileHit;
    log.push(`enrichment ${file}: ${fileHit}`);
  }
}
log.push(`enrichment fields touched: ${enrChanged}`);

const pePath = "data/research/planner-expansions.json";
try {
  const pe = read(pePath);
  let peHit = 0;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string") {
        const scrubbed = scrubText(v);
        if (scrubbed !== v) {
          node[k] = scrubbed;
          peHit++;
        }
      } else walk(v);
    }
  };
  walk(pe);
  if (peHit) {
    write(pePath, pe);
    log.push(`planner-expansions strings scrubbed: ${peHit}`);
  }
} catch {
  log.push("planner-expansions skip");
}

const after = read(skillingPath);
const bad = [];
for (const row of after.records || []) {
  const id = row.id || "";
  const req = row.requiredRegions || [];
  if (!req.includes("asgarnia")) continue;
  if (KEEP_ASGARNIA_HARD.has(id)) continue;
  if (isInventionManufactureRow(row) || FORCE_REQUIRED.has(id)) {
    bad.push({ id, name: row.name, req });
  }
}

console.log(log.join("\n"));
console.log("---");
console.log(
  "remaining invention manufacture with asgarnia hard gate:",
  bad.length,
  bad.length ? JSON.stringify(bad, null, 2) : "OK",
);
if (bad.length) process.exitCode = 1;
