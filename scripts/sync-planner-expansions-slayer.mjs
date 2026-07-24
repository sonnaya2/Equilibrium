import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

const supplements = [
  {
    input: "scraped-data/planner-expansions-slayer.json",
    output: "data/research/planner-expansions-slayer.json",
    requiredArrays: ["slayer_methods", "invention_component_chains", "archaeology_relic_acquisition", "stale_method_corrections"],
  },
  {
    input: "scraped-data/planner-expansions-slayer-collection.json",
    output: "data/research/planner-expansions-slayer-collection.json",
    requiredArrays: ["slayer_methods"],
  },
  {
    input: "scraped-data/planner-expansions-slayer-edge.json",
    output: "data/research/planner-expansions-slayer-edge.json",
    requiredArrays: ["slayer_methods"],
  },
];

const allSlayerIds = [];

for (const supplement of supplements) {
  const inputPath = join(ROOT, supplement.input);
  const outputPath = join(ROOT, supplement.output);
  const data = JSON.parse(readFileSync(inputPath, "utf8"));

  for (const key of supplement.requiredArrays) {
    if (!Array.isArray(data[key])) throw new Error(`${supplement.input} is missing array: ${key}`);
  }

  for (const section of supplement.requiredArrays) {
    for (const [index, row] of data[section].entries()) {
      if (typeof row.source_url !== "string" || !row.source_url.startsWith("https://")) {
        throw new Error(`${supplement.input}:${section}[${index}] is missing a valid source_url`);
      }
    }
  }

  allSlayerIds.push(...data.slayer_methods.map((row) => row.id));
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
}

if (new Set(allSlayerIds).size !== allSlayerIds.length) {
  throw new Error("Duplicate Slayer method id detected across planner supplements");
}

console.log("Synced Slayer planner supplements:", {
  files: supplements.length,
  slayerMethods: allSlayerIds.length,
});
