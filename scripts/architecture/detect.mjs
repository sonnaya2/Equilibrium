/**
 * Combat-layer architecture detectors (pure).
 *
 * Used by check.mjs (gate) and check.self-test.mjs (proves rules fire).
 */
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

const fwd = (p) => p.split(sep).join("/");

/** Strip // and /* * / comments so string matches in comments are ignored. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Extract module specifier strings from import/export/require forms.
 * Handles: import x from 'm', import('m'), require('m'), export ... from 'm',
 * import type { X } from 'm'.
 */
export function extractImportSpecs(source) {
  const text = stripComments(source);
  const specs = [];
  const re =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    specs.push(m[1]);
  }
  return specs;
}

/**
 * Resolve a module specifier to a repo-relative posix path when it points
 * inside the repo (relative, @/..., or src/...). External packages return null.
 */
export function resolveSpecToRepoPath(filePath, spec, root) {
  const fileDir = dirname(filePath);
  let abs;
  if (spec.startsWith("@/")) {
    abs = resolve(root, "src", spec.slice(2));
  } else if (spec.startsWith("src/") || spec === "src") {
    abs = resolve(root, spec);
  } else if (spec.startsWith(".")) {
    abs = resolve(fileDir, spec);
  } else {
    return null;
  }
  // Extension-less path is fine; only directory membership matters.
  const rel = fwd(relative(root, abs));
  if (rel.startsWith("..") || rel === "") return null;
  return rel;
}

/** Normalize a combat module path for the import graph (strip ext + trailing /index). */
export function moduleKey(repoRelPath) {
  return fwd(repoRelPath).replace(/\.tsx?$/, "").replace(/\/index$/, "");
}

export function isTestFile(repoRelPath) {
  const base = repoRelPath.split("/").pop() ?? "";
  return /\.test\.(ts|tsx)$/.test(base);
}

export function isUnder(repoRelPath, prefix) {
  const p = fwd(repoRelPath);
  const pre = fwd(prefix).replace(/\/$/, "");
  return p === pre || p.startsWith(pre + "/");
}

/** Production UI surfaces: components + Next app routes. */
export function isUiSurface(repoRelPath) {
  const p = fwd(repoRelPath);
  return isUnder(p, "src/components") || isUnder(p, "app");
}

/** Spec points at UI components (@/components, src/components, or relative into it). */
export function isComponentsImport(filePath, spec, root) {
  if (spec === "@/components" || spec.startsWith("@/components/")) return true;
  if (spec === "src/components" || spec.startsWith("src/components/")) return true;
  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  return isUnder(resolved, "src/components");
}

/** Spec points at combat engine (src/combat/engine). */
export function isEngineImport(filePath, spec, root) {
  if (spec === "@/combat/engine" || spec.startsWith("@/combat/engine/")) return true;
  if (spec === "src/combat/engine" || spec.startsWith("src/combat/engine/")) return true;
  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  return isUnder(resolved, "src/combat/engine");
}

/**
 * Engine internals banned from UI: cast | resolution | runtime | schedulers.
 * Allowed: engine/simulation and the @/combat barrel that re-exports it.
 */
const BANNED_ENGINE_INTERNAL_DIRS = ["cast", "resolution", "runtime", "schedulers"];

/** True if import resolves into a banned engine internal; simulation returns false. */
export function isBannedEngineInternalImport(filePath, spec, root) {
  for (const dir of BANNED_ENGINE_INTERNAL_DIRS) {
    if (
      spec === `@/combat/engine/${dir}` ||
      spec.startsWith(`@/combat/engine/${dir}/`) ||
      spec === `src/combat/engine/${dir}` ||
      spec.startsWith(`src/combat/engine/${dir}/`)
    ) {
      return true;
    }
  }
  // engine root may re-export simulation; not banned by itself
  if (
    spec === "@/combat/engine" ||
    spec === "src/combat/engine" ||
    spec === "@/combat/engine/simulation" ||
    spec.startsWith("@/combat/engine/simulation/") ||
    spec === "src/combat/engine/simulation" ||
    spec.startsWith("src/combat/engine/simulation/")
  ) {
    return false;
  }

  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  if (!isUnder(resolved, "src/combat/engine")) return false;
  if (isUnder(resolved, "src/combat/engine/simulation")) return false;
  for (const dir of BANNED_ENGINE_INTERNAL_DIRS) {
    if (isUnder(resolved, `src/combat/engine/${dir}`)) return true;
  }
  // Unknown engine subfolder: ban for UI safety; engine root itself is allowed.
  const engineRoot = "src/combat/engine";
  if (resolved === engineRoot) return false;
  return isUnder(resolved, engineRoot);
}

