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
    note: "Wiki-authored text and data are adapted under CC BY-NC-SA 3.0. Source links credit contributors and identify the material changed for this tool; individual files may use separate terms.",
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
    url: "https://legal.jagex.com/docs/policies/fan-content-policy",
    note: "RuneScape assets, names, and other game IP remain Jagex property and are used under Jagex's Fan Content Policy. This project is not endorsed by or affiliated with Jagex.",
  },
  {
    name: "Equilibrium source code",
    url: "https://github.com/sonnaya2/Equilibrium/blob/main/LICENSE",
    note: "Original application code is available under the MIT License. External data and game assets keep their own terms above.",
  },
];

export default function SourcesPage() {
  return (
    <Page>
      <PageHeading
        title="Sources"
        note="Where the data comes from and the terms that cover it."
      />
      <dl id="licenses" className="mt-1 scroll-mt-20">
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
