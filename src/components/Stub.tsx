export function Stub({ title, note }: { title: string; note: string }) {
  return (
    <section>
      <h1 className="font-mono text-xs tracking-[0.2em] text-brass-400">{title.toUpperCase()}</h1>
      <p className="mt-3 max-w-prose text-sm text-parch-300">{note}</p>
    </section>
  );
}
