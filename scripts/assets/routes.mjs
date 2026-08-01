/**
 * The single description of what assets/ publishes and where.
 *
 * assets/ is the only editable image tree; public/game and public/brand are
 * disposable output regenerated from it. Everything that decides a served URL
 * lives here, so a path question has exactly one answer.
 */

/** Trees that publish by path convention: assets/rs3/x/y.webp -> public/game/x/y.webp. */
export const TREES = [
  { source: "assets/rs3", target: "game" },
  { source: "assets/brand", target: "brand" },
  { source: "assets/leagues", target: null }, // no convention - see LEAGUE_* below
];

export const PUBLISHABLE = /\.(png|jpe?g|gif|webp|json)$/i;

/**
 * Never served, at any depth:
 *   _*        dev artefacts (contact sheets)
 *   raw/      pre-optimization originals kept for re-derivation
 *   variants/ design explorations that lost
 */
export const UNPUBLISHED = [/(^|\/)_/, /(^|\/)raw\//, /(^|\/)variants\//, /\.md$/i];

/**
 * assets/leagues predates the convention and its public names differ from its
 * source names, so every published file is named explicitly. Authority for the
 * renames is the `dests` column of assets/leagues/equilibrium/official/sources.json.
 */
export const LEAGUE_FILES = {
  "equilibrium/official/WILheader.webp": "game/leagues/header.webp",
  "equilibrium/official/map.webp": "game/leagues/map.webp",
  "equilibrium/official/regionlock.webp": "game/leagues/regionlock.webp",
  "equilibrium/official/relicmenu.webp": "game/leagues/relic-menu.webp",
  "equilibrium/official/blessing.webp": "game/leagues/blessing-menu.webp",
  "equilibrium/official/relic.webp": "game/leagues/relic-plate.webp",
  "equilibrium/official/trophy.webp": "game/leagues/trophy.webp",
  "equilibrium/official/promo-1.webp": "game/leagues/promo-1.webp",
  "equilibrium/official/promo-2.webp": "game/leagues/promo-2.webp",
  "equilibrium/official/sources.json": "game/leagues/sources.json",
};

/** Whole folders that publish flat into one public directory. */
export const LEAGUE_FOLDERS = [
  ["equilibrium/blessings/", "game/blessings/"],
  ["equilibrium/relics/champion/", "game/relics/"],
  ["equilibrium/relics/site/", "game/relics/"],
];

/**
 * Public path a source file produces, or null when it is source-only.
 * `rel` is forward-slashed and relative to the tree root.
 */
export function publicTargetFor(tree, rel) {
  if (!PUBLISHABLE.test(rel)) return null;
  if (UNPUBLISHED.some((pattern) => pattern.test(rel))) return null;

  if (tree === "assets/leagues") {
    if (LEAGUE_FILES[rel]) return LEAGUE_FILES[rel];
    for (const [prefix, target] of LEAGUE_FOLDERS) {
      if (rel.startsWith(prefix)) return target + rel.slice(prefix.length);
    }
    return null;
  }

  const root = TREES.find((entry) => entry.source === tree)?.target;
  return root ? `${root}/${rel}` : null;
}
