import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import { getPrayerCatalogueBooks } from "@/research/prayers";
import { getPrayerBooks } from "@/research/prayerBooks";
import { getSpecialMagicSystems, getSpellbooks } from "@/research/spellbooks";
import prayerSource from "../../data/reference/prayers.json";

const books = getPrayerCatalogueBooks();
const prayerBooks = getPrayerBooks();
const spellbooks = getSpellbooks();
const specialMagic = getSpecialMagicSystems();

/** source_refs are keys into prayers.json `sources`, not bare URLs. */
const REF_URLS = (prayerSource.sources ?? {}) as Record<string, string>;

function resolveSourceRefs(refs: unknown): string[] {
  if (!Array.isArray(refs)) return [];
  const out: string[] = [];
  for (const ref of refs) {
    if (typeof ref !== "string") continue;
    if (ref.startsWith("https://")) {
      if (!out.includes(ref)) out.push(ref);
      continue;
    }
    const url = REF_URLS[ref];
    if (typeof url === "string" && url.startsWith("https://") && !out.includes(url)) {
      out.push(url);
    }
  }
  return out;
}

const prayerTabs: ResearchTab[] = books.map((book) => ({
  key: book.id,
  label: book.name,
  description: "",
  rows: book.prayers.map((prayer) => {
    const urls = resolveSourceRefs(
      "source_refs" in prayer ? (prayer as { source_refs?: unknown }).source_refs : undefined,
    );
    return {
      ...prayer,
      category: book.name,
      book_id: book.id,
      requiredRegions: (prayer as { required_regions?: string[] }).required_regions,
      source_urls: urls.length ? urls : undefined,
    } as unknown as ResearchRow;
  }),
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
      title="Prayers"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search prayers"
      searchLabel="Search prayers"
    />
  );
}
