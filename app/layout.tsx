import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ShareImport } from "@/components/ShareImport";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "RS3 Equilibrium",
    template: "%s · Equilibrium",
  },
  description: "Planner for RS3 Leagues II: Equilibrium. Fan tool, not affiliated with Jagex.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-50 focus:border focus:border-stone-750 focus:bg-stone-850 focus:px-2 focus:py-1.5 focus:text-xs focus:text-gem-400"
        >
          Skip to main content
        </a>
        <Nav />
        <ShareImport />
        <main id="main" className="site-main">
          {children}
        </main>
        <footer className="site-foot">
          <p className="site-foot__legal">
            Created using intellectual property belonging to Jagex Limited under the terms of
            Jagex&apos;s{" "}
            <a
              href="https://legal.jagex.com/docs/policies/fan-content-policy"
              target="_blank"
              rel="noreferrer noopener"
            >
              Fan Content Policy
            </a>
            . This content is not endorsed by or affiliated with Jagex.
          </p>
          <p className="site-foot__mark">RuneScape is a trademark of Jagex Ltd.</p>
          <nav className="site-foot__nav" aria-label="Site">
            <Link href="/sources">Sources</Link>
            <details className="site-foot__licenses">
              <summary>Licenses</summary>
              <div className="site-foot__license-copy">
                <p>
                  <strong>Wiki text and data:</strong> adapted from the{" "}
                  <a href="https://runescape.wiki/" target="_blank" rel="noreferrer noopener">
                    RuneScape Wiki
                  </a>{" "}
                  under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    CC BY-NC-SA 3.0
                  </a>
                  . Non-commercial; share-alike for adapted material; source links credit cited
                  pages. Host policy:{" "}
                  <a
                    href="https://meta.weirdgloop.org/w/Licensing"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Weird Gloop licensing
                  </a>
                  .
                </p>
                <p>
                  <strong>PvME research notes:</strong>{" "}
                  <a href="https://pvme.io/" target="_blank" rel="noreferrer noopener">
                    PvM Encyclopedia
                  </a>{" "}
                  /{" "}
                  <a
                    href="https://github.com/pvme/pvme-guides"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    pvme-guides
                  </a>{" "}
                  under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    CC BY-NC-SA 4.0
                  </a>
                  . Discovery only; not a guide mirror.
                </p>
                <p>
                  <strong>RuneScape assets and names:</strong> Jagex property used under the{" "}
                  <a
                    href="https://legal.jagex.com/docs/policies/fan-content-policy"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Fan Content Policy
                  </a>
                  . Game art here is not for sale. Individual Wiki files may carry separate terms.
                </p>
                <p>
                  <strong>Site code:</strong> MIT License (original code only; see repository{" "}
                  <code>LICENSE</code>). Wiki data, PvME notes, and Jagex assets are outside that
                  grant — see repository <code>NOTICE</code>.{" "}
                  <Link href="/sources#licenses">Full attribution</Link>.
                </p>
              </div>
            </details>
          </nav>
        </footer>
      </body>
    </html>
  );
}
