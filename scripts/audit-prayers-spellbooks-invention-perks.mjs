import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const prayerSource = read("scraped-data/prayer-books.json");
const prayerCanonical = read("data/reference/prayer-books.json");
const spellSource = read("scraped-data/spellbooks.json");
const spellCanonical = read("data/reference/spellbooks.json");
const perkSource = read("scraped-data/planner-expansions-invention-active-perks.json");
const perkCanonical = read("data/research/planner-expansions-invention-active-perks.json");
const progression = read("scraped-data/progression-unlocks.json");

const requiredPrayerBooks = ["standard-prayers", "ancient-curses", "seren-prayers"];
const requiredSpellbooks = ["standard-spellbook", "ancient-magicks", "lunar-spellbook"];
const requiredPerkFamilies = [
  "Aftershock",
  "Caroming",
  "Eruptive",
  "Flanking",
  "Lunging",
  "Planted Feet",
  "Precise",
  "Absorbative",
  "Biting",
  "Clear Headed",
  "Crackling",
  "Crystal Shield",
  "Energising",
  "Enhanced Devoted",
  "Equilibrium",
  "Impatient",
  "Invigorating",
  "Lucky",
  "Turtling",
  "Ultimatums",
];

const removedPerks = [
  "Antitheism",
  "Profane",
  "Inaccurate",
  "Junk Food",
  "Undead Bait",
  "Demon Bait",
  "Dragon Bait",
  "Cautious",
  "Mediocrity",
  "Fatiguing",
  "Committed",
  "Butterfingers",
  "Blunted",
  "Cheapskate",
  "Confused",
];

const expectedActivePerks = [
  "Absorbative",
  "Aftershock",
  "Biting",
  "Brassican",
  "Breakdown",
  "Brief Respite",
  "Bulwark",
  "Careless",
  "Caroming",
  "Charitable",
  "Clear Headed",
  "Crackling",
  "Crystal Shield",
  "Demon Slayer",
  "Devoted",
  "Dragon Slayer",
  "Efficient",
  "Energising",
  "Enhanced Devoted",
  "Enhanced Efficient",
  "Enlightened",
  "Equilibrium",
  "Eruptive",
  "Explosive",
  "Flanking",
  "Fortune",
  "Furnace",
  "Genocidal",
  "Glow Worm",
  "Hallucinogenic",
  "Hasty",
  "Hoarding",
  "Honed",
  "Imp Souled",
  "Impatient",
  "Invigorating",
  "Lucky",
  "Looting",
  "Lunging",
  "Mobile",
  "Mysterious",
  "Naturalist",
  "Oblivious",
  "Planted Feet",
  "Polishing",
  "Precise",
  "Preparation",
  "Preservationist",
  "Prosper",
  "Pyromaniac",
  "Rapid",
  "Refined",
  "Reflexes",
  "Relentless",
  "Ruthless",
  "Scavenging",
  "Scraps",
  "Shield Bashing",
  "Spendthrift",
  "Taunting",
  "Talking",
  "Tinker",
  "Trophy-taker's",
  "Turtling",
  "Ultimatums",
  "Undead Slayer",
  "Venomblood",
  "Wild Runes",
  "Wise",
];

function assertUniqueIds(rows, label) {
  const ids = rows.map((row) => row.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`${label} has duplicate id: ${duplicate}`);
}

function assertExactIds(rows, expected, label) {
  assertUniqueIds(rows, label);
  const actual = rows.map((row) => row.id).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} mismatch. Expected ${wanted.join(", ")}; found ${actual.join(", ")}`);
  }
}

function validateUrls(value, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateUrls(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const currentPath = `${path}.${key}`;
    if (key.endsWith("_url") && (typeof entry !== "string" || !entry.startsWith("https://"))) {
      throw new Error(`${currentPath} must use https://`);
    }
    if (key.endsWith("_urls") && Array.isArray(entry)) {
      entry.forEach((url, index) => {
        if (typeof url !== "string" || !url.startsWith("https://")) {
          throw new Error(`${currentPath}[${index}] must use https://`);
        }
      });
    }
    validateUrls(entry, currentPath);
  }
}

function assertMirror(source, canonical, label) {
  if (JSON.stringify(source) !== JSON.stringify(canonical)) {
    throw new Error(`${label} canonical mirror is stale; run npm run normalize:data`);
  }
}

assertExactIds(prayerSource.prayer_books, requiredPrayerBooks, "Prayer-book catalogue");
assertExactIds(spellSource.spellbooks, requiredSpellbooks, "Spellbook catalogue");
assertUniqueIds(perkSource.active_perks, "Active Invention perk catalogue");

const seren = prayerSource.prayer_books.find((row) => row.id === "seren-prayers");
if (seren.book_type !== "book_extension" || seren.parent_book_id !== "ancient-curses" || seren.separately_switchable !== false) {
  throw new Error("Seren Prayers must remain an Ancient Curses extension, not a fabricated switchable prayer book");
}

const activePerkNames = perkSource.active_perks.map((row) => row.name);
const actualActive = [...activePerkNames].sort();
const expectedActive = [...expectedActivePerks].sort();
if (JSON.stringify(actualActive) !== JSON.stringify(expectedActive)) {
  const missing = expectedActive.filter((name) => !actualActive.includes(name));
  const extra = actualActive.filter((name) => !expectedActive.includes(name));
  throw new Error(`Active Invention perk catalogue mismatch; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`);
}
if (perkSource.active_perk_count !== expectedActivePerks.length) {
  throw new Error(`Active Invention perk count must be ${expectedActivePerks.length}`);
}

const removedPresent = removedPerks.filter((name) => activePerkNames.includes(name));
if (removedPresent.length > 0) {
  throw new Error(`Removed July 2026 Invention perks returned to active data: ${removedPresent.join(", ")}`);
}

const missingFamilies = requiredPerkFamilies.filter((name) => !activePerkNames.includes(name));
if (missingFamilies.length > 0) {
  throw new Error(`Current PvME perk families missing from the active catalogue: ${missingFamilies.join(", ")}`);
}

const questUnlockCorpus = JSON.stringify(progression.quest_unlocks);
for (const dependency of ["Ancient Curses", "Ancient Magicks", "Lunar spellbook"]) {
  if (!questUnlockCorpus.includes(dependency)) {
    throw new Error(`Permanent-unlock graph is missing spell/prayer dependency: ${dependency}`);
  }
}

validateUrls(prayerSource, "prayer-books.json");
validateUrls(spellSource, "spellbooks.json");
validateUrls(perkSource, "planner-expansions-invention-active-perks.json");
assertMirror(prayerSource, prayerCanonical, "Prayer-book");
assertMirror(spellSource, spellCanonical, "Spellbook");
assertMirror(perkSource, perkCanonical, "Active Invention perk");

console.log(
  `Prayer books: ${prayerSource.prayer_books.length}/3; spellbooks: ${spellSource.spellbooks.length}/3; active Invention perks: ${activePerkNames.length}/${expectedActivePerks.length}; removed perks present: 0`,
);
