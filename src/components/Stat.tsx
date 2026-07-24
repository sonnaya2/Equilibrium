export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-parch-300">{label}</dt>
      <dd className="num mt-0.5 text-sm text-parch-50">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-parch-500">{hint}</dd> : null}
    </div>
  );
}
