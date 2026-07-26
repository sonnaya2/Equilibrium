/** Hybrid composition tournament — 5 teams × 2 agents + CEO. Prize: eternal glory. */

export type HybridTeamId = "nova" | "orbit" | "prism" | "ridge" | "forge" | "composite";

export type HybridTeam = {
  id: HybridTeamId;
  name: string;
  codename: string;
  agents: [string, string];
  /** What this team optimizes within the fixed composition recipe */
  angle: string;
};

/**
 * Fixed composition (user recipe) — teams compete on EXECUTION quality:
 * Colors Editorial · Overview Daylight · Map Editorial 3D-top no inspector ·
 * Tasks Crystal×Data · Build Editorial+relic art · Combat Crystal+Editorial ·
 * Data Lattice+Editorial+Daylight browse + full source inspector.
 */
export const HYBRID_RECIPE = {
  colors: "Editorial",
  overview: "Daylight",
  map: "Editorial + 3D top, no inspector",
  tasks: "Crystal iterated toward Data",
  build: "Editorial + Jagex relic icons",
  combat: "Crystal main, Editorial accents",
  data: "Lattice + Editorial + Daylight browse + full source inspector",
} as const;

export const HYBRID_TEAMS: HybridTeam[] = [
  {
    id: "nova",
    name: "Team Nova",
    codename: "Courtyard First",
    agents: ["nova-design", "nova-build"],
    angle: "Daylight Overview gate architecture + Editorial tokens as the product spine",
  },
  {
    id: "orbit",
    name: "Team Orbit",
    codename: "Board Sky",
    agents: ["orbit-design", "orbit-build"],
    angle: "Map 3D-first Editorial gazetteer; ledger a11y without inspector bloat",
  },
  {
    id: "prism",
    name: "Team Prism",
    codename: "Facet Desk",
    agents: ["prism-design", "prism-build"],
    angle: "Data + Tasks as twin desks: Lattice tabs, Daylight rail, Crystal facets, full sources",
  },
  {
    id: "ridge",
    name: "Team Ridge",
    codename: "Relic Court",
    agents: ["ridge-design", "ridge-build"],
    angle: "Build Editorial polish + revealed relic presentation (Jagex art when available)",
  },
  {
    id: "forge",
    name: "Team Forge",
    codename: "Calc Crystal",
    agents: ["forge-design", "forge-build"],
    angle: "Combat Crystal-led with Editorial chrome; honest empty math; dense ability scan",
  },
  {
    id: "composite",
    name: "Team Composite",
    codename: "Champion",
    agents: ["composite-design", "composite-build"],
    angle:
      "R2 steal matrix: Nova Overview + Orbit Map + Prism Data/Tasks + Ridge Build + Forge Combat",
  },
];

export const HYBRID_PASS = 9;
