export function PageHeading({ title, note }: { title: string; note?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-lg uppercase tracking-[0.16em] text-gold-400">{title}</h1>
      {note ? <p className="mt-1 max-w-prose text-sm leading-6 text-parch-100">{note}</p> : null}
    </header>
  );
}
