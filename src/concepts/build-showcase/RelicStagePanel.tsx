"use client";

/**
 * Reusable relic court stage — extracted from CourtRail's stage that reads well:
 * tier label · choice listbox · sealed empty · seated effects · optional splash.
 * Parents load r3-build.css; this file does not re-import it.
 */

import { EffectsList, RelicChoiceButton } from "./R3Shared";

export type RelicStageChoice = {
  name: string;
  effects: string[];
};

export type RelicStagePanelProps = {
  tier: number;
  revealed: boolean;
  choices: RelicStageChoice[];
  seatedName: string | null;
  seatedEffects: string[];
  /** Optional portrait above effects (CourtRail places splash in the rail). */
  splashSrc?: string;
  onPick: (name: string) => void;
};

export function RelicStagePanel({
  tier,
  revealed,
  choices,
  seatedName,
  seatedEffects,
  splashSrc,
  onPick,
}: RelicStagePanelProps) {
  const open = revealed && choices.length > 0;

  return (
    <section className="r3-court__stage" aria-label="Relic court">
      <p className="r3-label">
        Tier {tier}
        {revealed ? "" : " · sealed"}
      </p>

      <div role="listbox" aria-label="Relic choices">
        {open
          ? choices.map((relic) => (
              <RelicChoiceButton
                key={relic.name}
                name={relic.name}
                selected={seatedName === relic.name}
                onPick={() => onPick(relic.name)}
              />
            ))
          : null}
        {!open ? <p className="r3-muted">Sealed until reveal.</p> : null}
      </div>

      <div>
        {splashSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="r3-splash mb-2" src={splashSrc} alt="" />
        ) : null}
        <EffectsList name={seatedName} effects={seatedEffects} />
      </div>
    </section>
  );
}
