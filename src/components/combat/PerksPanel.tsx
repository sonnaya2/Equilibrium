"use client";

import { NumberField } from "./NumberField";
import type { Loadout } from "./useLoadout";

const PERK_FIELDS = [
  ["equilibrium", "Equilibrium rank (+6% +2%/rank AD, no crits)", 4],
  ["eruptive", "Eruptive rank (+0.5%/rank AD)", 4],
  ["biting", "Biting rank (+2%/rank crit; +2.2% if lvl20)", 4],
  ["ultimatums", "Ultimatums rank (+3% +1%/rank ult)", 4],
  ["lunging", "Lunging rank (+10% +3%/rank Combust/Dismember)", 4],
  ["energising", "Energising rank (+50 +25/rank accuracy)", 4],
  ["tectonicPieces", "Tectonic pieces (+1%/piece crit)", 5],
  ["tumekensPieces", "Tumeken's pieces (+1.5%/piece crit)", 5],
] as const;

/** Sourced perk ranks and set toggles — unsourced perks stay out. */
export function PerksPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-parch-50">Perks &amp; sets</h2>
      <p className="mt-1 text-xs text-parch-300">
        Only sourced current values — unsourced perks stay out rather than guessed.
      </p>
      <div className="mt-3 border-t border-stone-750">
        {PERK_FIELDS.map(([key, label, max]) => (
          <NumberField
            key={key}
            label={label}
            value={loadout.perks[key]}
            onChange={(value) =>
              setLoadout({
                ...loadout,
                perks: {
                  ...loadout.perks,
                  [key]: Math.min(Math.max(0, Math.floor(value)), max),
                },
              })
            }
          />
        ))}
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.perks.bitingLevel20}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                perks: { ...loadout.perks, bitingLevel20: event.target.checked },
              })
            }
          />
          Biting on level-20 item (+2.2%/rank)
        </label>
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.perks.eliteTectonic}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                perks: { ...loadout.perks, eliteTectonic: event.target.checked },
              })
            }
          />
          Elite tectonic (+2%/piece instead)
        </label>
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.perks.insideSunshine}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                perks: { ...loadout.perks, insideSunshine: event.target.checked },
              })
            }
          />
          Inside Sunshine (Tumeken set(3) active)
        </label>
      </div>
    </div>
  );
}
