/**
 * Catalyst locality → Equilibrium region mapping + display labels.
 * Client-safe: no snapshot JSON, no league barrel (relics/blessings).
 * Keep in sync with scripts/refresh-catalyst-snapshot.mjs.
 */

import type { TaskRegionId } from "./index";

/** Same order as src/league REGION_IDS — duplicated so client UI skips the league barrel. */
export const TASK_LEAGUE_REGION_IDS = [
  "misthalin",
  "havenhythe",
  "karamja",
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "anachronia",
] as const;

export type TaskLeagueRegionId = (typeof TASK_LEAGUE_REGION_IDS)[number];

export const CATALYST_TASKS_URL = "https://runescape.wiki/w/Catalyst_League/Tasks";

export const CATALYST_LOCALITY_TO_REGION: Readonly<Record<string, TaskRegionId>> = {
  global: "global",
  anachronia: "anachronia",
  karamja: "karamja",
  morytania: "morytania",
  desert: "desert",
  menaphos: "desert",
  fremennik: "fremennik",
  lunar: "fremennik",
  elves: "tirannwn",
  wilderness: "forinthry",
  daemonheim: "forinthry",
  falador: "asgarnia",
  burthorpe: "asgarnia",
  taverley: "asgarnia",
  portsarim: "asgarnia",
  ardougne: "kandarin",
  seer: "kandarin",
  yanille: "kandarin",
  gnomes: "kandarin",
  piscatoris: "kandarin",
  feldip: "kandarin",
  varrock: "misthalin",
  lumbridge: "misthalin",
  draynor: "misthalin",
  edgeville: "misthalin",
  um: "misthalin",
  fort: "misthalin",
};

const REGION_DISPLAY: Readonly<Record<TaskRegionId, string>> = {
  global: "Global",
  misthalin: "Misthalin",
  havenhythe: "Havenhythe",
  karamja: "Karamja",
  asgarnia: "Asgarnia",
  kandarin: "Kandarin",
  fremennik: "Fremennik",
  forinthry: "Forinthry",
  desert: "Desert",
  morytania: "Morytania",
  tirannwn: "Tirannwn",
  anachronia: "Anachronia",
};

const LEAGUE_SET = new Set<string>(TASK_LEAGUE_REGION_IDS);

export function mapCatalystLocality(localityKey: string): TaskRegionId | undefined {
  return CATALYST_LOCALITY_TO_REGION[localityKey.toLowerCase()];
}

export function regionDisplayName(regionId: TaskRegionId): string {
  return REGION_DISPLAY[regionId] ?? regionId;
}

export function isLeagueRegionId(value: string): value is TaskLeagueRegionId {
  return LEAGUE_SET.has(value);
}
