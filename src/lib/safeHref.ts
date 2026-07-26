/** Accept only absolute https URLs for data-driven external links. */
export function safeExternalHref(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}
