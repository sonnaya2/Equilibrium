/** 5-team Restoration Companion tournament — 2 agents/team, 3 rounds, CEO judge. */

export type TeamId = "alpha" | "bravo" | "charlie" | "delta" | "echo";

export type TeamDef = {
  id: TeamId;
  name: string;
  codename: string;
  thesis: string;
  agents: [string, string];
  /** ArtStation / keyart lesson emphasis */
  bias: string;
};

export const TEAMS: TeamDef[] = [
  {
    id: "alpha",
    name: "Team Alpha",
    codename: "Daylight",
    thesis: "2026 keyart daylight: sky, grass, stone fort, living world companion site.",
    agents: ["alpha-design", "alpha-build"],
    bias: "Keyart landscape luminosity + public readability",
  },
  {
    id: "bravo",
    name: "Team Bravo",
    codename: "Stone UI",
    thesis: "2026 Road to Restoration stone UI: classic carved panels, clean chrome, heritage.",
    agents: ["bravo-design", "bravo-build"],
    bias: "Official UI refresh — stone icons energy, cleaner frames",
  },
  {
    id: "charlie",
    name: "Team Charlie",
    codename: "Cinematic",
    thesis: "ArtStation environment richness: material depth, atmospheric mid-dark, premium game site.",
    agents: ["charlie-design", "charlie-build"],
    bias: "Jagex ArtStation env art — materials not mud",
  },
  {
    id: "delta",
    name: "Team Delta",
    codename: "Crystal",
    thesis: "Teal crystal mountain + Equilibrium gem as identity core; modern punch.",
    agents: ["delta-design", "delta-build"],
    bias: "Keyart emerald crystal + gem chrome only",
  },
  {
    id: "echo",
    name: "Team Echo",
    codename: "Editorial",
    thesis: "Top-end editorial game site: art stage, refined type, data still dense and scannable.",
    agents: ["echo-design", "echo-build"],
    bias: "Marketing-site craft without SaaS funnel",
  },
];

export const ROUND_COUNT = 3;
export const PASS_BAR = 9;