export function isReactImport(spec) {
  return (
    spec === "react" ||
    spec === "react-dom" ||
    spec.startsWith("react/") ||
    spec.startsWith("react-dom/")
  );
}

// --- Pass 7: style catalogues / registries / solver UI seams -----------------

/** Style ability catalogue modules (melee/ranged/magic/necromancy). */
export const STYLE_CATALOGUE_SUFFIXES = [
  "styles/melee/abilities",
  "styles/ranged/abilities",
  "styles/magic/abilities",
  "styles/necromancy/abilities",
];

/**
 * True when import resolves into a style ability catalogue module path.
 * Matches @/combat/styles/.../abilities, src/combat/..., or relative paths.
 * Factories (volleyOfSouls, resplendentAsphyxiate) may still import the path;
 * use findStyleAbilityArrayImports for the array-import ban.
 */
export function isStyleCatalogueImport(filePath, spec, root) {
  for (const suf of STYLE_CATALOGUE_SUFFIXES) {
    if (
      spec === `@/combat/${suf}` ||
      spec.startsWith(`@/combat/${suf}/`) ||
      spec === `src/combat/${suf}` ||
      spec.startsWith(`src/combat/${suf}/`)
    ) {
      return true;
    }
  }
  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  const key = moduleKey(resolved);
  for (const suf of STYLE_CATALOGUE_SUFFIXES) {
    if (key === `src/combat/${suf}` || key.startsWith(`src/combat/${suf}/`)) return true;
  }
  return false;
}

/** Named exports that are the style ability arrays (not factories/helpers). */
export const STYLE_ABILITY_ARRAY_NAMES = [
  "MELEE_ABILITIES",
  "RANGED_ABILITIES",
  "MAGIC_ABILITIES",
  "NECROMANCY_ABILITIES",
];

/**
 * UI must not import style ability arrays (or namespace/import * from those modules).
 * Factory imports (volleyOfSouls, isMeleeAbility, resplendentAsphyxiate) are allowed.
 * @returns {{ spec: string, detail: string }[]}
 */
export function findStyleAbilityArrayImports(source, filePath, root) {
  const text = stripComments(source);
  /** @type {{ spec: string, detail: string }[]} */
  const hits = [];
  const names = STYLE_ABILITY_ARRAY_NAMES.join("|");

  // import { MELEE_ABILITIES, ... } from "..."
  // import type { MELEE_ABILITIES } from "..."  (still banned - array type leakage)
  const namedRe = new RegExp(
    `import\\s+(?:type\\s+)?\\{([^}]+)\\}\\s+from\\s+['"]([^'"]+)['"]`,
    "g",
  );
  let m;
  while ((m = namedRe.exec(text)) !== null) {
    const bindings = m[1];
    const spec = m[2];
    if (!isStyleCatalogueImport(filePath, spec, root)) continue;
    const arrayHit = bindings.match(new RegExp(`\\b(${names})\\b`));
    if (arrayHit) {
      hits.push({
        spec,
        detail: `UI must not import style ability array ${arrayHit[1]} (use abilities/registry)`,
      });
    }
  }

  // import * as X from ".../abilities"  (namespace can re-export arrays)
  const nsRe =
    /import\s+(?:type\s+)?\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = nsRe.exec(text)) !== null) {
    const spec = m[1];
    if (isStyleCatalogueImport(filePath, spec, root)) {
      hits.push({
        spec,
        detail:
          "UI must not namespace-import style ability modules (use abilities/registry)",
      });
    }
  }

  // import X from ".../abilities"  (default import of catalogue)
  const defRe =
    /import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = defRe.exec(text)) !== null) {
    const spec = m[2];
    if (isStyleCatalogueImport(filePath, spec, root)) {
      hits.push({
        spec,
        detail:
          "UI must not default-import style ability modules (use abilities/registry)",
      });
    }
  }

  return hits;
}

/**
 * Catalogue identifiers that must not be linearly scanned by id in production.
 * (Map/registry lookups are fine; array.find on these is the anti-pattern.)
 */
