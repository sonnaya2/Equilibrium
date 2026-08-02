import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

function walk(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", ".next", "dist", ".git", ".cache"].includes(ent.name)) continue;
      walk(p, acc);
    } else if (ent.name.endsWith(".test.ts") || ent.name.endsWith(".spec.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function domainFor(path) {
  const p = path.replace(/\\/g, "/");
  if (p.startsWith("e2e/")) return "e2e";
  if (p.includes("/combat/solver/")) return "solver";
  if (p.includes("/combat/engine/")) return "simulation";
  if (p.includes("/combat/styles/") || p.includes("/combat/abilities/")) return "abilities";
  if (
    p.includes("/combat/core/") ||
    p.includes("/combat/pipeline/") ||
    p.includes("/combat/shared/") ||
    p.includes("/combat/target/") ||
    p.includes("/combat/league/")
  ) {
    return "combat-core";
  }
  if (p.includes("/combat/data/")) return "data";
  if (p.includes("/combat/test/")) return "simulation";
  if (p.includes("/components/")) return "components";
  if (
    p.includes("/league/") ||
    p.includes("/tasks/") ||
    p.includes("/map/") ||
    p.includes("/research/")
  ) {
    return "app-domain";
  }
  if (p.includes("/lib/")) return "lib";
  if (p.includes("/combat/")) return "combat-other";
  return "other";
}

function countTopLevelArrayElements(src, openBracketIndex) {
  let depth = 0;
  let inStr = null;
  let esc = false;
  let end = openBracketIndex;
  for (let j = openBracketIndex; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  const arr = src.slice(openBracketIndex, end + 1);
  let top = 0;
  let d = 0;
  let s = null;
  let e = false;
  let nonempty = false;
  for (let k = 1; k < arr.length - 1; k++) {
    const c = arr[k];
    if (s) {
      if (e) {
        e = false;
        continue;
      }
      if (c === "\\") {
        e = true;
        continue;
      }
      if (c === s) s = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      s = c;
      nonempty = true;
      continue;
    }
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === "," && d === 0) top++;
    else if (!/\s/.test(c)) nonempty = true;
  }
  return nonempty ? top + 1 : 0;
}

function countWithEach(content) {
  let total = 0;
  let skipCases = 0;
  let todoCases = 0;
  let onlyCases = 0;

  const eachRe = /\b(?:it|test)(\.(?:skip|todo|only|failing))*(?:\.each)\s*\(/g;
  let match;
  while ((match = eachRe.exec(content))) {
    const kind = match[1] || "";
    let i = match.index + match[0].length;
    while (i < content.length && /\s/.test(content[i])) i++;
    let rows = 1;
    if (content[i] === "[") {
      rows = countTopLevelArrayElements(content, i) || 1;
    }
    total += rows;
    if (kind.includes("skip")) skipCases += rows;
    if (kind.includes("todo")) todoCases += rows;
    if (kind.includes("only")) onlyCases += rows;
  }

  const plainRe = /\b(?:it|test)(\.(?:skip|todo|only|failing))*(?!\.each)\s*\(/g;
  while ((match = plainRe.exec(content))) {
    const kind = match[1] || "";
    total += 1;
    if (kind.includes("skip")) skipCases += 1;
    if (kind.includes("todo")) todoCases += 1;
    if (kind.includes("only")) onlyCases += 1;
  }

  return { total, skipCases, todoCases, onlyCases };
}

const root = process.cwd();
const files = walk(root).filter((f) => {
  const r = relative(root, f).replace(/\\/g, "/");
  return r.startsWith("src/") || r.startsWith("e2e/");
});

const byDomain = {};
const fileRows = [];
let totalCases = 0;
let totalSkip = 0;
let totalTodo = 0;
let totalOnly = 0;

for (const f of files) {
  const rel = relative(root, f).replace(/\\/g, "/");
  const content = readFileSync(f, "utf8");
  const { total, skipCases, todoCases, onlyCases } = countWithEach(content);
  const domain = domainFor(rel);
  byDomain[domain] ??= { files: 0, tests: 0 };
  byDomain[domain].files++;
  byDomain[domain].tests += total;
  totalCases += total;
  totalSkip += skipCases;
  totalTodo += todoCases;
  totalOnly += onlyCases;
  fileRows.push({
    path: rel,
    domain,
    currentTests: total,
    skip: skipCases,
    todo: todoCases,
    only: onlyCases,
  });
}

fileRows.sort((a, b) => b.currentTests - a.currentTests || a.path.localeCompare(b.path));

const out = {
  fileCount: files.length,
  totalCases,
  totalSkip,
  totalTodo,
  totalOnly,
  vitestFiles: files.filter((f) => f.endsWith(".test.ts")).length,
  e2eFiles: files.filter((f) => relative(root, f).replace(/\\/g, "/").startsWith("e2e/")).length,
  byDomain,
  files: fileRows,
};

mkdirSync(join(root, "reports"), { recursive: true });
writeFileSync(join(root, "reports", "_inventory_raw.json"), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      fileCount: out.fileCount,
      totalCases: out.totalCases,
      totalSkip: out.totalSkip,
      totalTodo: out.totalTodo,
      totalOnly: out.totalOnly,
      vitestFiles: out.vitestFiles,
      e2eFiles: out.e2eFiles,
      byDomain: out.byDomain,
      top20: out.files.slice(0, 20),
    },
    null,
    2,
  ),
);
