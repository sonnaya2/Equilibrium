import { abilityCategoryLabel } from "@/lib/gameArt";

/** Compact category chip matching the revo timeline "basic" badge. */
export function AbilityCategoryChip({
  category,
}: {
  category: "basic" | "enhanced" | "ultimate" | "utility" | string;
}) {
  const label = abilityCategoryLabel(category);
  return (
    <span className="ml-1.5 inline-block border border-gem-600/50 bg-stone-850 px-1 py-px font-mono text-[10px] uppercase tracking-wide text-gem-300">
      {label}
    </span>
  );
}
