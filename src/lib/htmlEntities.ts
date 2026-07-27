/**
 * Decode common HTML entities in free text (wiki displaytitle, scraped labels).
 * Pure — no DOM. Prefer this before display or icon slug resolution.
 */

/** Valid Unicode scalar for String.fromCodePoint (no surrogates, no overflow). */
function codePointChar(code: number): string {
  if (
    !Number.isFinite(code) ||
    code < 0 ||
    code > 0x10ffff ||
    (code >= 0xd800 && code <= 0xdfff)
  ) {
    return "";
  }
  return String.fromCodePoint(code);
}

export function decodeHtmlEntities(text: string): string {
  return String(text ?? "")
    // Numeric / hex first so &#039; and &#x27; become apostrophes.
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      codePointChar(Number.parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n: string) =>
      codePointChar(Number.parseInt(n, 10)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Named amp last so intermediate entities stay intact during decode.
    .replace(/&amp;/g, "&");
}
