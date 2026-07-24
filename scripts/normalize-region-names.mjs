import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = ["scraped-data", "data", "src", "app"];
const TEXT_EXTENSIONS = new Set([".json", ".ts", ".tsx", ".md", ".txt"]);
const retired = ["Troll", " Country"].join("");
const retiredLower = retired.toLowerCase();

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(full));
    else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function normalize(content) {
  return content
    .replaceAll(`Asgarnia + ${retired}`, "Asgarnia")
    .replaceAll(retired, "Asgarnia")
    .replaceAll(retiredLower, "asgarnia");
}

let changed = 0;
for (const root of SCAN_ROOTS) {
  for (const file of await filesUnder(join(ROOT, root))) {
    const before = await readFile(file, "utf8");
    const after = normalize(before);
    if (after === before) continue;
    await writeFile(file, after);
    changed += 1;
    console.log(`normalized ${file.slice(ROOT.length + 1)}`);
  }
}

console.log(`REGION NORMALIZE: ${changed} file(s) changed`);
