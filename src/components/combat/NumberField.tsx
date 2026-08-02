"use client";

/** Shared numeric field row for combat tabs. Number inputs yield NaN/Infinity on
 *  partial input — clamping happens at the consumer's engine boundary. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid grid-cols-[1fr_110px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-300">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full border border-stone-750 bg-transparent px-2 py-1 text-right font-mono text-xs text-parch-50"
        />
        {suffix ? <span className="text-parch-300">{suffix}</span> : null}
      </span>
    </label>
  );
}
