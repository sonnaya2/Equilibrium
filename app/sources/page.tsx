const CREDITS = [
  {
    name: "RuneScape Wiki",
    url: "https://runescape.wiki",
    note: "Primary source for current-game mechanics, ability and equipment values, and update histories. Wiki-derived material is used under the Wiki's attribution and licensing terms.",
  },
  {
    name: "RS Analysis",
    url: "https://rs-analysis.xyz",
    note: 'Math and validation reference, including the authors of "Quantitative Analysis of RuneScape 3 Combat" where its concepts or results are referenced. No code, UI, or copy taken.',
  },
  {
    name: "PvM Encyclopedia (PvME)",
    url: "https://pvme.io",
    note: "Used to discover mechanics and interactions worth investigating. Values are re-verified against current sources before use.",
  },
  {
    name: "leagues.build",
    url: "https://leagues.build",
    note: "UX inspiration for League planner flow only. Not a data or visual source.",
  },
  {
    name: "Jagex",
    url: "https://www.runescape.com",
    note: "Official game and League information. RuneScape is a trademark of Jagex Ltd. This is a fan tool, not affiliated with or endorsed by Jagex.",
  },
];

export default function SourcesPage() {
  return (
    <section>
      <h1 className="font-mono text-xs tracking-[0.2em] text-brass-400">SOURCES &amp; CREDITS</h1>
      <p className="mt-3 max-w-prose text-sm text-parch-300">
        Every combat number in this tool is meant to trace back to a source. If a figure here disagrees
        with the game, the source reference attached to it is the place to start.
      </p>
      <dl className="mt-6 space-y-5">
        {CREDITS.map((c) => (
          <div key={c.name}>
            <dt className="text-sm">
              <a href={c.url} className="text-brass-400 hover:underline" rel="noreferrer noopener">
                {c.name}
              </a>
            </dt>
            <dd className="max-w-prose text-sm text-parch-300">{c.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
