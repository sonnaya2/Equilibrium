/** Map remaster tournament — 5 teams compete on scene + UI overhaul for /map. */

export type MapRemasterTeamId =
  | "daylit"
  | "crystal"
  | "cartographer"
  | "boardsky"
  | "raised";

export type MapRemasterTeam = {
  id: MapRemasterTeamId;
  name: string;
  codename: string;
  agents: [string, string];
  thesis: string;
};

/** Fixed product constraints. Teams compete on execution, not on inventing a new stack. */
export const MAP_REMASTER_RECIPE = {
  stack: "WebGPU + TSL in production; lab may use CSS/SVG mocks of the same look",
  world: "Authored region slabs (no photo plate as war-table albedo)",
  vines: "True 3D plants on land borders — not flat viewport frame ribbons",
  water: "Lit, animated sea that reads as water at rest",
  light: "Brighter table; selected region stays elevated and clearly brightest",
  pins: "Interactable place markers open content + unique drops dossier",
  ui: "Board Sky family: board primary; detail under or transient tray — no permanent third inspector column",
  a11y: "Ledger owns keyboard picks; canvas is not a second accessible region list",
  art: "Game crests/icons + procedural materials only — no gen-AI imagery",
} as const;

export const MAP_REMASTER_PASS = 9.0;

export const MAP_REMASTER_TEAMS: MapRemasterTeam[] = [
  {
    id: "daylit",
    name: "Team Daylit",
    codename: "Daylit Reliquary",
    agents: ["daylit-design", "daylit-build"],
    thesis:
      "Warm noon war table: tube+leaf 3D vines, lit water with foam, Board Sky dossier under board, plinth selection.",
  },
  {
    id: "crystal",
    name: "Team Crystal",
    codename: "Crystal Frontier",
    agents: ["crystal-design", "crystal-build"],
    thesis:
      "Crystal-ivy borders, facet pin tray, dusk field vs lit subject — high fantasy, gem only on chrome edges.",
  },
  {
    id: "cartographer",
    name: "Team Cartographer",
    codename: "Cartographer's Desk",
    agents: ["carto-design", "carto-build"],
    thesis:
      "Atlas readability: ink coastlines, parchment-lift land, rope-ivy, three-band desk under board.",
  },
  {
    id: "boardsky",
    name: "Team Boardsky",
    codename: "Deep Board Sky",
    agents: ["boardsky-design", "boardsky-build"],
    thesis:
      "Hybrid DNA pure remaster: quality materials only, true Board Sky stack, pin expands map-chip under board.",
  },
  {
    id: "raised",
    name: "Team Raised",
    codename: "Raised Court",
    agents: ["raised-design", "raised-build"],
    thesis:
      "Dramatic plinth stage: tall lift, dark reflective sea, thick hedge vines, floating bottom dossier bar.",
  },
];

export function getMapRemasterTeam(id: string): MapRemasterTeam | undefined {
  return MAP_REMASTER_TEAMS.find((t) => t.id === id);
}

export function isMapRemasterTeamId(id: string): id is MapRemasterTeamId {
  return MAP_REMASTER_TEAMS.some((t) => t.id === id);
}
