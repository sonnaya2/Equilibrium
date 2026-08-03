// Fail CI when comments look like AI slop (em/en dash, lecture stock, banners).
// Line-based only: full-line // and line-started block comments. Strings/regexes ignored.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const BANNED = [
  /Behavior-preserving/i,
  /only honest default/i,
  /fake zero/i,
  /no default is invented/i,
  /ensures that/i,
  /This module is responsible/i,
  /\bIn order to\b/i,
];

const EMDASH = /\u2014|\u2013/;
const BANNER = /^\s*\/\/\s*[-=]{3,}/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".github") {
      if (SKIP_DIRS.has(e.name)) continue;
    }
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

/** @returns {{ file: string, line: number, rule: string, text: string }[]} */
export function checkSource(filePath, source) {
  const findings = [];
  const lines = source.split(/\r?\n/);
  const file = rel(filePath);

  const push = (line, rule, text) => {
    findings.push({ file, line, rule, text: text.trim().slice(0, 160) });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;

    if (BANNER.test(line)) {
      push(n, "section-banner", line);
      continue;
    }

    if (/^\s*\/\//.test(line)) {
      scanCommentText(line, n, push);
      continue;
    }

    if (/^\s*\/\*/.test(line)) {
      if (line.includes("*/")) {
        scanCommentText(line, n, push);
        continue;
      }
      let j = i;
      const block = [line];
      while (j + 1 < lines.length) {
        j++;
        block.push(lines[j]);
        if (lines[j].includes("*/")) break;
      }
      const text = block.join("\n");
      // Attribute all hits to the open line for stable reporting
      scanCommentText(text, n, push);
      i = j;
    }
  }

  return findings;
}

function scanCommentText(text, lineNo, push) {
  if (EMDASH.test(text)) {
    push(lineNo, "em-or-en-dash", text.split(/\r?\n/)[0]);
  }
  for (const re of BANNED) {
    if (re.test(text)) {
      push(lineNo, "banned-phrase", `${re} :: ${text.split(/\r?\n/)[0]}`);
    }
  }
}

function main() {
  const files = walk(ROOT);
  const all = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    all.push(...checkSource(f, src));
  }

  if (all.length === 0) {
    console.log(`[audit:comments] OK (${files.length} files)`);
    process.exit(0);
  }

  console.error(`[audit:comments] FAIL ${all.length} finding(s):\n`);
  for (const f of all) {
    console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.text}`);
  }
  console.error(
    "\nComments: ASCII only for dashes; no lecture stock. See AGENTS.md. Fix or delete the comment.",
  );
  process.exit(1);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
const self = fileURLToPath(import.meta.url);
if (entry === self) main();
