/** Tasks density tournament — kill dead space. Crystal × Data fixed; topology competes. */

export type TasksDensityTeamId =
  | "ledger"
  | "quarry"
  | "spike"
  | "aperture"
  | "herald"
  | "tabrail";

export type TasksDensityTeam = {
  id: TasksDensityTeamId;
  name: string;
  codename: string;
  thesis: string;
  round?: number;
};

export const TASKS_DENSITY_PASS = 9.0;

export const TASKS_DENSITY_TEAMS: TasksDensityTeam[] = [
  {
    id: "ledger",
    name: "Team Ledger",
    codename: "Wiki Strip",
    thesis:
      "Full-width dense table; horizontal crest strip; detail as bottom drawer — no permanent third column.",
    round: 1,
  },
  {
    id: "quarry",
    name: "Team Quarry",
    codename: "Crest Compact",
    thesis:
      "Three-bay DNA compressed: crest-only rail, single-line rows, narrow dense inspector.",
    round: 1,
  },
  {
    id: "spike",
    name: "Team Spike",
    codename: "Board-first",
    thesis:
      "Stage owns height; one facet row; inspector mounts only when a row is selected.",
    round: 1,
  },
  {
    id: "aperture",
    name: "Team Aperture",
    codename: "Select + Stage",
    thesis:
      "No side rail; region select + My build in facets; inline detail under selected row.",
    round: 1,
  },
  {
    id: "herald",
    name: "Team Herald",
    codename: "Gallery Board",
    thesis:
      "Large side-by-side task tiles with crest medallions and polished card chrome; detail expands in-tile.",
    round: 3,
  },
  {
    id: "tabrail",
    name: "Team Tabrail",
    codename: "Tab Crest Rail",
    thesis:
      "Crest Compact with huge interactive tab crests and roomy rows; Tier/Comp/Pts packed after name (no dead gap).",
    round: 3,
  },
];

export function getTasksDensityTeam(id: string): TasksDensityTeam | undefined {
  return TASKS_DENSITY_TEAMS.find((t) => t.id === id);
}

export function isTasksDensityTeamId(id: string): id is TasksDensityTeamId {
  return TASKS_DENSITY_TEAMS.some((t) => t.id === id);
}
