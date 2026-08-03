// Self-test for scripts/comments/check.mjs
import assert from "node:assert/strict";
import { checkSource } from "./check.mjs";

function run(label, src, expectRules) {
  const hits = checkSource("fixture.ts", src);
  const rules = hits.map((h) => h.rule);
  for (const r of expectRules) {
    assert.ok(rules.includes(r), `${label}: expected rule ${r}, got ${JSON.stringify(hits)}`);
  }
  if (expectRules.length === 0) {
    assert.equal(hits.length, 0, `${label}: expected clean, got ${JSON.stringify(hits)}`);
  }
}

// Em-dash in // comment fails
run(
  "line comment emdash",
  `const x = 1;\n// foo — bar\n`,
  ["em-or-en-dash"],
);

// Em-dash in JSDoc fails
run(
  "jsdoc emdash",
  `/** Final only — never a DTO. */\nexport const a = 1;\n`,
  ["em-or-en-dash"],
);

// Em-dash in string passes
run(
  "string emdash ok",
  `const s = "hello — world";\nconst t = \`a — b\`;\n`,
  [],
);

// Em-dash in regex-ish string passes
run(
  "regex string ok",
  `const re = /[—–]/;\n// wait that is a comment without dash\nconst ok = 1;\n`,
  [],
);

// Banner fails
run(
  "banner",
  `// --- helpers ---\nfunction f() {}\n`,
  ["section-banner"],
);

// Banned phrase fails
run(
  "banned",
  `// Behavior-preserving extraction of the helper\n`,
  ["banned-phrase"],
);

// Clean domain comment passes
run(
  "clean",
  `/** Strength cape (99): Dismember +3 bleed hits. */\nexport function x() {}\n// Planted Feet: Sunshine duration x1.25\n`,
  [],
);

// Multi-line block with en-dash fails
run(
  "en-dash block",
  `/**\n * Coastline – long open coast.\n */\n`,
  ["em-or-en-dash"],
);

console.log("[audit:comments:self-test] OK");
