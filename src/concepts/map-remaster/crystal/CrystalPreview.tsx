"use client";

import { RemasterShell } from "../scene/RemasterShell";
import { REMASTER_SKINS } from "../scene/skins";

/** Team Crystal — dusk field + gem ivy skin on production landmasses. */
export function CrystalPreview() {
  return <RemasterShell skin={REMASTER_SKINS.crystal} />;
}

export default CrystalPreview;
