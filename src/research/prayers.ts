import prayerSource from "../../data/reference/prayers.json";

export type PrayerCatalogueBook = (typeof prayerSource)["books"][number];
export type PrayerCatalogueEntry = PrayerCatalogueBook["prayers"][number];

export function getPrayerCatalogueBooks(): PrayerCatalogueBook[] {
  return prayerSource.books;
}

export function getPrayersForBook(id: PrayerCatalogueBook["id"]): PrayerCatalogueEntry[] {
  return prayerSource.books.find((book) => book.id === id)?.prayers ?? [];
}
