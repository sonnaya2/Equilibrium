import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RS3 Equilibrium",
  description:
    "Planner and combat calculator for RuneScape 3 Leagues II: Equilibrium. Fan tool, not affiliated with Jagex.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cinzel.variable}>
      <body className="flex min-h-screen flex-col bg-stone-950 font-sans text-parch-50 antialiased">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone-750">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-2 px-4 py-4 text-xs text-parch-500">
            <span>
              Fan tool. Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex
              Ltd.
            </span>
            <Link href="/sources" className="text-parch-300 transition-colors duration-150 hover:text-parch-50">
              Sources &amp; credits
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
