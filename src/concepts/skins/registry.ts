/** Live interactive concepts — each id has /concepts/[id] routes with real data. */

export type ConceptKind = "layout" | "color";
export type ShellLayout = "tabs" | "lattice" | "wartable" | "control";
export type ColorSkin = "production" | "parchment" | "dusk" | "editorial";

export type LiveConcept = {
  id: string;
  label: string;
  kind: ConceptKind;
  layout: ShellLayout;
  color: ColorSkin;
  thesis: string;
  round: number;
};

export const LIVE_CONCEPTS: readonly LiveConcept[] = [
  {
    id: "lattice",
    label: "Lattice Bench",
    kind: "layout",
    layout: "lattice",
    color: "production",
    thesis: "Hex/diamond region rail + category tabs. Real catalog.",
    round: 1,
  },
  {
    id: "wartable",
    label: "War Table",
    kind: "layout",
    layout: "wartable",
    color: "production",
    thesis: "Left rail · center stage · right inspector. Real data.",
    round: 1,
  },
  {
    id: "control",
    label: "Control Surface",
    kind: "layout",
    layout: "control",
    color: "production",
    thesis: "System tree · main panel · inspector. Real data.",
    round: 1,
  },
  {
    id: "production",
    label: "Production",
    kind: "color",
    layout: "tabs",
    color: "production",
    thesis: "Current shipped palette, tabs shell.",
    round: 7,
  },
  {
    id: "parchment",
    label: "Parchment",
    kind: "color",
    layout: "tabs",
    color: "parchment",
    thesis: "Light cream site, dark ink.",
    round: 7,
  },
  {
    id: "dusk",
    label: "Dusk",
    kind: "color",
    layout: "tabs",
    color: "dusk",
    thesis: "Mid umber room, brighter text.",
    round: 7,
  },
  {
    id: "editorial",
    label: "Editorial",
    kind: "color",
    layout: "tabs",
    color: "editorial",
    thesis: "Roomier public-site spacing.",
    round: 7,
  },
] as const;

export type LiveSkinId = (typeof LIVE_CONCEPTS)[number]["id"];
export const LIVE_SKINS = LIVE_CONCEPTS;

export function isLiveSkinId(value: string): value is LiveSkinId {
  return LIVE_CONCEPTS.some((s) => s.id === value);
}

export function getLiveSkin(id: string): LiveConcept | undefined {
  return LIVE_CONCEPTS.find((s) => s.id === id);
}

export const CONCEPT_SECTIONS = [
  { slug: "", label: "Home" },
  { slug: "data", label: "Data" },
  { slug: "build", label: "Build" },
  { slug: "tasks", label: "Tasks" },
] as const;
