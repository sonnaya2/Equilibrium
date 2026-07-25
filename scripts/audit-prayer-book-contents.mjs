import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const prayerBooks = read("scraped-data/prayer-books.json");
const prayerCatalogue = read("scraped-data/prayers.json");
const prayerCatalogueCanonical = read("data/reference/prayers.json");

const expectedStandardPrayers = [
  "Accelerated Decay",
  "Augury",
  "Burst of Strength",
  "Charge",
  "Chivalry",
  "Clarity of Thought",
  "Decay",
  "Divine Rage",
  "Eagle Eye",
  "Eclipsed Soul",
  "Hand of Doom",
  "Hand of Fate",
  "Hand of Judgement",
  "Hastened Decay",
  "Hawk Eye",
  "Improved Reflexes",
  "Incredible Reflexes",
  "Mystic Lore",
  "Mystic Might",
  "Mystic Will",
  "Overcharge",
  "Overpowering Force",
  "Piety",
  "Protect from Magic",
  "Protect from Melee",
  "Protect from Necromancy",
  "Protect from Ranged",
  "Protect from Summoning",
  "Protect Item",
  "Rapid Heal",
  "Rapid Renewal",
  "Rapid Restore",
  "Redemption",
  "Retribution",
  "Rigour",
  "Rock Skin",
  "Sanctity",
  "Sharp Eye",
  "Smite",
  "Steel Skin",
  "Super Charge",
  "Superhuman Strength",
  "Thick Skin",
  "Ultimate Strength",
  "Unrelenting Force",
  "Unstoppable Force",
];

const expectedAncientCurses = [
  "Affliction",
  "Anguish",
  "Berserker",
  "Chronicle Attraction",
  "Dark Form",
  "Deflect Magic",
  "Deflect Melee",
  "Deflect Necromancy",
  "Deflect Ranged",
  "Deflect Summoning",
  "Desolation",
  "Fortitude",
  "Leech Adrenaline",
  "Leech Defence",
  "Leech Magic Attack",
  "Leech Magic Strength",
  "Leech Melee Attack",
  "Leech Melee Strength",
  "Leech Necromancy Attack",
  "Leech Necromancy Strength",
  "Leech Ranged Attack",
  "Leech Ranged Strength",
  "Leech Run Energy",
  "Light Form",
  "Malevolence",
  "Protect Item",
  "Ruination",
  "Sap Adrenaline",
  "Sap Defence",
  "Sap Magic Attack",
  "Sap Magic Strength",
  "Sap Melee Attack",
  "Sap Melee Strength",
  "Sap Necromancy Attack",
  "Sap Necromancy Strength",
  "Sap Ranged Attack",
  "Sap Ranged Strength",
  "Sorrow",
  "Soul Link",
  "Soul Split",
  "Superheat Form",
  "Teamwork Protection",
  "Torment",
  "Turmoil",
  "Wrath",
];

const expectedSerenPrayers = [
  "Chronicle Attraction",
  "Dark Form",
  "Fortitude",
  "Light Form",
  "Soul Link",
  "Superheat Form",
  "Teamwork Protection",
];

function assertNames(bookId, expected) {
  const book = prayerCatalogue.books.find((row) => row.id === bookId);
  if (!book) throw new Error(`Prayer catalogue is missing ${bookId}`);
  const actual = book.prayers.map((row) => row.name).sort();
  const wanted = [...expected].sort();
  if (new Set(actual).size !== actual.length) throw new Error(`${bookId} contains duplicate prayer names`);
  if (book.prayer_count !== wanted.length || JSON.stringify(actual) !== JSON.stringify(wanted)) {
    const missing = wanted.filter((name) => !actual.includes(name));
    const extra = actual.filter((name) => !wanted.includes(name));
    throw new Error(
      `${bookId} mismatch; expected ${wanted.length}, found ${actual.length}; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
    );
  }
  return book;
}

const switchableIds = prayerBooks.prayer_books
  .filter((book) => book.book_type === "switchable_book")
  .map((book) => book.id)
  .sort();
if (JSON.stringify(switchableIds) !== JSON.stringify(["ancient-curses", "standard-prayers"])) {
  throw new Error(`Prayer switch state is wrong: ${switchableIds.join(", ")}`);
}

assertNames("standard-prayers", expectedStandardPrayers);
const ancient = assertNames("ancient-curses", expectedAncientCurses);
const serenCatalogue = assertNames("seren-prayers", expectedSerenPrayers);

const serenBook = prayerBooks.prayer_books.find((book) => book.id === "seren-prayers");
const serenUnlockNames = [...(serenBook?.prayers ?? [])].sort();
if (JSON.stringify(serenUnlockNames) !== JSON.stringify([...expectedSerenPrayers].sort())) {
  throw new Error("Prayer-book dependency data and the complete Seren catalogue disagree");
}
if (serenBook.parent_book_id !== "ancient-curses" || serenBook.separately_switchable !== false) {
  throw new Error("Seren Prayers must remain a non-switchable Ancient Curses extension");
}
if (serenCatalogue.parent_book_id !== "ancient-curses" || serenCatalogue.separately_switchable !== false) {
  throw new Error("Seren catalogue metadata must remain attached to Ancient Curses");
}

const ancientNames = new Set(ancient.prayers.map((row) => row.name));
const missingFromAncient = expectedSerenPrayers.filter((name) => !ancientNames.has(name));
if (missingFromAncient.length > 0) {
  throw new Error(`Seren prayers missing from Ancient Curses: ${missingFromAncient.join(", ")}`);
}

if (JSON.stringify(prayerCatalogue) !== JSON.stringify(prayerCatalogueCanonical)) {
  throw new Error("Complete prayer catalogue canonical mirror is stale; run npm run normalize:data");
}

console.log("Prayer catalogue: Standard 46/46; Ancient Curses 45/45; Seren extension 7/7; switchable books: 2");
