"use client";

import { RemasterShell } from "../scene/RemasterShell";
import { REMASTER_SKINS } from "../scene/skins";

/** Team Daylit — noon war table skin on production landmasses. */
export function DaylitPreview() {
  return <RemasterShell skin={REMASTER_SKINS.daylit} />;
}

export default DaylitPreview;
