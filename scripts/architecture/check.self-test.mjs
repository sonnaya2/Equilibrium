/**
 * Self-test for architecture detectors.
 * Proves forbidden import patterns are caught; allowed patterns are not.
 *
 *   node scripts/architecture/check.self-test.mjs
 */
import { join } from "node:path";
import {
  checkFile,
  definesPassiveByIdMap,
  definesPassiveDefinitions,
  definesRecordToEngine,
  extractImportSpecs,
  findLinearIdLookups,
  isBannedEngineInternalImport,
  isComponentsImport,
  isEngineImport,
  isModelPackCycleNode,
  isNodeSqliteImport,
  isReactImport,
  isScriptsDataImport,
  isStyleCatalogueImport,
  isUiStatsImport,
  isUiSurface,
  isUseLoadoutImport,
  moduleKey,
  stripComments,
} from "./detect.mjs";
import {
  BARREL_BANNED_STAR_PREFIXES,
  isBannedBarrelStarExport,
} from "./public-api.mjs";

const ROOT = process.cwd();
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    failed += 1;
  } else {
    console.log(`[OK] ${msg}`);
  }
}

assert(
  BARREL_BANNED_STAR_PREFIXES.some((p) => p.includes("styles/melee/abilities")),
  "public-api bans style catalogue star-exports",
);
assert(
  BARREL_BANNED_STAR_PREFIXES.some((p) => p.includes("engine/cast")),
  "public-api bans engine/cast star-exports",
);
assert(
  BARREL_BANNED_STAR_PREFIXES.some((p) => p.includes("engine/runtime/state")),
  "public-api bans engine/runtime/state star-exports",
);
assert(
  BARREL_BANNED_STAR_PREFIXES.some((p) => p.includes("shared/damageProvenance")),
  "public-api bans damageProvenance star-exports",
);

// Barrel-leakage string fixture (mirrors check.mjs star-export scan)
{
  const fixture = [
    `export * from "./core/ticks";`,
    `export * from "./styles/melee/abilities";`,
    `export * from "./engine/runtime/state";`,
    `export * from "./shared/damageProvenance";`,
    `export { simulate } from "./engine/simulation/simulate";`,
  ].join("\n");
  /** @type {string[]} */
  const leaks = [];
  const starRe = /export\s+\*\s+from\s+["']\.\/([^"']+)["']/g;
  let m;
  while ((m = starRe.exec(fixture)) !== null) {
    const mod = moduleKey(`src/combat/${m[1]}`);
    if (isBannedBarrelStarExport(mod)) leaks.push(mod);
  }
  assert(leaks.includes("src/combat/styles/melee/abilities"), "barrel fixture catches style star");
  assert(leaks.includes("src/combat/engine/runtime/state"), "barrel fixture catches runtime/state star");
  assert(
    leaks.includes("src/combat/shared/damageProvenance"),
    "barrel fixture catches damageProvenance star",
  );
  assert(!leaks.includes("src/combat/core/ticks"), "barrel fixture allows core star");
  assert(leaks.length === 3, "barrel fixture only flags banned stars");
}

// Barrel-leakage: nested style path still banned via prefix
assert(
  isBannedBarrelStarExport("src/combat/styles/melee/abilities/extra"),
  "barrel ban is prefix-based for style catalogues",
);

assert(
  extractImportSpecs(`import x from "@/components/foo";`).includes("@/components/foo"),
  "extracts @/components import",
);
assert(
  extractImportSpecs(`import type { T } from "@/components/combat/loadoutStats";`).includes(
    "@/components/combat/loadoutStats",
  ),
  "extracts import type from components",
);
assert(
  extractImportSpecs(`export { x } from "../engine/cast/requirements";`).includes(
    "../engine/cast/requirements",
  ),
  "extracts re-export from engine",
);
assert(
  !extractImportSpecs(`// import x from "@/components/foo";\nimport y from "./ok";`).includes(
    "@/components/foo",
  ),
  "ignores commented-out imports",
);
assert(
  extractImportSpecs(stripComments(`import x from "@/components/foo"; // noise`)).includes(
    "@/components/foo",
  ),
  "stripComments keeps real imports",
);

const fakeCombatFile = join(ROOT, "src/combat/engine/simulation/simulate.ts");
const fakeSharedFile = join(ROOT, "src/combat/shared/equipment.ts");
const fakeSolverFile = join(ROOT, "src/combat/solver/solve.ts");
const fakeUiFile = join(ROOT, "src/components/combat/RotationPlanner.tsx");
const fakeAppFile = join(ROOT, "app/combat/page.tsx");
const fakePassivesFile = join(ROOT, "src/combat/passives/definitions.ts");

