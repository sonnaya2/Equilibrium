/**
 * Self-test for architecture detectors.
 * Proves forbidden import patterns are caught; allowed patterns are not.
 *
 *   node scripts/architecture/check.self-test.mjs
 */
import { join } from "node:path";
import {
  checkFile,
  extractImportSpecs,
  isComponentsImport,
  isEngineImport,
  isReactImport,
  stripComments,
} from "./detect.mjs";

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

// --- unit: extract / strip -------------------------------------------------
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

// --- unit: classifiers -----------------------------------------------------
const fakeCombatFile = join(ROOT, "src/combat/engine/simulation/simulate.ts");
const fakeSharedFile = join(ROOT, "src/combat/shared/equipment.ts");
const fakeSolverFile = join(ROOT, "src/combat/solver/solve.ts");

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

// --- integration: checkFile rules fire on synthetic sources ----------------
function violationsFor(repoRel, source) {
  return checkFile({
    root: ROOT,
    filePath: join(ROOT, ...repoRel.split("/")),
    repoRel,
    source,
    allowlist: new Set(),
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
  // Tests are exempt from combat-no-components
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
  // Solver tests may import component fixtures (production solver still gated)
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
  // Clean production file
  const v = violationsFor(
    "src/combat/core/ticks.ts",
    `import { something } from "../types";\n`,
  );
  assert(v.length === 0, "checkFile accepts clean combat import");
}

if (failed > 0) {
  console.error(`[FAIL] architecture self-test: ${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(`[OK] architecture self-test: all assertions passed`);
process.exit(0);
