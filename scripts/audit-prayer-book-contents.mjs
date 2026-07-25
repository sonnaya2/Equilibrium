import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const prayerData = JSON.parse(readFileSync(join(ROOT, "scraped-data/prayer-books.json"), "utf8"));

const expectedSerenPrayers = [
  "Chronicle Attraction",
  "Dark Form",
  "Fortitude",
  "Light Form",
  "Soul Link",
  "Superheat Form",
  "Teamwork Protection",
];

const switchableIds = prayerData.prayer_books
  .filter((book) => book.book_type === "switchable_book")
  .map((book) => book.id)
  .sort();

if (JSON.stringify(switchableIds) !== JSON.stringify(["ancient-curses", "standard-prayers"])) {
  throw new Error(`Prayer switch state is wrong: ${switchableIds.join(", ")}`);
}

const seren = prayerData.prayer_books.find((book) => book.id === "seren-prayers");
const actualSerenPrayers = [...(seren?.prayers ?? [])].sort();
if (JSON.stringify(actualSerenPrayers) !== JSON.stringify(expectedSerenPrayers)) {
  throw new Error(
    `Seren Prayer set mismatch. Expected ${expectedSerenPrayers.join(", ")}; found ${actualSerenPrayers.join(", ")}`,
  );
}

if (seren.parent_book_id !== "ancient-curses" || seren.separately_switchable !== false) {
  throw new Error("Seren Prayers must remain a non-switchable Ancient Curses extension");
}

console.log("Prayer switch state: 2 books; planner surfaces: 3; Seren Prayer set: 7/7");