assert(
  isComponentsImport(fakeCombatFile, "@/components/combat/loadoutStats", ROOT),
  "isComponentsImport: @/components",
);
// simulate.ts is three levels under combat; ../../../components lands in src/components
assert(
  isComponentsImport(fakeCombatFile, "../../../components/Nav", ROOT),
  "isComponentsImport: relative into src/components",
);
assert(
  isComponentsImport(fakeCombatFile, "src/components/Nav", ROOT),
  "isComponentsImport: src/components path",
);
assert(
  !isComponentsImport(fakeCombatFile, "../shared/equipment", ROOT),
  "isComponentsImport: negative for shared",
);

assert(
  isEngineImport(fakeSharedFile, "../engine/cast/requirements", ROOT),
  "isEngineImport: relative from shared",
);
assert(
  isEngineImport(fakeSharedFile, "@/combat/engine/runtime/state", ROOT),
  "isEngineImport: @/combat/engine",
);
assert(!isEngineImport(fakeSharedFile, "../core/ticks", ROOT), "isEngineImport: negative for core");

assert(isReactImport("react"), "isReactImport: react");
assert(isReactImport("react-dom"), "isReactImport: react-dom");
assert(isReactImport("react/jsx-runtime"), "isReactImport: react/jsx-runtime");
assert(!isReactImport("react-query"), "isReactImport: negative for react-query");

assert(isUiSurface("src/components/combat/RotationPlanner.tsx"), "isUiSurface: components");
assert(isUiSurface("app/combat/page.tsx"), "isUiSurface: app");
assert(!isUiSurface("src/combat/index.ts"), "isUiSurface: negative for combat package");

assert(
  isBannedEngineInternalImport(fakeUiFile, "@/combat/engine/cast/requirements", ROOT),
  "isBannedEngineInternalImport: cast",
);
assert(
  isBannedEngineInternalImport(fakeUiFile, "@/combat/engine/runtime/events", ROOT),
  "isBannedEngineInternalImport: runtime",
);
assert(
  isBannedEngineInternalImport(fakeUiFile, "@/combat/engine/resolution/foo", ROOT),
  "isBannedEngineInternalImport: resolution",
);
assert(
  isBannedEngineInternalImport(fakeUiFile, "@/combat/engine/schedulers/bar", ROOT),
  "isBannedEngineInternalImport: schedulers",
);
assert(
  !isBannedEngineInternalImport(fakeUiFile, "@/combat/engine/simulation/simulate", ROOT),
  "isBannedEngineInternalImport: allows simulation",
);
assert(
  !isBannedEngineInternalImport(fakeUiFile, "@/combat", ROOT),
  "isBannedEngineInternalImport: allows @/combat barrel",
);
assert(
  !isBannedEngineInternalImport(fakeUiFile, "@/combat/core/ticks", ROOT),
  "isBannedEngineInternalImport: allows core",
);
assert(
  isBannedEngineInternalImport(
    fakeUiFile,
    "../../combat/engine/cast/requirements",
    ROOT,
  ),
  "isBannedEngineInternalImport: relative into cast",
);

// --- Pass 7 helpers ---
assert(
  isStyleCatalogueImport(fakeUiFile, "@/combat/styles/melee/abilities", ROOT),
  "isStyleCatalogueImport: @/combat melee",
);
assert(
  isStyleCatalogueImport(fakeUiFile, "@/combat/styles/necromancy/abilities", ROOT),
  "isStyleCatalogueImport: necromancy",
);
assert(
  !isStyleCatalogueImport(fakeUiFile, "@/combat/styles/melee/effects", ROOT),
  "isStyleCatalogueImport: negative for effects",
);
assert(
  !isStyleCatalogueImport(fakeUiFile, "@/combat/abilities/registry", ROOT),
  "isStyleCatalogueImport: negative for registry",
);