export const LINEAR_ID_CATALOGUE_NAMES = [
  "MELEE_ABILITIES",
  "RANGED_ABILITIES",
  "MAGIC_ABILITIES",
  "NECROMANCY_ABILITIES",
  "ALL_ABILITIES",
  "PASSIVE_DEFINITIONS",
  "RECORD_TO_ENGINE",
];

/** Data-layer record bags with known ById maps — linear .records.find by id banned. */
export const LINEAR_ID_RECORDS_OWNERS = [
  "combatAbilities",
  "combatEquipment",
  "combatPrayers",
  "combatRevolutionBars",
];

/**
 * Structural linear id-lookup sites: CATALOGUE.find((x) => x.id === ...)
 * and combatX.records.find((r) => r.id === ...). Not all .find usages.
 * @returns {{ match: string, kind: string }[]}
 */
export function findLinearIdLookups(source) {
  const text = stripComments(source);
  /** @type {{ match: string, kind: string }[]} */
  const hits = [];

  const names = LINEAR_ID_CATALOGUE_NAMES.join("|");
  // MELEE_ABILITIES.find((a) => a.id === id) / .find(a => a.id === "x")
  const catRe = new RegExp(
    `\\b(${names})\\.find\\s*\\(\\s*(?:\\(?\\s*([A-Za-z_$][\\w$]*)\\s*\\)?\\s*=>)\\s*\\2\\.id\\s*===`,
    "g",
  );
  let m;
  while ((m = catRe.exec(text)) !== null) {
    hits.push({ match: m[0], kind: m[1] });
  }

  const owners = LINEAR_ID_RECORDS_OWNERS.join("|");
  const recRe = new RegExp(
    `\\b(${owners})\\.records\\.find\\s*\\(\\s*(?:\\(?\\s*([A-Za-z_$][\\w$]*)\\s*\\)?\\s*=>)\\s*\\2\\.id\\s*===`,
    "g",
  );
  while ((m = recRe.exec(text)) !== null) {
    hits.push({ match: m[0], kind: `${m[1]}.records` });
  }

  return hits;
}

/** Style ability definition modules own the arrays; linear self-lookup is out of scope. */
export function isStyleAbilityDefinitionFile(repoRelPath) {
  const p = fwd(repoRelPath);
  return /^src\/combat\/styles\/[^/]+\/abilities\.tsx?$/.test(p);
}

/** Defines PASSIVE_DEFINITIONS (not re-export). */
export function definesPassiveDefinitions(source) {
  const text = stripComments(source);
  return /\b(?:export\s+)?const\s+PASSIVE_DEFINITIONS\s*[:=]/.test(text);
}

/**
 * Passive BY_ID support map: BY_ID / PASSIVE_BY_ID built from passive definitions.
 * archaeologyRelics BY_ID is unrelated (no PassiveDefinition / PASSIVE_DEFINITIONS).
 */
export function definesPassiveByIdMap(source) {
  const text = stripComments(source);
  if (!/\b(?:export\s+)?const\s+(?:PASSIVE_)?BY_ID\b/.test(text)) return false;
  return /\bPASSIVE_DEFINITIONS\b|\bPassiveDefinition\b|\bItemPassiveId\b/.test(text);
}

/** Defines RECORD_TO_ENGINE map literal (not re-export). */
export function definesRecordToEngine(source) {
  const text = stripComments(source);
  return /\b(?:export\s+)?const\s+RECORD_TO_ENGINE\s*[:=]/.test(text);
}

const RECORD_ENGINE_MAP_CANONICAL = "src/combat/abilities/engineMap.ts";

export function isRecordEngineMapCanonical(repoRelPath) {
  return fwd(repoRelPath) === RECORD_ENGINE_MAP_CANONICAL;
}

/** useLoadout (hook / loadout type module) — solver must not import. */
export function isUseLoadoutImport(filePath, spec, root) {
  if (
    spec === "@/components/combat/useLoadout" ||
    spec.startsWith("@/components/combat/useLoadout/") ||
    spec === "src/components/combat/useLoadout" ||
    spec.startsWith("src/components/combat/useLoadout/")
  ) {
    return true;
  }
  if (!(spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("src/"))) return false;
  if (!spec.includes("useLoadout")) return false;
  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  return moduleKey(resolved) === "src/components/combat/useLoadout";
}

