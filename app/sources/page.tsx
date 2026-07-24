import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";

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
    <Page>
      <PageHeading
        title="Sources & credits"
        note="Every combat number in this tool traces back to a source. When a figure disagrees with the game, the source reference attached to it is the place to start."
      />
      <dl>
        {CREDITS.map((c) => (
          <div key={c.name} className="border-b border-stone-800 py-3 last:border-b-0">
            <dt className="text-sm">
              <a
                href={c.url}
                className="font-medium text-parch-50 transition-colors duration-150 hover:text-brass-300"
                rel="noreferrer noopener"
              >
                {c.name}
              </a>
            </dt>
            <dd className="mt-0.5 max-w-prose text-sm text-parch-300">{c.note}</dd>
          </div>
        ))}
      </dl>
    </Page>
  );
}
