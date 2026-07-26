import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import { getPrayerCatalogueBooks } from "@/research/prayers";
import { getPrayerBooks } from "@/research/prayerBooks";
import { getSpecialMagicSystems, getSpellbooks } from "@/research/spellbooks";

const books = getPrayerCatalogueBooks();
const prayerBooks = getPrayerBooks();
const spellbooks = getSpellbooks();
const specialMagic = getSpecialMagicSystems();

const prayerTabs: ResearchTab[] = books.map((book) => ({
  key: book.id,
  label: book.name,
  description: `${book.prayer_count ?? book.prayers.length} ${book.book_type || "prayers"} with effects and region pressure.`,
  rows: book.prayers.map((prayer) => ({
    ...prayer,
    category: book.name,
    book_id: book.id,
    // ResearchSection links() already reads source_urls; map prayer source_refs.
    source_urls: "source_refs" in prayer ? prayer.source_refs : undefined,
  })) as unknown as ResearchRow[],
}));

const TABS: ResearchTab[] = [
  ...prayerTabs,
  {
    key: "books-model",
    label: "Book unlocks",
    description: "Which prayer books are switchable and how they unlock for the planner.",
    rows: prayerBooks as unknown as ResearchRow[],
  },
  {
    key: "spellbooks",
    label: "Spellbooks",
    description: "Standard, Ancient Magicks and Lunar as planner books. Necromancy and Daemonheim stay special systems.",
    rows: spellbooks as unknown as ResearchRow[],
  },
  {
    key: "special-magic",
    label: "Special systems",
    description: "Magic systems that are not full switchable spellbooks.",
    rows: specialMagic as unknown as ResearchRow[],
  },
];

export function PrayerSpellbookResearch() {
  return (
    <ResearchSection
      title="Prayers and spellbooks"
      intro="Standard prayers, Ancient Curses, the Seren subset, and the three main magic books. Effects and region pressure stay on each row."
      tabs={TABS}
      searchPlaceholder="Search prayers or spellbooks"
      searchLabel="Search prayers and spellbooks"
    />
  );
}
