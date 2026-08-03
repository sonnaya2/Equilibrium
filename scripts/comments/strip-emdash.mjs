// One-shot: replace em/en dash in full-line // and line-started block comments only.
// Does not collapse spaces or join star lines. Safe for regex/string content.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "public",
  "dist",
  "playwright-report",
  "test-results",
  "reports",
  ".cache",
  ".generated",
  "tools",
]);
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.name.startsWith(".") && e.name !== ".github") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

function cleanBody(s) {
  return s.replace(/\s*\u2014\s*/g, " - ").replace(/\s*\u2013\s*/g, "-");
}

function transform(src) {
  const nl = src.includes("\r\n") ? "\r\n" : "\n";
  const lines = src.split(/\r?\n/);
  let changed = false;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*\/\//.test(line)) {
      const m = line.match(/^(\s*\/\/)(.*)$/);
      const c = cleanBody(m[2]);
      if (c !== m[2]) changed = true;
      out.push(m[1] + c);
      continue;
    }

    if (/^\s*\/\*/.test(line)) {
      if (line.includes("*/")) {
        const c = cleanBody(line);
        if (c !== line) changed = true;
        out.push(c);
        continue;
      }
      const block = [line];
      let j = i + 1;
      while (j < lines.length) {
        block.push(lines[j]);
        if (lines[j].includes("*/")) break;
        j++;
      }
      const text = block.join("\n");
      const cleaned = cleanBody(text);
      if (cleaned !== text) changed = true;
      for (const bl of cleaned.split("\n")) out.push(bl);
      i = j;
      continue;
    }

    // Mid-line // after code (even quote count heuristic)
    const mid = line.match(/^(.*?)(\/\/)(.*)$/);
    if (mid && !/https?:$/.test(mid[1].trimEnd())) {
      const before = mid[1];
      const dq = (before.match(/"/g) || []).length;
      const sq = (before.match(/'/g) || []).length;
      const bq = (before.match(/`/g) || []).length;
      if (dq % 2 === 0 && sq % 2 === 0 && bq % 2 === 0) {
        const c = cleanBody(mid[3]);
        if (c !== mid[3]) {
          changed = true;
          out.push(before + mid[2] + c);
          continue;
        }
      }
    }

    out.push(line);
  }

  if (!changed) return null;
  let text = out.join(nl);
  if ((src.endsWith("\n") || src.endsWith("\r\n")) && !text.endsWith("\n")) text += nl;
  return text;
}

let n = 0;
for (const f of walk(ROOT)) {
  const src = fs.readFileSync(f, "utf8");
  const next = transform(src);
  if (!next) continue;
  fs.writeFileSync(f, next);
  n++;
}
console.log(`strip-emdash: edited ${n} files`);
