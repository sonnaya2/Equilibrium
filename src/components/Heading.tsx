export function PageHeading({ title, note }: { title?: string; note?: string }) {
  if (!title && !note) return null;
  return (
    <header className="mb-2">
      {title ? (
        <h1 className="font-display text-base uppercase tracking-[0.12em] text-gold-400 md:text-lg">
          {title}
        </h1>
      ) : null}
      {note ? (
        <p
          className={`max-w-prose text-[13px] leading-snug text-parch-300${title ? " mt-0.5" : ""}`}
        >
          {note}
        </p>
      ) : null}
    </header>
  );
}