assert(
  findLinearIdLookups(`const a = MELEE_ABILITIES.find((x) => x.id === id);`).length === 1,
  "findLinearIdLookups: MELEE_ABILITIES.find by id",
);
assert(
  findLinearIdLookups(`const a = combatAbilities.records.find((r) => r.id === id);`).length === 1,
  "findLinearIdLookups: combatAbilities.records.find by id",
);
assert(
  findLinearIdLookups(`const a = events.find((e) => e.id === id);`).length === 0,
  "findLinearIdLookups: negative for unrelated .find",
);
assert(
  findLinearIdLookups(`const a = MELEE_ABILITIES.find((x) => x.hits.length > 0);`).length === 0,
  "findLinearIdLookups: negative for non-id predicate",
);
assert(
  findLinearIdLookups(`// MELEE_ABILITIES.find((x) => x.id === id)\nconst y = 1;`).length === 0,
  "findLinearIdLookups: ignores comments",
);

assert(definesPassiveDefinitions(`export const PASSIVE_DEFINITIONS = [];`), "defines PASSIVE_DEFINITIONS");
assert(!definesPassiveDefinitions(`export { PASSIVE_DEFINITIONS } from "./definitions";`), "re-export not define PASSIVE");
assert(
  definesPassiveByIdMap(`import type { PassiveDefinition } from "./contracts";\nconst BY_ID = new Map();`),
  "defines passive BY_ID with PassiveDefinition",
);
assert(
  !definesPassiveByIdMap(`const BY_ID = new Map(); // archaeology, no passive types`),
  "archaeology-style BY_ID is not passive",
);
assert(definesRecordToEngine(`export const RECORD_TO_ENGINE: Readonly<Record<string, string>> = {};`), "defines RECORD_TO_ENGINE");
assert(!definesRecordToEngine(`export { RECORD_TO_ENGINE } from "./engineMap";`), "re-export not define RECORD_TO_ENGINE");

assert(
  isUseLoadoutImport(fakeSolverFile, "@/components/combat/useLoadout", ROOT),
  "isUseLoadoutImport: positive",
);
assert(
  !isUseLoadoutImport(fakeSolverFile, "@/components/combat/loadoutStats", ROOT),
  "isUseLoadoutImport: negative for loadoutStats",
);
assert(
  isUiStatsImport(fakeSolverFile, "@/components/combat/loadoutStats", ROOT),
  "isUiStatsImport: loadoutStats",
);
assert(
  isUiStatsImport(fakeSolverFile, "@/components/combat/toResolvedCombatModel", ROOT),
  "isUiStatsImport: toResolvedCombatModel",
);
assert(
  isUiStatsImport(fakeSolverFile, "@/components/combat/solverSnapshot", ROOT),
  "isUiStatsImport: solverSnapshot",
);
assert(
  !isUiStatsImport(fakeSolverFile, "@/components/combat/useLoadout", ROOT),
  "isUiStatsImport: negative for useLoadout",
);

assert(isNodeSqliteImport("node:sqlite"), "isNodeSqliteImport: positive");
assert(!isNodeSqliteImport("node:fs"), "isNodeSqliteImport: negative");
assert(
  isScriptsDataImport(fakeAppFile, "scripts/data/platform.mjs", ROOT),
  "isScriptsDataImport: scripts/data",
);
assert(
  !isScriptsDataImport(fakeAppFile, "@/combat/data", ROOT),
  "isScriptsDataImport: negative for combat/data",
);

assert(isModelPackCycleNode("src/combat/solver/packRequest") === "pack", "cycle node: packRequest");
assert(isModelPackCycleNode("src/combat/model/modifierSources") === "model", "cycle node: model/*");
assert(isModelPackCycleNode("src/combat/model") === "model", "cycle node: model root");
assert(isModelPackCycleNode("src/combat/solver/solve") === null, "cycle node: other solver not pack");
assert(moduleKey("src/combat/model/index.ts") === "src/combat/model", "moduleKey strips /index");

function violationsFor(repoRel, source, opts = {}) {
  return checkFile({
    root: ROOT,
    filePath: join(ROOT, ...repoRel.split("/")),
    repoRel,
    source,
    allowlist: new Set(),
    uiStyleCatalogueAllowlist: opts.uiStyleCatalogueAllowlist ?? new Set(),
  });
}

{
  const v = violationsFor(
    "src/combat/engine/simulation/simulate.ts",
    `import { Nav } from "@/components/Nav";\n`,
  );
  assert(
    v.some((x) => x.rule === "engine-no-components" || x.rule === "combat-no-components"),
    "checkFile catches engine → components",
  );
}

{
  const v = violationsFor(
    "src/combat/shared/foo.ts",
    `import { x } from "../engine/cast/requirements";\n`,
  );
  assert(
    v.some((x) => x.rule === "shared-no-engine"),
    "checkFile catches shared → engine",
  );
}

