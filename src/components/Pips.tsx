export function Pips({
  total,
  filled = 0,
  mode = "progress",
  label,
}: {
  total: number;
  filled?: number;
  mode?: "progress" | "structure";
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const on = mode === "structure" || i < filled;
        return (
          <svg key={i} width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 1 14 4.5v7L8 15 2 11.5v-7z"
              fill={on ? "var(--color-gem-600)" : "none"}
              stroke={on ? "var(--color-gem-500)" : "var(--color-stone-750)"}
              strokeWidth="1.5"
            />
          </svg>
        );
      })}
    </span>
  );
}
