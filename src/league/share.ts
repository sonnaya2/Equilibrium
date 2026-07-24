import { normalizeBuild, type BuildState } from "./index";

/**
 * Share links carry the whole build in the URL hash (#b=...) — static hosting,
 * no backend, and the hash never hits the server. Decoding runs through the
 * same tolerant normalizeBuild as localStorage hydration.
 */

export function encodeBuild(state: BuildState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeBuild(value: string): BuildState | null {
  try {
    const bin = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const keys = ["elective", "relics", "blessingPicks", "blessingResetsUsed"];
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

/**
 * A shared link beats localStorage once, then the hash is stripped — otherwise
 * every later reload would re-import the old shared state over the user's edits.
 */
export function readBuildFromLocation(): BuildState | null {
  if (typeof window === "undefined") return null;
  const match = /#b=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!match) return null;
  const build = decodeBuild(match[1]);
  if (build) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return build;
}
