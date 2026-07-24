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
        <header className="border-b border-stone-750">
          <nav className="mx-auto flex max-w-6xl items-baseline gap-6 px-4 py-3">
            <Link href="/" className="font-mono text-sm tracking-[0.2em] text-brass-400">
              EQUILIBRIUM
            </Link>
            <ul className="flex gap-4 text-sm text-parch-300">
              {NAV.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-parch-50">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-parch-300">
          <Link href="/sources" className="hover:text-parch-50">
            Sources &amp; Credits
          </Link>
          <span className="px-2">·</span>
          Fan tool. Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.
        </footer>
      </body>
    </html>
  );
}
