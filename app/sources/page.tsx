const CREDITS = [
  {
    name: "RuneScape Wiki",
    url: "https://runescape.wiki",
    note: "Primary source for current game mechanics, items, abilities, training data and update history.",
  },
  {
    name: "RS Analysis",
    url: "https://rs-analysis.xyz",
    note: "Used for combat math and rotation analysis where a row is explicitly sourced from it.",
  },
  {
    name: "PvM Encyclopedia (PvME)",
    url: "https://pvme.io",
    note: "Used for PvM practice, perk information and upgrade-order guidance where a row is explicitly sourced from it.",
  },
  {
    name: "leagues.build",
    url: "https://leagues.build",
    note: "Reference for planner flow only. No data or visual assets are copied from it.",
  },
  {
    name: "Jagex",
    url: "https://www.runescape.com",
    note: "Official League announcements and patch notes are used while new information is waiting to be reflected on the Wiki.",
  },
];

export default function SourcesPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight text-parch-50">Sources</h1>
      <p className="mt-3 max-w-prose text-sm leading-6 text-parch-300">
        Game data defaults to the RuneScape Wiki. Entries sourced from PvME or RS Analysis keep their original source and link.
      </p>
      <dl className="mt-6 border-t border-stone-750">
        {CREDITS.map((credit) => (
          <div key={credit.name} className="grid gap-1 border-b border-stone-750/70 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5">
            <dt className="text-sm">
              <a href={credit.url} className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300" rel="noreferrer noopener">
                {credit.name}
              </a>
            </dt>
            <dd className="max-w-3xl text-sm leading-6 text-parch-300">{credit.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
