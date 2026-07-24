import { readFileSync } from "node:fs";

const dependencies = JSON.parse(readFileSync("scraped-data/region-dependencies.json", "utf8"));
const questRules = JSON.parse(readFileSync("data/league/quest-region-rules.json", "utf8"));

const errors = [];
const fail = (message) => errors.push(message);
const lower = (value) => String(value ?? "").toLowerCase();

function requireHttpsSources(row, label) {
  const urls = row?.source_urls || [];
  if (!Array.isArray(urls) || !urls.length) fail(`${label} needs source_urls`);
  for (const url of urls) {
    try {
      if (new URL(url).protocol !== "https:") fail(`${label} source must use https: ${url}`);
    } catch {
      fail(`${label} has invalid source URL: ${url}`);
    }
  }
}

const unmappedTerms = new Set((questRules.unmapped_terms || []).map(lower));
for (const term of ["the arc", "waiko", "wushanko"]) {
  if (!unmappedTerms.has(term)) fail(`quest boundary rules must keep ${term} unmapped`);
}

const asgarnia = (questRules.regions || []).find((region) => region.id === "asgarnia");
if (!(asgarnia?.terms || []).map(lower).includes("port sarim")) {
  fail("Port Sarim should remain an Asgarnia start/departure-area term");
}

const arcQuest = questRules.overrides?.["Impressing the Locals"];
if (arcQuest?.primary_region !== "unmapped") {
  fail("Impressing the Locals must stay unmapped; Port Sarim does not prove The Arc is Asgarnia");
}
if (!lower(arcQuest?.reason).includes("port sarim") || !lower(arcQuest?.reason).includes("arc")) {
  fail("Impressing the Locals override must explain the Port Sarim / Arc boundary");
}

const hardRows = [
  ...(dependencies.boundary_overrides || []),
  ...(dependencies.dependencies || []),
];
for (const row of hardRows) {
  const text = lower(`${row.content} ${(row.includes || []).join(" ")}`);
  if ((text.includes("the arc") || text.includes("wushanko") || text.includes("waiko")) && row.required_region) {
    fail(`The Arc/Wushanko must not appear as a hard region row: ${row.content}`);
  }
}

const arc = (dependencies.cross_boundary_cases || []).find((row) => row.content === "The Arc / Wushanko Isles");
if (!arc) {
  fail("missing The Arc / Wushanko cross-boundary case");
} else {
  if (arc.planner_status !== "unresolved_external_region") fail("The Arc must stay unresolved_external_region");
  if (arc.entry_side?.working_region !== "asgarnia" || arc.entry_side?.location !== "Port Sarim") {
    fail("The Arc entry side must preserve Port Sarim/Asgarnia as departure context only");
  }
  if (arc.destination_side?.geographic_region !== "unmapped") fail("The Arc destination must stay unmapped");
  if (!(arc.access_requirements || []).includes("Impressing the Locals")) fail("The Arc must retain Impressing the Locals access dependency");
  if (!lower(arc.planner_rule).includes("do not classify") || !lower(arc.planner_rule).includes("asgarnia")) {
    fail("The Arc planner rule must explicitly reject the Port-Sarim-means-Asgarnia shortcut");
  }
  requireHttpsSources(arc, "The Arc / Wushanko");
}

const daemonheim = (dependencies.dependencies || []).find((row) => row.content === "Daemonheim");
if (daemonheim?.required_region !== "forinthry" || daemonheim?.hard_requirement !== true) {
  fail("Daemonheim must remain a hard Forinthry dependency");
}

for (const content of ["Fort Forinthry", "City of Um / Underworld"]) {
  const row = (dependencies.boundary_overrides || []).find((entry) => entry.content === content);
  if (row?.required_region !== "misthalin" || !lower(row?.confidence).includes("historical")) {
    fail(`${content} must remain provisional Misthalin historical-League taxonomy`);
  }
}

const northern = (dependencies.boundary_overrides || []).find((row) => row.content === "northern Asgarnia route");
if (northern?.required_region !== "asgarnia") fail("northern Asgarnia route must remain Asgarnia");
for (const place of ["Burthorpe", "Death Plateau", "Trollheim", "Troll Stronghold", "God Wars Dungeon approach"]) {
  if (!(northern?.includes || []).includes(place)) fail(`northern Asgarnia route is missing ${place}`);
}

const zamorak = (dependencies.cross_boundary_cases || []).find((row) => lower(row.content).includes("zamorakian undercity"));
if (zamorak?.planner_status !== "unresolved_cross_boundary") {
  fail("Zamorakian Undercity must remain unresolved_cross_boundary");
}

if (errors.length) {
  console.error("REGION BOUNDARY AUDIT FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Region boundary audit passed: ${hardRows.length} hard/working rows, ${(dependencies.cross_boundary_cases || []).length} explicit cross-boundary cases.`);
}
