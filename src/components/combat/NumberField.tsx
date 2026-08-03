"use client";

/** Shared numeric field row for combat tabs. Number inputs yield NaN/Infinity on
 *  partial input - clamping happens at the consumer's engine boundary. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="loadout-number">
      <span>{label}</span>
      <span className="loadout-control">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span className="text-parch-300">{suffix}</span> : null}
      </span>
    </label>
  );
}
