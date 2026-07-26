import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel } from "next/font/google";
import "./globals.css";
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
  description:
    "Planner and combat calculator for RuneScape 3 Leagues II: Equilibrium. Fan tool, not affiliated with Jagex.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cinzel.variable}>
      <body className="flex min-h-screen flex-col bg-stone-950 font-sans text-parch-50 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-sm focus:border focus:border-stone-750 focus:bg-stone-850 focus:px-3 focus:py-2 focus:text-sm focus:text-gem-400"
        >
          Skip to main content
        </a>
        <Nav />
        <ShareImport />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-stone-750">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-baseline justify-between gap-2 px-4 py-4 text-xs text-parch-500">
            <span>
              Fan tool. Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex
              Ltd.
            </span>
            <span className="flex flex-wrap items-center gap-3">
              <Link
                href="/concepts"
                className="text-parch-400 transition-colors duration-150 hover:text-parch-50"
              >
                Concepts lab
              </Link>
              <Link
                href="/sources"
                className="text-parch-300 transition-colors duration-150 hover:text-parch-50"
              >
                Sources &amp; credits
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
