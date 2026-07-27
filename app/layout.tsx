import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Cinzel } from "next/font/google";
import "./globals.css";
import "./equilibrium-theme.css";
import { Nav } from "@/components/Nav";
import { ShareImport } from "@/components/ShareImport";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://equilibrium-ruddy.vercel.app"),
  title: {
    default: "RS3 Equilibrium",
    template: "%s · Equilibrium",
  },
  description: "Planner for RS3 Leagues II: Equilibrium. Fan tool, not affiliated with Jagex.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cinzel.variable}>
      <body className="eq-theme flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-50 focus:border focus:border-stone-750 focus:bg-stone-850 focus:px-2 focus:py-1.5 focus:text-xs focus:text-gem-400"
        >
          Skip to main content
        </a>
        <Nav />
        <ShareImport />
        <main id="main" className="site-main flex-1">
          {children}
        </main>
        <footer className="site-footer">
          <p className="site-footer__jagex">
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
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span>RuneScape is a trademark of Jagex Ltd.</span>
            <span className="text-stone-750" aria-hidden>
              ·
            </span>
            <Link href="/sources" className="hover:text-parch-50">
              Sources
            </Link>
            <span className="text-stone-750" aria-hidden>
              ·
            </span>
            <details className="site-footer__licenses">
              <summary>Licenses</summary>
              <div className="site-footer__license-copy">
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
                  <strong>Site code:</strong>{" "}
                  <a
                    href="https://github.com/sonnaya2/Equilibrium/blob/main/LICENSE"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    MIT License
                  </a>{" "}
                  (original code only). Wiki data, PvME notes, and Jagex assets are outside that
                  grant — see{" "}
                  <a
                    href="https://github.com/sonnaya2/Equilibrium/blob/main/NOTICE"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    NOTICE
                  </a>
                  . <Link href="/sources#licenses">Full attribution</Link>.
                </p>
              </div>
            </details>
          </div>
        </footer>
      </body>
    </html>
  );
}
