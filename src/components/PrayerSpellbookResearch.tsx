import { researchRows, ResearchSection, type ResearchTab } from "./ResearchSection";
import { getPrayerCatalogueBooks } from "@/research/prayers";
import { getPrayerBooks } from "@/research/prayerBooks";
import { getSpellbooks } from "@/research/spellbooks";
import prayerSource from "../../data/reference/prayers.json";

const books = getPrayerCatalogueBooks();
const prayerBooks = getPrayerBooks();
const spellbooks = getSpellbooks();

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
  rows: researchRows(
    book.prayers.map((prayer) => {
      const urls = resolveSourceRefs(
        "source_refs" in prayer ? (prayer as { source_refs?: unknown }).source_refs : undefined,
      );
      const required = (prayer as { required_regions?: string[] }).required_regions;
      const regionType = (prayer as { region_requirement_type?: string }).region_requirement_type;
      return {
        ...prayer,
        category: book.name,
        book_id: book.id,
        // Empty [] alone is unmapped; explicit no_region_requirement is global.
        requiredRegions: regionType === "no_region_requirement" ? ["global"] : required,
        region_requirement_type: regionType,
        source_urls: urls.length ? urls : undefined,
      };
    }),
  ),
}));

const PRAYER_TABS: ResearchTab[] = [
  ...prayerTabs,
  {
    key: "books-model",
    label: "Book unlocks",
    description: "",
    rows: researchRows(prayerBooks),
  },
];

const MAGIC_TABS: ResearchTab[] = [
  {
    key: "spellbooks",
    label: "Spellbooks",
    description: "",
    rows: researchRows(
      spellbooks.map((book) => ({
        ...book,
        requiredRegions: book.default_book
          ? ["global"]
          : "region_hint" in book
            ? [book.region_hint]
            : book.id === "ancient-magicks"
              ? ["desert"]
              : undefined,
      })),
    ),
  },
];

export function PrayerResearch() {
  return (
    <ResearchSection
      title="Prayers"
      intro=""
      tabs={PRAYER_TABS}
      searchPlaceholder="Search"
      searchLabel="Search prayers"
    />
  );
}

export function MagicResearch() {
  return (
    <ResearchSection
      title="Magic"
      intro=""
      tabs={MAGIC_TABS}
      searchPlaceholder="Search"
      searchLabel="Search Magic"
    />
  );
}
