import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";

const LABELS: Record<string, string> = {
  "partially-modeled": "partial",
  "not-modeled": "unmodeled",
  "mechanics-unverified": "unverified",
};

/** Status chip for abilities with known gaps; absent when fully covered. */
export function SupportStatusChip({ ability }: { ability: AbilitySpec }) {
  if (!ability.supportStatus) return null;
  return (
    <span
      className="inline-flex items-center border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-amber-300"
      title={ability.supportNote}
    >
      {LABELS[ability.supportStatus] ?? ability.supportStatus}
    </span>
  );
}
