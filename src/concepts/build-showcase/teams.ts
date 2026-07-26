/**
 * Build Showcase tournament.
 * R2 (active): no section tabs · official League art · wiki hex icons.
 * R1 kept for comparison (monogram-era).
 */

export type BuildConceptId =
  | "war-court"
  | "dossier-board"
  | "herald-stage"
  | "herald"
  | "roster"
  | "dossier"
  | "plaque"
  | "billboard";

export type BuildConcept = {
  id: BuildConceptId;
  name: string;
  codename: string;
  thesis: string;
  shareAngle: string;
  round: 1 | 2;
};

export const BUILD_SHOWCASE_CONCEPTS: BuildConcept[] = [
  {
    id: "war-court",
    name: "War Court",
    codename: "Open Relic Court",
    thesis:
      "Single viewport: region crests · relic portraits/hex · blessing lattice — no section tabs. Official plates as atmosphere.",
    shareAngle: "Desktop war-table screenshot of the full plan",
    round: 2,
  },
  {
    id: "dossier-board",
    name: "Dossier Board",
    codename: "Art Folio",
    thesis:
      "Dense two-column editorial folio with wiki hex icons + splash detail; share strip sticky. All systems visible.",
    shareAngle: "Wiki-dense plan sheet with real art",
    round: 2,
  },
  {
    id: "herald-stage",
    name: "Herald Stage",
    codename: "Share Stage",
    thesis:
      "Share-first plaque with official hex stamp + crest seal; full region grid + blessing path still operable without tabs.",
    shareAngle: "Mobile/Discord share crop with tools around it",
    round: 2,
  },
  {
    id: "herald",
    name: "Herald Card",
    codename: "Crest Plaque · R1",
    thesis: "Vertical share plaque — crests as a seal, monogram as seal stamp, path as ribbon.",
    shareAngle: "One tall card that reads on mobile screenshots",
    round: 1,
  },
  {
    id: "roster",
    name: "War Roster",
    codename: "Lineup Strip · R1",
    thesis: "Sports-card roster of regions in a horizontal band; relic as captain seat.",
    shareAngle: "Wide desktop banner / Discord embed crop",
    round: 1,
  },
  {
    id: "dossier",
    name: "Court Dossier",
    codename: "Dense Folio · R1",
    thesis: "Editorial dossier — two columns of facts, monogram court, blessing stamps.",
    shareAngle: "Wiki-dense plan sheet for serious planners",
    round: 1,
  },
  {
    id: "plaque",
    name: "Gem Plaque",
    codename: "Centered Seal · R1",
    thesis: "Centered gem-framed plaque with empty voids treated as intentional carving.",
    shareAngle: "Instagram/square-ish crop; showcase first, tools second",
    round: 1,
  },
  {
    id: "billboard",
    name: "Strip Billboard",
    codename: "Social Strip · R1",
    thesis: "Thin top billboard of the live plan + tools below; share strip always visible.",
    shareAngle: "Always-on share bar; plan summary never scrolls away",
    round: 1,
  },
];

export const BUILD_SHOWCASE_R2 = BUILD_SHOWCASE_CONCEPTS.filter((c) => c.round === 2);
export const BUILD_SHOWCASE_R1 = BUILD_SHOWCASE_CONCEPTS.filter((c) => c.round === 1);

export const BUILD_SHOWCASE_RUBRIC = [
  { key: "identity", label: "Official art + League stone", weight: 25 },
  { key: "operability", label: "All systems one surface", weight: 25 },
  { key: "density", label: "Density (no dead air)", weight: 20 },
  { key: "shareability", label: "Share / screenshot", weight: 15 },
  { key: "antiSlop", label: "Anti-slop craft", weight: 15 },
] as const;
