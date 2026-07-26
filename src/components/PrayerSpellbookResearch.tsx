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
  description: "",
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
    description: "",
    rows: prayerBooks as unknown as ResearchRow[],
  },
  {
    key: "spellbooks",
    label: "Spellbooks",
    description: "",
    rows: spellbooks as unknown as ResearchRow[],
  },
  {
    key: "special-magic",
    label: "Special systems",
    description: "",
    rows: specialMagic as unknown as ResearchRow[],
  },
];

export function PrayerSpellbookResearch() {
  return (
    <ResearchSection
      title="Prayers and spellbooks"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search prayers or spellbooks"
      searchLabel="Search prayers and spellbooks"
    />
  );
}
