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
    note: "Main game-data source. Text is adapted (wording and structure change; values keep their cited pages). Images follow each file’s own terms. Host notes: meta.weirdgloop.org/w/Licensing.",
  },
  {
    name: "PvM Encyclopedia (PvME)",
    url: "https://pvme.io",
    license: "CC BY-NC-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    note: "Used for mechanics discovery and a few citations (pvme-guides). Not a mirror of their guides or UI. PvME-only numbers are not marked verified until re-checked on the Wiki or Jagex.",
  },
  {
    name: "RS Analysis",
    url: "https://rs-analysis.xyz",
    license: "Site terms",
    licenseUrl: "https://rs-analysis.xyz",
    note: "Combat math cross-check only. Their site layout and code are not copied. Rows tagged rs-analysis keep that citation.",
  },
  {
    name: "Jagex Ltd.",
    url: "https://legal.jagex.com/docs/policies/fan-content-policy",
    license: "Fan Content Policy",
    licenseUrl: "https://legal.jagex.com/docs/policies/fan-content-policy",
    note: "Game art, names, and marks stay Jagex property. Used non-commercially under the Fan Content Policy. Not endorsed by Jagex. Files under public/game/ are not MIT.",
  },
  {
    name: "Equilibrium source code",
    url: "https://github.com/sonnaya2/Equilibrium",
    license: "MIT",
    licenseUrl: "https://github.com/sonnaya2/Equilibrium/blob/main/LICENSE",
    note: "Original app code only. Wiki/PvME data and Jagex media keep the terms above. See repository NOTICE.",
  },
];

export default function SourcesPage() {
  return (
    <Page>
      <PageHeading title="Sources" note="Where numbers and art come from." />

      <section
        id="licenses"
        className="scroll-mt-20 border-b border-stone-800 pb-4"
        aria-labelledby="licenses-heading"
      >
        <h2 id="licenses-heading" className="text-sm font-medium text-parch-50">
          Licence split
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-5 text-parch-300">
          Free fan tool. App code is MIT. Game art is Jagex&apos;s and not for sale. Wiki text we
          adapted is{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-NC-SA 3.0
          </a>
          . PvME notes stay{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            className="text-parch-50 underline decoration-stone-750 underline-offset-2 hover:decoration-parch-300"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-NC-SA 4.0
          </a>
          . Full wording lives in the repo <code>NOTICE</code>.
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
        Downstream forks: keep footer credits, this page, per-row sources, and the repository
        NOTICE. Do not re-license wiki or PvME adapted data as MIT-only. Not affiliated with Jagex,
        Weird Gloop, PvME, or RS Analysis.
      </p>
    </Page>
  );
}