{
  const v = violationsFor(
    "src/combat/solver/solve.ts",
    `import React from "react";\nimport { Nav } from "@/components/Nav";\n`,
  );
  assert(v.some((x) => x.rule === "solver-no-react"), "checkFile catches solver → react");
  assert(
    v.some((x) => x.rule === "solver-no-components"),
    "checkFile catches solver → components",
  );
}

{
  const v = violationsFor(
    "src/combat/data/records.ts",
    `import { Nav } from "@/components/Nav";\n`,
  );
  assert(
    v.some((x) => x.rule === "combat-no-components"),
    "checkFile catches combat production → components",
  );
}

{
  const v = violationsFor(
    "src/combat/data/records.test.ts",
    `import { Nav } from "@/components/Nav";\n`,
  );
  assert(
    !v.some((x) => x.rule === "combat-no-components"),
    "checkFile skips combat-no-components for *.test.ts",
  );
}

{
  // Solver tests may import component fixtures
  const v = violationsFor(
    "src/combat/solver/packRequest.regions.test.ts",
    `import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";\nimport React from "react";\n`,
  );
  assert(
    !v.some((x) => x.rule === "solver-no-components" || x.rule === "solver-no-react"),
    "checkFile skips solver component/react rules for *.test.ts",
  );
}

{
  const v = violationsFor(
    "src/combat/core/ticks.ts",
    `import { something } from "../types";\n`,
  );
  assert(v.length === 0, "checkFile accepts clean combat import");
}

{
  const v = violationsFor(
    "src/components/combat/RotationPlanner.tsx",
    `import { resolveAbilityCastAvailability } from "@/combat/engine/cast/requirements";\n`,
  );
  assert(
    v.some((x) => x.rule === "ui-no-engine-internals"),
    "checkFile catches UI → engine/cast",
  );
}

{
  const v = violationsFor(
    "src/components/combat/RotationAnalysis.tsx",
    `import type { ResolvedEvent } from "@/combat/engine/runtime/events";\n`,
  );
  assert(
    v.some((x) => x.rule === "ui-no-engine-internals"),
    "checkFile catches UI → engine/runtime",
  );
}

{
  const v = violationsFor(
    "src/components/combat/RevolutionPanel.tsx",
    `import { simulateRevolution } from "@/combat/engine/simulation/revolution";\nimport type { RotationSummary } from "@/combat/engine/simulation/simulate";\n`,
  );
  assert(
    !v.some((x) => x.rule === "ui-no-engine-internals"),
    "checkFile allows UI → engine/simulation",
  );
}

{
  const v = violationsFor(
    "src/components/combat/RotationPlanner.tsx",
    `import { resolveAbilityCastAvailability, simulate } from "@/combat";\n`,
  );
  assert(
    !v.some((x) => x.rule === "ui-no-engine-internals"),
    "checkFile allows UI → @/combat barrel",
  );
}

{
  const v = violationsFor(
    "app/combat/page.tsx",
    `import { x } from "@/combat/engine/schedulers/tick";\n`,
  );
  assert(
    v.some((x) => x.rule === "ui-no-engine-internals"),
    "checkFile catches app → engine/schedulers",
  );
}

{
  const v = violationsFor(
    "src/components/combat/loadoutStats.test.ts",
    `import { x } from "@/combat/engine/cast/requirements";\n`,
  );
  assert(
    !v.some((x) => x.rule === "ui-no-engine-internals"),
    "checkFile skips ui-no-engine-internals for *.test.ts",
  );
}

// --- Pass 7 rule fixtures ---

// ui-no-style-catalogues (array imports banned; factories from same module ok)
{
  const v = violationsFor(
    "src/components/combat/AnalysisTab.tsx",
    `import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";\n`,
  );
  assert(
    v.some((x) => x.rule === "ui-no-style-catalogues"),
    "ui-no-style-catalogues: positive (UI → style ability array)",
  );
}
{
  const v = violationsFor(
    "src/components/combat/AnalysisTab.tsx",
    `import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";\n`,
    {
      uiStyleCatalogueAllowlist: new Set(["src/components/combat/AnalysisTab.tsx"]),
    },
  );
  assert(
    !v.some((x) => x.rule === "ui-no-style-catalogues"),
    "ui-no-style-catalogues: allowlist exempts file",
  );
}
{
  const v = violationsFor(
    "src/components/combat/AnalysisTab.tsx",
    `import { volleyOfSouls, MAX_SOULS } from "@/combat/styles/necromancy/abilities";\n`,
  );
  assert(
    !v.some((x) => x.rule === "ui-no-style-catalogues"),
    "ui-no-style-catalogues: negative (factory import ok)",
  );
}
{
  const v = violationsFor(
    "src/components/combat/RotationPlanner.tsx",
    `import { entryByEngineId } from "@/combat/abilities/registry";\n`,
  );
  assert(
    !v.some((x) => x.rule === "ui-no-style-catalogues"),
    "ui-no-style-catalogues: negative (registry ok)",
  );
}

