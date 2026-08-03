/**
 * Verifies every hand-written public art path still resolves.

 * src/lib/rewardIconAliases.ts maps reward labels to /game/... paths by hand, so
 * nothing regenerates it and nothing catches a rename. This reads the literals
 * back out and checks each one against the published tree.

 *   node scripts/assets/check-aliases.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SOURCES = ["src/lib/rewardIconAliases.ts", "src/lib/gameArt.ts", "src/components/BuildPlanner.tsx"];

/** Helper factories build paths from a template, so collect both forms. */
const LITERAL = /["'`](\/(?:game|brand)\/[^"'`$]+\.(?:webp|png|jpe?g|gif))["'`]/g;
const TEMPLATE = /`(\/(?:game|brand)\/[^`]*\$\{[^`]*)`/g;

const missing = [];
let checked = 0;
const templates = [];

for (const file of SOURCES) {
  const text = readFileSync(join(ROOT, file), "utf8");
  for (const [, path] of text.matchAll(LITERAL)) {
    checked++;
    if (!existsSync(join(ROOT, "public", path.slice(1)))) missing.push({ file, path });
  }
  for (const [, path] of text.matchAll(TEMPLATE)) templates.push({ file, path });
}

console.log(`ALIAS CHECK: ${checked} literal paths, ${missing.length} missing`);
for (const entry of missing) console.log(`  MISSING: ${entry.path}  (${entry.file})`);
if (templates.length) {
  // Dynamic paths are covered by the vitest suites, which resolve them against
  // real dataset records; listed here only so the split in coverage is visible.
  console.log(`  ${templates.length} template paths deferred to src/lib/gameArt.test.ts`);
}
process.exit(missing.length ? 1 : 0);
