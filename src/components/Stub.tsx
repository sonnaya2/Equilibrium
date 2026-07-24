export function Stub({ title, note }: { title: string; note: string }) {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight text-parch-50">{title}</h1>
      <p className="mt-3 max-w-prose text-sm text-parch-300">{note}</p>
    </section>
  );
}
