"use client";

import { RemasterShell } from "../scene/RemasterShell";
import { REMASTER_SKINS } from "../scene/skins";

/** Team Cartographer — parchment lift + ink selection on production landmasses. */
export function CartographerPreview() {
  return <RemasterShell skin={REMASTER_SKINS.cartographer} />;
}

export default CartographerPreview;
