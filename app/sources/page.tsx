import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";

export const metadata: Metadata = {
  title: "Sources",
};

const CREDITS = [
  {
    name: "RuneScape Wiki (Weird Gloop)",
    url: "https://runescape.wiki",
    license: "CC BY-NC-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
    note:
      "Primary game-data source. Wiki text and authored data are adapted under Creative Commons Attribution-NonCommercial-ShareAlike 3.0. Per Weird Gloop policy we credit the Wiki, link cited pages via SourceReference fields, and mark that wording/structure are adapted for this tool. Host policy: meta.weirdgloop.org/w/Licensing. Non-text media keep separate file-page terms.",
  },
  {
    name: "PvM Encyclopedia (PvME)",
    url: "https://pvme.io",
    license: "CC BY-NC-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    note:
      "Guides and research notes (github.com/pvme/pvme-guides) are CC BY-NC-SA 4.0. This project uses PvME for mechanics discovery and limited research citations — not a mirror of their guides, Discord, or UI. Adapted PvME material stays under CC BY-NC-SA 4.0. PvME-only figures are not marked verified until re-checked on the Wiki or against Jagex.",
  },
  {
    name: "RS Analysis",
    url: "https://rs-analysis.xyz",
    license: "Site terms",
    licenseUrl: "https://rs-analysis.xyz",
    note:
      "Combat math and model cross-check only. No bulk copy of their UI, code, or guide layout. Rows tagged rs-analysis keep that citation.",
  },
  {
    name: "Jagex Ltd.",
    url: "https://legal.jagex.com/docs/policies/fan-content-policy",
    license: "Fan Content Policy",
    licenseUrl: "https://legal.jagex.com/docs/policies/fan-content-policy",
    note:
      "RuneScape assets, names, and other game IP remain Jagex property. Used non-commercially under the Fan Content Policy. Not endorsed by or affiliated with Jagex. Icons and art under assets/ and public/game/ are not MIT-licensed.",
  },
  {
    name: "Equilibrium source code",
    url: "https://github.com/sonnaya2/Equilibrium/blob/main/LICENSE",
    license: "MIT",
    licenseUrl: "https://github.com/sonnaya2/Equilibrium/blob/main/LICENSE",
    note:
      "Original application code only. Wiki- and PvME-derived data and Jagex media keep the terms above — see repository NOTICE.",
  },
];

export default function SourcesPage() {
  return (
    <Page>
      <PageHeading
        title="Sources"
        note="Where the data comes from and the terms that cover it."
      />

      <section
        id="licenses"
        className="scroll-mt-20 border-b border-stone-800 pb-4"
        aria-labelledby="licenses-heading"
      >
        <h2 id="licenses-heading" className="text-sm font-medium text-parch-50">
          Licence split
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-5 text-parch-300">
          This is a free, non-commercial fan tool. Original code is MIT. Adapted RuneScape Wiki
          material is{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-NC-SA 3.0
          </a>
          . Adapted PvME material is{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-NC-SA 4.0
          </a>
          . Jagex art and marks stay under Jagex&apos;s{" "}
          <a
            href="https://legal.jagex.com/docs/policies/fan-content-policy"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            Fan Content Policy
          </a>
          . Full repository text:{" "}
          <a
            href="https://github.com/sonnaya2/Equilibrium/blob/main/NOTICE"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            NOTICE
          </a>
          .
        </p>
        <p className="mt-2 max-w-prose text-sm leading-5 text-parch-300">
          This tool uses material from the{" "}
          <a
            href="https://runescape.wiki/"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            RuneScape Wiki
          </a>{" "}
          and is licensed under the{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            Creative Commons BY-NC-SA 3.0
          </a>{" "}
          licence for that material. Content is adapted for planner use (structure and wording
          modified; values retained from cited pages). PvME discovery notes, where present, remain
          under{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-NC-SA 4.0
          </a>
          .
        </p>
      </section>

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
              <span className="ml-2 text-xs text-parch-300">
                ·{" "}
                <a
                  href={c.licenseUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
                >
                  {c.license}
                </a>
              </span>
            </dt>
            <dd className="mt-0.5 max-w-prose text-sm leading-5 text-parch-300">{c.note}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-prose text-xs leading-5 text-parch-300">
        Downstream forks: keep footer credits, this page, per-row sources, and the repository{" "}
        <a
          href="https://github.com/sonnaya2/Equilibrium/blob/main/NOTICE"
          className="underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
          target="_blank"
          rel="noreferrer noopener"
        >
          NOTICE
        </a>
        . Do not re-license wiki or PvME adapted data as MIT-only. Not affiliated with Jagex, Weird
        Gloop, PvME, or RS Analysis.
      </p>
    </Page>
  );
}
