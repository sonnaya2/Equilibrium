/**
 * Build Showcase tournament.
 * R3 (active): topology-divergent — Court Rail · Twin Desk · Menu Court.
 * R2 failed as isomorphic skins. R1 monogram-era kept for comparison only.
 */

export type BuildConceptId =
  | "court-rail"
  | "twin-desk"
  | "menu-court"
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
  round: 1 | 2 | 3;
};

export const BUILD_SHOWCASE_CONCEPTS: BuildConcept[] = [
  {
    id: "court-rail",
    name: "Court Rail",
    codename: "A · Court Rail",
    thesis:
      "Tier rail left · relic court center · region hive right · blessing lattice belt always on. Spatial zones, not tabs or share plaque.",
    shareAngle: "Desktop court screenshot with lattice belt",
    round: 3,
  },
  {
    id: "twin-desk",
    name: "Twin Desk",
    codename: "B · Twin Desk",
    thesis:
      "Hybrid Tasks/Data shell on Build: region rail · relic stage · inspector (effects + path + share). Categorization by bay.",
    shareAngle: "Three-bay planner crop familiar from Tasks",
    round: 3,
  },
  {
    id: "menu-court",
    name: "Menu Court",
    codename: "C · Menu Court",
    thesis:
      "Hybrid lead: menu structure + court-rail relic stage; compact blessing chips. Craft: Genshin/HSR energy on Equilibrium tokens.",
    shareAngle: "Client-menu-faithful court with full plan belts",
    round: 3,
  },
  {
    id: "war-court",
    name: "War Court",
    codename: "Open Relic Court · R2 fail",
    thesis:
      "FAILED: single viewport three-column + lattice — topology clone of other R2 entries.",
    shareAngle: "Historical only",
    round: 2,
  },
  {
    id: "dossier-board",
    name: "Dossier Board",
    codename: "Art Folio · R2 fail",
    thesis: "FAILED: two-column folio; same bones as War Court under different chrome.",
    shareAngle: "Historical only",
    round: 2,
  },
  {
    id: "herald-stage",
    name: "Herald Stage",
    codename: "Share Stage · R2 fail",
    thesis: "FAILED: share-first plaque as primary surface — not a workbench.",
    shareAngle: "Historical only",
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

export const BUILD_SHOWCASE_R3 = BUILD_SHOWCASE_CONCEPTS.filter((c) => c.round === 3);
export const BUILD_SHOWCASE_R2 = BUILD_SHOWCASE_CONCEPTS.filter((c) => c.round === 2);
export const BUILD_SHOWCASE_R1 = BUILD_SHOWCASE_CONCEPTS.filter((c) => c.round === 1);

export const BUILD_SHOWCASE_RUBRIC = [
  { key: "identity", label: "Official art + League stone", weight: 25 },
  { key: "operability", label: "All systems one surface", weight: 25 },
  { key: "density", label: "Density (no dead air)", weight: 20 },
  { key: "shareability", label: "Share / screenshot", weight: 15 },
  { key: "antiSlop", label: "Anti-slop craft", weight: 15 },
] as const;
