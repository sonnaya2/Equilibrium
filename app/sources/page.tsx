import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";

export const metadata: Metadata = {
  title: "Sources",
};

const CREDITS = [
  {
    name: "RuneScape Wiki",
    url: "https://runescape.wiki",
    note: "Mechanics under CC BY-NC-SA 3.0. Facts rewritten for this tool.",
  },
  {
    name: "RS Analysis",
    url: "https://rs-analysis.xyz",
    note: "Math reference only — no code or UI taken.",
  },
  {
    name: "PvM Encyclopedia (PvME)",
    url: "https://pvme.io",
    note: "Used for mechanics discovery. Values re-verified here.",
  },
  {
    name: "Jagex",
    url: "https://www.runescape.com",
    note: "Fan tool. Not affiliated with Jagex.",
  },
];

export default function SourcesPage() {
  return (
    <Page>
      <PageHeading
        title="Sources"
        note="Where combat and data numbers come from."
      />
      <dl className="mt-1">
        {CREDITS.map((c) => (
          <div key={c.name} className="border-b border-stone-800 py-3 last:border-b-0">
            <dt className="text-sm">
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-parch-50 transition-colors duration-150 hover:text-gem-300"
              >
                {c.name}
              </a>
            </dt>
            <dd className="mt-0.5 max-w-prose text-sm leading-5 text-parch-300">{c.note}</dd>
          </div>
        ))}
      </dl>
    </Page>
  );
}
