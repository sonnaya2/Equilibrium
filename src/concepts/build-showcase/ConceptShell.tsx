"use client";

/**
 * Client shell for a single Build Showcase concept (legacy entry).
 * Prefer BuildShowcaseBleed for the dynamic route.
 */

import { BuildShowcaseBleed } from "./BuildShowcaseBleed";
import type { BuildConceptId } from "./teams";

export function ConceptShell({ id }: { id: BuildConceptId }) {
  return <BuildShowcaseBleed id={id} />;
}