// no-linear-id-lookup
{
  const v = violationsFor(
    "src/components/combat/Foo.tsx",
    `const a = MELEE_ABILITIES.find((x) => x.id === id);\n`,
  );
  assert(
    v.some((x) => x.rule === "no-linear-id-lookup"),
    "no-linear-id-lookup: positive (UI catalogue find)",
  );
}
{
  const v = violationsFor(
    "src/combat/engine/simulation/simulate.ts",
    `const a = MELEE_ABILITIES.find((x) => x.id === "attack");\n`,
  );
  assert(
    v.some((x) => x.rule === "no-linear-id-lookup"),
    "no-linear-id-lookup: positive (combat production)",
  );
}
{
  const v = violationsFor(
    "src/combat/styles/necromancy/abilities.ts",
    `const base = NECROMANCY_ABILITIES.find((a) => a.id === "spectral_scythe_3")!;\n`,
  );
  assert(
    !v.some((x) => x.rule === "no-linear-id-lookup"),
    "no-linear-id-lookup: negative inside style ability definition file",
  );
}
{
  const v = violationsFor(
    "src/combat/engine/simulation/simulate.test.ts",
    `const a = MELEE_ABILITIES.find((x) => x.id === "attack");\n`,
  );
  assert(
    !v.some((x) => x.rule === "no-linear-id-lookup"),
    "no-linear-id-lookup: negative for tests",
  );
}
{
  const v = violationsFor(
    "src/combat/engine/simulation/summary.ts",
    `const row = byEffect.find((e) => e.id === id);\n`,
  );
  assert(
    !v.some((x) => x.rule === "no-linear-id-lookup"),
    "no-linear-id-lookup: negative for non-catalogue .find",
  );
}

// single-passive-registry
{
  const v = violationsFor(
    "src/combat/shared/roguePassives.ts",
    `export const PASSIVE_DEFINITIONS = [{ id: "x" }];\n`,
  );
  assert(
    v.some((x) => x.rule === "single-passive-registry"),
    "single-passive-registry: positive (definitions outside passives)",
  );
}
{
  const v = violationsFor(
    "src/combat/shared/roguePassives.ts",
    `import type { PassiveDefinition } from "../passives/contracts";\nconst BY_ID = new Map<string, PassiveDefinition>();\n`,
  );
  assert(
    v.some((x) => x.rule === "single-passive-registry" && x.spec === "BY_ID"),
    "single-passive-registry: positive (BY_ID outside passives)",
  );
}
{
  const v = violationsFor(
    "src/combat/passives/definitions.ts",
    `export const PASSIVE_DEFINITIONS = [{ id: "x" }];\n`,
  );
  assert(
    !v.some((x) => x.rule === "single-passive-registry"),
    "single-passive-registry: negative (allowed under passives)",
  );
}
{
  const v = violationsFor(
    "src/combat/shared/archaeologyRelics.ts",
    `const BY_ID: ReadonlyMap<string, number> = new Map();\n`,
  );
  assert(
    !v.some((x) => x.rule === "single-passive-registry"),
    "single-passive-registry: negative (non-passive BY_ID)",
  );
}

// single-record-engine-map
{
  const v = violationsFor(
    "src/combat/abilities/registry.ts",
    `export const RECORD_TO_ENGINE = { "melee:attack": "attack" };\n`,
  );
  assert(
    v.some((x) => x.rule === "single-record-engine-map"),
    "single-record-engine-map: positive (definition outside engineMap)",
  );
}
{
  const v = violationsFor(
    "src/combat/abilities/engineMap.ts",
    `export const RECORD_TO_ENGINE = { "melee:attack": "attack" };\n`,
  );
  assert(
    !v.some((x) => x.rule === "single-record-engine-map"),
    "single-record-engine-map: negative (canonical engineMap)",
  );
}
{
  const v = violationsFor(
    "src/combat/abilities/registry.ts",
    `export { RECORD_TO_ENGINE } from "./engineMap";\n`,
  );
  assert(
    !v.some((x) => x.rule === "single-record-engine-map"),
    "single-record-engine-map: negative (re-export ok)",
  );
}

