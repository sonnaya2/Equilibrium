/** Shared confidence / freshness labels for research UI surfaces. */

export function confidenceLabel(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const n = raw.toLowerCase().trim();
  if (!n || n === "unclassified") return "Not checked";
  if (n.includes("stale")) return "Needs update";
  if (n.includes("unresolved") || n.includes("pending")) return "Unresolved";
  if (n.includes("incomplete")) return "Incomplete";
  if (n.includes("legacy")) return "Legacy reference";
  if (n.includes("historical") || n.includes("working")) return "League precedent";
  if (n.includes("confirmed_wiki")) return "Wiki checked";
  if (n.includes("confirmed_official")) return "Jagex";
  if (n.includes("inferred_region") || n.includes("region_inferred") || n.includes("inferred")) {
    return "Region inferred";
  }
  if (n.includes("base_game")) return "Base game";
  if (n.includes("current_2026_content")) return "Current";
  if (n.includes("pvme") && n.includes("no_xp")) return "PvME; no XP";
  if (n.includes("pvme")) return "PvME";
  if (n.includes("official")) return "Jagex";
  if (n.includes("wiki") || n.includes("confirmed")) return "Wiki checked";
  return raw ? raw.replaceAll("_", " ") : "Needs review";
}

export function freshnessLabel(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const n = raw.toLowerCase().trim();
  if (!n) return "-";
  if (n === "2026_current" || n === "current" || n === "current_wiki") return "Current";
  if (n.includes("2026-07-20")) return "Jul 20, 2026";
  if (n.includes("2026_remastered")) return "2026 remaster";
  if (n.includes("current_page_stale_xp_tables")) return "Current page; rates stale";
  if (n.includes("stale")) return "Needs update";
  if (n.includes("current_content_region_confirmed")) return "Current";
  if (n.includes("current_wiki_main_game_ceiling")) return "Current main-game ceiling";
  return raw.replaceAll("_", " ");
}
