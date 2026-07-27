/**
 * Decode common HTML entities in free text (wiki displaytitle, scraped labels).
 * Pure — no DOM. Prefer this before display or icon slug resolution.
 */
export function decodeHtmlEntities(text: string): string {
  return String(text ?? "")
    // Numeric / hex first so &#039; and &#x27; become apostrophes.
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      const n = Number.parseInt(h, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    })
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number.parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Named amp last so intermediate entities stay intact during decode.
    .replace(/&amp;/g, "&");
}
