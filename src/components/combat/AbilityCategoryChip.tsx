import { abilityCategoryLabel } from "@/lib/gameArt";

/** Compact category chip - basics blue, thresholds purple, ultimates red. */
export function AbilityCategoryChip({
  category,
}: {
  category: "basic" | "enhanced" | "ultimate" | "utility" | string;
}) {
  const label = abilityCategoryLabel(category);
  const kind =
    category === "enhanced" || label === "threshold"
      ? "threshold"
      : category === "basic"
        ? "basic"
        : category === "ultimate"
          ? "ultimate"
          : category === "utility"
            ? "utility"
            : "utility";

  return (
    <span className={`ability-cat-chip ability-cat-chip--${kind}`} data-category={kind}>
      {label}
    </span>
  );
}
