import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const equipment = JSON.parse(fs.readFileSync(path.join(root, "data/combat/equipment.json"), "utf8"));
const records = Array.isArray(equipment.records) ? equipment.records : [];
const API = "https://runescape.wiki/api.php";
const UA = "EquilibriumEquipmentRegionAudit/1.0 (https://github.com/sonnaya2/Equilibrium)";
const BATCH = 40;

const categoryRegions = new Map([
  ["Category:Havenhythe", "havenhythe"],
  ["Category:Karamja", "karamja"],
  ["Category:Asgarnia", "asgarnia"],
  ["Category:Kandarin", "kandarin"],
  ["Category:Fremennik Province", "fremennik"],
  ["Category:Fremennik Isles", "fremennik"],
  ["Category:Forinthry", "forinthry"],
  ["Category:Wilderness", "forinthry"],
  ["Category:Kharidian Desert", "desert"],
  ["Category:Desert", "desert"],
  ["Category:Morytania", "morytania"],
  ["Category:Tirannwn", "tirannwn"],
  ["Category:Anachronia", "anachronia"],
  ["Category:Misthalin", "misthalin"],
]);

function wikiTitle(record) {
  const source = record.sources?.find((entry) => entry?.url?.includes("runescape.wiki/w/"));
  if (source?.url) {
    try {
      const url = new URL(source.url);
      return decodeURIComponent(url.pathname.replace(/^\/w\//, "")).replaceAll("_", " ");
    } catch {}
  }
  return record.name;
}

async function wikiGet(params, attempt = 0) {
  const query = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  const response = await fetch(`${API}?${query}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if ([429, 503].includes(response.status) && attempt < 6) {
    await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    return wikiGet(params, attempt + 1);
  }
  if (!response.ok) throw new Error(`wiki ${response.status}`);
  return response.json();
}

async function categoriesForTitles(titles) {
  const result = new Map();
  let continuation = {};
  do {
    const data = await wikiGet({
      action: "query",
      titles: titles.join("|"),
      prop: "categories",
      cllimit: "max",
      redirects: "1",
      ...continuation,
    });
    for (const page of data?.query?.pages || []) {
      const set = result.get(page.title) || new Set();
      for (const category of page.categories || []) set.add(category.title);
      result.set(page.title, set);
    }
    continuation = data.continue || null;
  } while (continuation);
  return result;
}

const titleToRecords = new Map();
for (const record of records) {
  const title = wikiTitle(record);
  if (!titleToRecords.has(title)) titleToRecords.set(title, []);
  titleToRecords.get(title).push(record);
}

const allCategories = new Map();
const titles = [...titleToRecords.keys()];
for (let index = 0; index < titles.length; index += BATCH) {
  const chunk = titles.slice(index, index + BATCH);
  const categoryMap = await categoriesForTitles(chunk);
  for (const [title, categories] of categoryMap) allCategories.set(title, categories);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const mismatches = [];
const missingPages = [];
for (const [title, titleRecords] of titleToRecords) {
  const categories = allCategories.get(title);
  if (!categories) {
    missingPages.push({ title, ids: titleRecords.map((record) => record.id) });
    continue;
  }
  const wikiRegions = [...new Set([...categories].map((category) => categoryRegions.get(category)).filter(Boolean))].sort();
  for (const record of titleRecords) {
    const catalogueRegions = [...new Set(record.unlock?.regions || [])].sort();
    const missingDirectRegions = wikiRegions.filter((region) => !catalogueRegions.includes(region));
    if (missingDirectRegions.length) {
      mismatches.push({ id: record.id, name: record.name, title, wikiRegions, catalogueRegions, missingDirectRegions });
    }
  }
}

const requiredHavenhythe = [
  "item:apex-hide-cowl", "item:apex-hide-body", "item:apex-hide-chaps", "item:apex-hide-vambraces", "item:apex-hide-boots",
  "item:havensilver-greatsword", "item:havensilver-greatsword-plus-1", "item:havensilver-greatsword-plus-2",
  "item:havensilver-longsword", "item:havensilver-longsword-plus-1", "item:havensilver-longsword-plus-2",
  "item:havensilver-off-hand-longsword", "item:havensilver-off-hand-longsword-plus-1", "item:havensilver-off-hand-longsword-plus-2",
  "item:havensilver-bolt", "item:havensilver-bolt-plus-1", "item:havensilver-bolt-plus-2",
  "item:bonecrusher-maul", "item:magic-skull-mask", "item:vampyrism-gloves", "item:black-chinchompa",
];
const ids = new Set(records.map((record) => record.id));
const missingRequiredHavenhythe = requiredHavenhythe.filter((id) => !ids.has(id));

async function categoryMembers(categoryTitle) {
  const members = [];
  let continuation = {};
  do {
    const data = await wikiGet({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmnamespace: "0",
      cmlimit: "max",
      ...continuation,
    });
    members.push(...(data?.query?.categorymembers || []));
    continuation = data.continue || null;
  } while (continuation);
  return members;
}

const havenhytheMembers = await categoryMembers("Category:Havenhythe");
const havenhytheTitles = havenhytheMembers.map((member) => member.title);
const havenhytheCategories = new Map();
for (let index = 0; index < havenhytheTitles.length; index += BATCH) {
  const chunk = havenhytheTitles.slice(index, index + BATCH);
  const categoryMap = await categoriesForTitles(chunk);
  for (const [title, categories] of categoryMap) havenhytheCategories.set(title, categories);
  await new Promise((resolve) => setTimeout(resolve, 250));
}
const catalogueTitles = new Set(titles.map((title) => title.toLowerCase().replaceAll("_", " ")));
const havenhytheEquipmentPages = havenhytheTitles.filter((title) => {
  const categories = havenhytheCategories.get(title) || new Set();
  return categories.has("Category:Equipment") || [...categories].some((category) => /(?:slot items|weapons|armour|ammunition)$/i.test(category));
});
const missingHavenhytheEquipmentPages = havenhytheEquipmentPages.filter((title) => !catalogueTitles.has(title.toLowerCase().replaceAll("_", " "))).sort();

const report = {
  generatedAt: new Date().toISOString(),
  sourceLastSynced: equipment.lastSynced || null,
  recordCount: records.length,
  wikiTitlesChecked: titles.length,
  directRegionMismatchCount: mismatches.length,
  missingWikiPageCount: missingPages.length,
  missingRequiredHavenhythe,
  havenhytheCategoryPageCount: havenhytheMembers.length,
  havenhytheEquipmentPageCount: havenhytheEquipmentPages.length,
  missingHavenhytheEquipmentPages,
  mismatches,
  missingPages,
  note: "Category-derived regions are audit leads, not automatic truth for multi-region crafting chains. The Havenhythe category comparison discovers directly categorised equipment pages missing from the catalogue; review cosmetic, broken and used variants before adding them.",
};
const outPath = path.join(root, "scraped-data/equipment-wiki-region-audit.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outPath, recordCount: report.recordCount, wikiTitlesChecked: report.wikiTitlesChecked, mismatches: mismatches.length, missingPages: missingPages.length, missingRequiredHavenhythe, havenhytheEquipmentPages: havenhytheEquipmentPages.length, missingHavenhytheEquipmentPages }, null, 2));