/** UI combat stats adapters banned in solver production. */
const UI_STATS_MODULE_BASES = [
  "src/components/combat/loadoutStats",
  "src/components/combat/toResolvedCombatModel",
  "src/components/combat/solverSnapshot",
];

export function isUiStatsImport(filePath, spec, root) {
  for (const base of UI_STATS_MODULE_BASES) {
    const short = base.replace("src/", "@/");
    if (spec === short || spec.startsWith(short + "/") || spec === base || spec.startsWith(base + "/")) {
      return true;
    }
  }
  // relative / path fragment
  if (
    /loadoutStats|toResolvedCombatModel|solverSnapshot/.test(spec) &&
    (spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("src/"))
  ) {
    const resolved = resolveSpecToRepoPath(filePath, spec, root);
    if (!resolved) return false;
    const key = moduleKey(resolved);
    return UI_STATS_MODULE_BASES.some((b) => key === b);
  }
  return false;
}

export function isNodeSqliteImport(spec) {
  return spec === "node:sqlite" || spec === "node:sqlite/promises";
}

/** Build-time data platform scripts must not ship in runtime app/src production. */
export function isScriptsDataImport(filePath, spec, root) {
  if (spec === "scripts/data" || spec.startsWith("scripts/data/")) return true;
  if (spec.includes("scripts/data")) {
    const resolved = resolveSpecToRepoPath(filePath, spec, root);
    if (resolved && (resolved === "scripts/data" || resolved.startsWith("scripts/data/"))) return true;
    // dynamic import path fragments in tests often use string concat; only pure specs here
    if (/scripts\/data\//.test(spec) || /scripts\/data$/.test(spec)) return true;
  }
  const resolved = resolveSpecToRepoPath(filePath, spec, root);
  if (!resolved) return false;
  return resolved === "scripts/data" || resolved.startsWith("scripts/data/");
}

/**
 * Module participates in the model ↔ packRequest hard-cycle pair.
 * Covers model/** and packRequest (not every solver module).
 */
export function isModelPackCycleNode(modulePath) {
  const p = moduleKey(modulePath);
  if (p === "src/combat/solver/packRequest" || p.endsWith("/packRequest")) return "pack";
  if (p.includes("/model/") || p === "src/combat/model" || p.endsWith("/resolvedCombatModel")) {
    return "model";
  }
  // legacy name fragments in cycle paths
  if (p.includes("packRequest")) return "pack";
  if (p.includes("resolvedCombatModel")) return "model";
  return null;
}

/**
 * @typedef {{ rule: string, file: string, spec: string, detail: string }} Violation
 */

/**
 * Evaluate all architecture rules for one file's source.
 * @param {object} opts
 * @param {string} opts.root - repo root absolute
 * @param {string} opts.filePath - absolute path to the file
 * @param {string} opts.repoRel - posix path relative to root
 * @param {string} opts.source - file text
 * @param {Set<string>} [opts.allowlist] - repo-rel paths exempt from ALL rules
 * @param {Set<string>} [opts.uiStyleCatalogueAllowlist] - UI files exempt from ui-no-style-catalogues only
 * @returns {Violation[]}
 */
export function checkFile(opts) {
  const {
    root,
    filePath,
    repoRel,
    source,
    allowlist = new Set(),
    uiStyleCatalogueAllowlist = new Set(),
  } = opts;
  const rel = fwd(repoRel);
  if (allowlist.has(rel)) return [];

  const specs = extractImportSpecs(source);
  /** @type {Violation[]} */
  const out = [];
  const production = !isTestFile(rel);
  const underCombat = isUnder(rel, "src/combat");
  const underUi = isUiSurface(rel);
  const underSolver = isUnder(rel, "src/combat/solver");
  const underPassives = isUnder(rel, "src/combat/passives");
  const underApp = isUnder(rel, "app");

  // --- UI: no engine internals ---
  if (underUi && production) {
    for (const spec of specs) {
      if (isBannedEngineInternalImport(filePath, spec, root)) {
        out.push({
          rule: "ui-no-engine-internals",
          file: rel,
          spec,
          detail:
            "UI must not import engine cast/resolution/runtime/schedulers (use @/combat or engine/simulation)",
        });
      }
    }
  }

  // --- UI: no style ability ARRAY imports (factories from same modules ok) ---
  if (underUi && production && !uiStyleCatalogueAllowlist.has(rel)) {
    for (const hit of findStyleAbilityArrayImports(source, filePath, root)) {
      out.push({
        rule: "ui-no-style-catalogues",
        file: rel,
        spec: hit.spec,
        detail: hit.detail,
      });
    }
  }

  // --- no-linear-id-lookup (production combat + UI) ---
  if (
    production &&
    (underCombat || underUi) &&
    !isStyleAbilityDefinitionFile(rel)
  ) {
    for (const hit of findLinearIdLookups(source)) {
      out.push({
        rule: "no-linear-id-lookup",
        file: rel,
        spec: hit.match,
        detail: `linear id .find on ${hit.kind} — use BY_ID / registry Map / abilityById`,
      });
    }
  }

  // --- single-passive-registry ---
  if (production && underCombat && !underPassives) {
    if (definesPassiveDefinitions(source)) {
      out.push({
        rule: "single-passive-registry",
        file: rel,
        spec: "PASSIVE_DEFINITIONS",
        detail: "PASSIVE_DEFINITIONS may only be defined under src/combat/passives/**",
      });
    }
    if (definesPassiveByIdMap(source)) {
      out.push({
        rule: "single-passive-registry",
        file: rel,
        spec: "BY_ID",
        detail: "passive BY_ID support maps may only be defined under src/combat/passives/**",
      });
    }
  }

  // --- single-record-engine-map ---
  if (production && underCombat && !isRecordEngineMapCanonical(rel)) {
    if (definesRecordToEngine(source)) {
      out.push({
        rule: "single-record-engine-map",
        file: rel,
        spec: "RECORD_TO_ENGINE",
        detail: "RECORD_TO_ENGINE may only be defined in abilities/engineMap.ts",
      });
    }
  }

  // --- runtime-no-data-build (Next app production) ---
  if (underApp && production) {
    for (const spec of specs) {
      if (isNodeSqliteImport(spec)) {
        out.push({
          rule: "runtime-no-data-build",
          file: rel,
          spec,
          detail: "app production must not import node:sqlite (data platform is build-time only)",
        });
      }
      if (isScriptsDataImport(filePath, spec, root)) {
        out.push({
          rule: "runtime-no-data-build",
          file: rel,
          spec,
          detail: "app production must not import scripts/data (data platform is build-time only)",
        });
      }
    }
  }

  if (!underCombat) return out;

  for (const spec of specs) {
    if (production && isComponentsImport(filePath, spec, root)) {
      out.push({
        rule: "combat-no-components",
        file: rel,
        spec,
        detail: "src/combat must not import from components",
      });
    }

    if (isUnder(rel, "src/combat/shared") && isEngineImport(filePath, spec, root)) {
      out.push({
        rule: "shared-no-engine",
        file: rel,
        spec,
        detail: "src/combat/shared must not import from src/combat/engine",
      });
    }

    // Solver production: no react / components / useLoadout / UI stats adapters
    if (production && underSolver) {
      if (isReactImport(spec)) {
        out.push({
          rule: "solver-no-react",
          file: rel,
          spec,
          detail: "src/combat/solver must not import react or react-dom",
        });
      }
      if (isComponentsImport(filePath, spec, root)) {
        out.push({
          rule: "solver-no-components",
          file: rel,
          spec,
          detail: "src/combat/solver must not import from components",
        });
      }
      if (isUseLoadoutImport(filePath, spec, root)) {
        out.push({
          rule: "solver-no-loadout",
          file: rel,
          spec,
          detail: "src/combat/solver must not import useLoadout (use SolverPackSnapshot / domain types)",
        });
      }
      if (isUiStatsImport(filePath, spec, root)) {
        out.push({
          rule: "solver-no-ui-stats",
          file: rel,
          spec,
          detail:
            "src/combat/solver must not import loadoutStats / toResolvedCombatModel / solverSnapshot",
        });
      }
    }

    if (
      production &&
      isUnder(rel, "src/combat/engine") &&
      isComponentsImport(filePath, spec, root)
    ) {
      out.push({
        rule: "engine-no-components",
        file: rel,
        spec,
        detail: "src/combat/engine must not import from components",
      });
    }
  }

  return out;
}

export { normalize, join, resolve, relative, fwd };
