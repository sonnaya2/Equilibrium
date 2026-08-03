import { normalizeBuild, type BuildState } from "./index";

/**
 * Share links carry the whole build in the URL hash (#b=...) - static hosting,
 * no backend, and the hash never hits the server. Decoding runs through the
 * same tolerant normalizeBuild as localStorage hydration.
 */

/** Reject hostile oversized hashes before base64/JSON work (real builds are tiny). */
export const MAX_SHARE_PAYLOAD_CHARS = 4096;

export function encodeBuild(state: BuildState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeBuild(value: string): BuildState | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SHARE_PAYLOAD_CHARS) {
    return null;
  }
  try {
    const bin = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    if (bin.length > MAX_SHARE_PAYLOAD_CHARS) return null;
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const keys = [
      "elective",
      "relics",
      "blessingPicks",
      "blessingSelections",
      "blessingResetsUsed",
    ];
    if (!keys.some((k) => k in parsed)) return null;
    return normalizeBuild(parsed);
  } catch {
    return null;
  }
}

export function buildShareUrl(state: BuildState): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#b=${encodeBuild(state)}`;
}

/** Read #b= without mutating the URL - ShareImport decides when to strip. */
export function peekBuildFromLocation(): BuildState | null {
  if (typeof window === "undefined") return null;
  const match = /#b=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!match) return null;
  return decodeBuild(match[1]);
}

/** Drop the share hash so reloads do not re-prompt. */
export function stripShareHash(): void {
  if (typeof window === "undefined") return;
  if (!/#b=/.test(window.location.hash)) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