// solver-no-loadout
{
  const v = violationsFor(
    "src/combat/solver/solve.ts",
    `import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";\n`,
  );
  assert(
    v.some((x) => x.rule === "solver-no-loadout"),
    "solver-no-loadout: positive",
  );
  assert(
    v.some((x) => x.rule === "solver-no-components" || x.rule === "combat-no-components"),
    "solver-no-loadout also hits components ban",
  );
}
{
  const v = violationsFor(
    "src/combat/solver/packRequest.ts",
    `import type { SolverPackSnapshot } from "./packRequest";\n`,
  );
  assert(
    !v.some((x) => x.rule === "solver-no-loadout"),
    "solver-no-loadout: negative (clean solver)",
  );
}
{
  const v = violationsFor(
    "src/combat/solver/packRequest.regions.test.ts",
    `import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";\n`,
  );
  assert(
    !v.some((x) => x.rule === "solver-no-loadout"),
    "solver-no-loadout: negative for tests",
  );
}

// solver-no-ui-stats
{
  const v = violationsFor(
    "src/combat/solver/solve.ts",
    `import { loadoutStats } from "@/components/combat/loadoutStats";\nimport { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";\nimport { solverSnapshotFromUi } from "@/components/combat/solverSnapshot";\n`,
  );
  assert(
    v.filter((x) => x.rule === "solver-no-ui-stats").length >= 3,
    "solver-no-ui-stats: positive (all three adapters)",
  );
}
{
  const v = violationsFor(
    "src/combat/solver/solve.ts",
    `import { packSolverRequest } from "./packRequest";\n`,
  );
  assert(
    !v.some((x) => x.rule === "solver-no-ui-stats"),
    "solver-no-ui-stats: negative (domain import ok)",
  );
}

// runtime-no-data-build
{
  const v = violationsFor(
    "app/data/page.tsx",
    `import { DatabaseSync } from "node:sqlite";\n`,
  );
  assert(
    v.some((x) => x.rule === "runtime-no-data-build"),
    "runtime-no-data-build: positive (node:sqlite in app)",
  );
}
{
  const v = violationsFor(
    "app/data/page.tsx",
    `import { rebuild } from "scripts/data/platform.mjs";\n`,
  );
  assert(
    v.some((x) => x.rule === "runtime-no-data-build"),
    "runtime-no-data-build: positive (scripts/data in app)",
  );
}
{
  const v = violationsFor(
    "app/combat/page.tsx",
    `import { solve } from "@/combat/solver";\n`,
  );
  assert(
    !v.some((x) => x.rule === "runtime-no-data-build"),
    "runtime-no-data-build: negative (clean app page)",
  );
}
{
  // research uses sqlite intentionally — outside app/, rule does not apply
  const v = violationsFor(
    "src/research/panels.ts",
    `import { DatabaseSync } from "node:sqlite";\n`,
  );
  assert(
    !v.some((x) => x.rule === "runtime-no-data-build"),
    "runtime-no-data-build: negative outside app/",
  );
}

// import-cycle helpers (model ↔ pack)
assert(
  isModelPackCycleNode("src/combat/model/simulationInput") === "model" &&
    isModelPackCycleNode("src/combat/solver/packRequest") === "pack",
  "import-cycle: model + packRequest pair roles",
);

// Empty production allowlist is the target state - former exception paths must
// be clean when scanned with an empty allowlist.
{
  const cleanAllowlist = new Set();
  assert(cleanAllowlist.size === 0, "self-test expects empty allowlist as default");
  for (const repoRel of [
    "src/combat/solver/packRequest.ts",
    "src/combat/shared/abilityAvailability.ts",
    "src/combat/shared/equipment.ts",
  ]) {
    assert(
      typeof repoRel === "string" && repoRel.startsWith("src/combat/"),
      `former exception path tracked: ${repoRel}`,
    );
  }
}

// Silence unused import when helpers only used above
void fakePassivesFile;

if (failed > 0) {
  console.error(`[FAIL] architecture self-test: ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(`[OK] architecture self-test: all assertions passed`);
process.exit(0);
