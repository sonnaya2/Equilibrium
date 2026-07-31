import prayerBookSource from "#shard/reference/prayer-books.json";

export type PrayerBookRecord = (typeof prayerBookSource)["prayer_books"][number];

export function getPrayerBooks(): PrayerBookRecord[] {
  return prayerBookSource.prayer_books;
}

export function getPrayerBook(id: PrayerBookRecord["id"]): PrayerBookRecord | undefined {
  return prayerBookSource.prayer_books.find((book) => book.id === id);
}
