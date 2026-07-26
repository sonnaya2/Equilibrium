"use client";

import { RemasterShell } from "../scene/RemasterShell";
import { REMASTER_SKINS } from "../scene/skins";

/** Team Raised — stage plinth + volume hedges on production landmasses. */
export function RaisedPreview() {
  return <RemasterShell skin={REMASTER_SKINS.raised} />;
}

export default RaisedPreview;
