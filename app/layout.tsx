import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Cinzel } from "next/font/google";
import "./globals.css";
import "./champion.css";
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
      <body className="eq-champion flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-50 focus:border focus:border-stone-750 focus:bg-stone-850 focus:px-2 focus:py-1.5 focus:text-xs focus:text-gem-400"
        >
          Skip to main content
        </a>
        <Nav />
        <ShareImport />
        <main id="main" className="comp-stage flex-1">
          {children}
        </main>
        <footer className="comp-foot">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span>
              Fan tool · not Jagex. RuneScape is a trademark of Jagex Ltd.
            </span>
            <span className="text-stone-750" aria-hidden>
              ·
            </span>
            <Link href="/concepts" className="hover:text-parch-50">
              Concepts
            </Link>
            <Link href="/concepts/hybrid" className="hover:text-parch-50">
              Hybrid
            </Link>
            <Link href="/sources" className="hover:text-parch-50">
              Sources
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
