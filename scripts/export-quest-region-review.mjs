import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(await readFile("data/league/quests.json", "utf8"));
const review = data.quests
  .filter((quest) => quest.primary_region === "unmapped")
  .map((quest) => ({
    title: quest.title,
    start_area: quest.start_area,
    series: quest.series,
    mapping_reason: quest.mapping_reason,
    source_url: quest.source_url,
    source_revision: quest.source_revision,
    source_revision_timestamp: quest.source_revision_timestamp,
  }));

await writeFile(
  "data/league/quest-region-review.json",
  `${JSON.stringify({
    generated_at: data.generated_at,
    source_revisions: data.source_revisions,
    count: review.length,
    rule: "Resolve only when the Equilibrium boundary is known. Add stable mappings to quest-region-rules.json; keep genuinely unresolved League boundaries here.",
    quests: review,
  }, null, 2)}\n`,
);

console.log(`QUEST REGION REVIEW: ${review.length}`);
