/** Gallery War — 10 fighters, 3 rounds, PM executes failure. Prize: production /tasks. */

export type GalleryWarId =
  | "ash"
  | "ember"
  | "grove"
  | "vault"
  | "cipher"
  | "bastion"
  | "quill"
  | "crucible"
  | "sigil"
  | "oracle";

export type GalleryWarTeam = {
  id: GalleryWarId;
  codename: string;
  thesis: string;
};

export const GALLERY_WAR_PASS = 9.2;
export const GALLERY_WAR_PRIZE = "250k + production /tasks";

export const GALLERY_WAR_TEAMS: GalleryWarTeam[] = [
  { id: "ash", codename: "Ashen Ledger", thesis: "Stone-heavy, minimal gradient, wiki-card density" },
  { id: "ember", codename: "Ember Plate", thesis: "Gem facet edge; selected tile lit plate" },
  { id: "grove", codename: "Grove Grid", thesis: "Tighter auto-fill minmax; more columns @1440" },
  { id: "vault", codename: "Vault Medallion", thesis: "Oversized crest medallion; name under crest" },
  { id: "cipher", codename: "Cipher Strip", thesis: "Compact meta ribbon; mono Comp%/pts strip" },
  { id: "bastion", codename: "Bastion Stack", thesis: "2-col until xl; fewer wider cards" },
  { id: "quill", codename: "Quill Index", thesis: "Facet bar single scroll track; max board height" },
  { id: "crucible", codename: "Crucible Virt", thesis: "Full virtualized card window — no 120 cap" },
  { id: "sigil", codename: "Sigil Focus", thesis: "Expand = full-width band under card row" },
  { id: "oracle", codename: "Oracle Quiet", thesis: "Flat carved surfaces; zero decorative glow" },
];

export function getGalleryWarTeam(id: string): GalleryWarTeam | undefined {
  return GALLERY_WAR_TEAMS.find((t) => t.id === id);
}

export function isGalleryWarId(id: string): id is GalleryWarId {
  return GALLERY_WAR_TEAMS.some((t) => t.id === id);
}
