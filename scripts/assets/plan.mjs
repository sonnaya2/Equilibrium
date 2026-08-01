/**
 * Computes which source file serves which public path.
 *
 * The publisher and the icon-index generator must agree exactly, so they share
 * this one function. It reads assets/ and the catalog only - never public/.
 */
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { TREES, publicTargetFor } from "./routes.mjs";
import { loadCatalog } from "./catalog.mjs";

const fwd = (p) => p.split(sep).join("/");

async function walk(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return acc;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

/**
 * @returns {{targets: Map<string, {abs: string, sourcePath: string}>, collisions: object[], sourceFiles: object[]}}
 * `targets` is keyed by public path relative to public/ (e.g. "game/skills/agility.webp").
 */
export async function planPublish(root = process.cwd()) {
  const targets = new Map();
  const collisions = [];
  const caseIndex = new Map();
  const sourceFiles = [];

  const claim = (target, abs, sourcePath) => {
    const existing = targets.get(target);
    if (existing) {
      collisions.push({ target, sources: [existing.sourcePath, sourcePath] });
      return;
    }
    targets.set(target, { abs, sourcePath });
    const lower = target.toLowerCase();
    const seen = caseIndex.get(lower);
    if (seen && seen !== target) {
      collisions.push({ target, sources: [seen, target], reason: "case collision" });
    }
    caseIndex.set(lower, target);
  };

  // One file can serve several public paths: when two resolvers want the same
  // picture at different URLs the catalog lists the extras under `publish`,
  // instead of the tree holding a second copy of the bytes.
  const extras = new Map();
  for (const row of (await loadCatalog()).assets) {
    if (row.publish?.length) extras.set(row.path.toLowerCase(), row.publish);
  }

  for (const { source } of TREES) {
    for (const abs of await walk(join(root, source))) {
      const rel = fwd(relative(join(root, source), abs));
      const sourcePath = `${source}/${rel}`;
      sourceFiles.push({ tree: source, rel, abs, path: sourcePath });
      const target = publicTargetFor(source, rel);
      if (!target) continue;
      claim(target, abs, sourcePath);
      for (const extra of extras.get(sourcePath.replace(/\.[^./]+$/, "").toLowerCase()) ?? []) {
        claim(extra, abs, sourcePath);
      }
    }
  }
  return { targets, collisions, sourceFiles };
}
