import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RS3 Equilibrium",
  description:
    "Planner and combat calculator for RuneScape 3 Leagues II: Equilibrium. Fan tool, not affiliated with Jagex.",
};

const NAV = [
  ["/", "Overview"],
  ["/map", "Map"],
  ["/tasks", "Tasks"],
  ["/build", "Build"],
  ["/combat", "Combat"],
  ["/data", "Data"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-stone-750 bg-stone-950">
          <nav className="mx-auto flex max-w-[1440px] items-baseline gap-5 overflow-x-auto px-4 py-2.5">
            <Link href="/" className="shrink-0 font-mono text-xs tracking-[0.18em] text-parch-50">
              EQUILIBRIUM
            </Link>
            <ul className="flex shrink-0 gap-4 text-sm text-parch-300">
              {NAV.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-parch-50">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <span className="ml-auto hidden shrink-0 text-xs text-parch-300/70 md:block">
              RS3 Leagues II
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6">{children}</main>
        <footer className="mx-auto flex max-w-[1440px] flex-wrap gap-x-2 border-t border-stone-750 px-4 py-4 text-xs text-parch-300">
          <Link href="/sources" className="hover:text-parch-50">
            Sources &amp; Credits
          </Link>
          <span>·</span>
          <span>Fan tool. Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.</span>
        </footer>
      </body>
    </html>
  );
}
