/** Tasks density tournament — kill dead space. Crystal × Data fixed; topology competes. */

export type TasksDensityTeamId = "ledger" | "quarry" | "spike" | "aperture";

export type TasksDensityTeam = {
  id: TasksDensityTeamId;
  name: string;
  codename: string;
  thesis: string;
};

export const TASKS_DENSITY_PASS = 9.0;

export const TASKS_DENSITY_TEAMS: TasksDensityTeam[] = [
  {
    id: "ledger",
    name: "Team Ledger",
    codename: "Wiki Strip",
    thesis:
      "Full-width dense table; horizontal crest strip; detail as bottom drawer — no permanent third column.",
  },
  {
    id: "quarry",
    name: "Team Quarry",
    codename: "Crest Compact",
    thesis:
      "Three-bay DNA compressed: crest-only rail, single-line rows, narrow dense inspector.",
  },
  {
    id: "spike",
    name: "Team Spike",
    codename: "Board-first",
    thesis:
      "Stage owns height; one facet row; inspector mounts only when a row is selected.",
  },
  {
    id: "aperture",
    name: "Team Aperture",
    codename: "Select + Stage",
    thesis:
      "No side rail; region select + My build in facets; inline detail under selected row.",
  },
];

export function getTasksDensityTeam(id: string): TasksDensityTeam | undefined {
  return TASKS_DENSITY_TEAMS.find((t) => t.id === id);
}

export function isTasksDensityTeamId(id: string): id is TasksDensityTeamId {
  return TASKS_DENSITY_TEAMS.some((t) => t.id === id);
}
