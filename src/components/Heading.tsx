export function PageHeading({ title, note }: { title: string; note?: string }) {
  return (
    <header className="mb-5">
      <h1 className="font-display text-xl uppercase tracking-[0.16em] text-gold-400 md:text-2xl">
        {title}
      </h1>
      {note ? (
        <p className="mt-1.5 max-w-prose text-sm leading-6 text-parch-100">{note}</p>
      ) : null}
    </header>
  );
}
