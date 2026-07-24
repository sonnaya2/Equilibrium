import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const STATE_PATH = join(ROOT, "data/league/equilibrium-auto-quests.json");
const QUESTS_PATH = join(ROOT, "data/league/quests.json");
const USER_AGENT = "EquilibriumQuestSync/1.0 (https://github.com/sonnaya2/Equilibrium)";

const REGION_TERMS = {
  misthalin: ["misthalin"],
  havenhythe: ["havenhythe"],
  karamja: ["karamja"],
  asgarnia: ["asgarnia"],
  kandarin: ["kandarin"],
  fremennik: ["fremennik"],
  forinthry: ["forinthry", "wilderness"],
  desert: ["desert", "kharidian"],
  morytania: ["morytania"],
  tirannwn: ["tirannwn"],
  anachronia: ["anachronia"],
};

function plain(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sections(html) {
  const matches = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  return matches.map((match, index) => ({
    heading: plain(match[2]),
    body: html.slice(match.index + match[0].length, matches[index + 1]?.index ?? html.length),
  }));
}

function regionForHeading(heading) {
  const value = heading.toLowerCase();
  for (const [region, terms] of Object.entries(REGION_TERMS)) {
    if (terms.some((term) => value.includes(term))) return region;
  }
  return null;
}

function explicitAutocomplete(text) {
  return /auto[- ]?complet|quests?[^.]{0,80}(?:completed|complete)|completed[^.]{0,80}quests?/i.test(text);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

const state = JSON.parse(await readFile(STATE_PATH, "utf8"));
let questData;
try {
  questData = JSON.parse(await readFile(QUESTS_PATH, "utf8"));
} catch {
  console.log("AUTO QUEST SYNC: quest catalog not generated yet; skipping");
  process.exit(0);
}

const questTitles = questData.quests.map((quest) => quest.title);
const found = new Map();

for (const sourceUrl of state.official_source_urls) {
  let html;
  try {
    html = await fetchHtml(sourceUrl);
  } catch (error) {
    console.warn(`SOURCE FAILED ${sourceUrl}: ${error}`);
    continue;
  }

  for (const section of sections(html)) {
    const region = regionForHeading(section.heading);
    if (!region) continue;
    const text = plain(section.body);
    if (!explicitAutocomplete(text)) continue;

    for (const title of questTitles) {
      if (!text.toLowerCase().includes(title.toLowerCase())) continue;
      const key = `${region}|${title}`;
      if (!found.has(key)) found.set(key, { region, title, sourceUrl });
    }
  }
}

if (!found.size) {
  console.log("AUTO QUEST SYNC: no new official per-region quest lists detected");
  process.exit(0);
}

let changed = false;
const now = new Date().toISOString();
for (const { region, title, sourceUrl } of found.values()) {
  const bucket = state.regions[region];
  if (!bucket) continue;
  if (!bucket.auto_completed_quests.includes(title)) {
    bucket.auto_completed_quests.push(title);
    bucket.auto_completed_quests.sort((a, b) => a.localeCompare(b));
    changed = true;
  }
  if (!bucket.source_urls.includes(sourceUrl)) bucket.source_urls.push(sourceUrl);
  bucket.detected_at = now;
}

if (!changed) {
  console.log("AUTO QUEST SYNC: official matches already recorded");
  process.exit(0);
}

state.last_checked_at = now;
state.status = "official_lists_detected";

const sourcesByQuest = new Map();
for (const [region, bucket] of Object.entries(state.regions)) {
  for (const title of bucket.auto_completed_quests) {
    const current = sourcesByQuest.get(title) ?? { regions: [], source_urls: [] };
    current.regions.push(region);
    current.source_urls.push(...bucket.source_urls);
    sourcesByQuest.set(title, current);
  }
}

questData.quests = questData.quests.map((quest) => {
  const official = sourcesByQuest.get(quest.title);
  if (!official) return quest;
  return {
    ...quest,
    equilibrium_auto_completion: {
      status: "official_jagex_auto_completed",
      regions: [...new Set(official.regions)].sort(),
      source_urls: [...new Set(official.source_urls)].sort(),
    },
  };
});

await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
await writeFile(QUESTS_PATH, `${JSON.stringify(questData, null, 2)}\n`);
console.log(`AUTO QUEST SYNC: added ${found.size} official region/quest match(es)`);
