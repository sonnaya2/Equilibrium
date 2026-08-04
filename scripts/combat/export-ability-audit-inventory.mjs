/** Wrapper: npx tsx scripts/combat/_export-ability-audit-inventory.ts */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const helper = path.join(root, "scripts/combat/_export-ability-audit-inventory.ts");
const r = spawnSync("npx", ["tsx", helper], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
  shell: true,
});
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
