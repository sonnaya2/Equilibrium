import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { Pips } from "@/components/Pips";

export const metadata: Metadata = {
  title: { absolute: "RS3 Equilibrium" },
  description:
    "Planner, task tracker, and combat calculator for RuneScape 3 Leagues II: Equilibrium. Fan tool, not affiliated with Jagex.",
};

const STATUS: [string, string][] = [
  ["Launch", "10 Aug 2026 on dedicated League worlds."],
  ["Reveals", "New Relic and Blessing details are being published through launch."],
  ["Character", "You start fresh on a League character separate from the main game."],
  ["Trading", "Player-to-player trading is disabled."],
  ["Rewards", "Final rewards go to the account you nominate."],
];

const SURFACES = [
  ["/map", "Map", "Plan your 3 elective region picks and see what each one opens up."],
  ["/tasks", "Tasks", "Track League tasks and the points that drive progression."],
  ["/build", "Build", "Keep regions, Relics and Blessings in one plan."],
  ["/combat", "Combat", "Current RS3 damage math with League modifiers layered on top."],
  ["/data", "Data", "Browse the game data behind the planner and follow its sources."],
] as const;

export default function OverviewPage() {
  return (
    <Page>
      <PageHeading
        title="Leagues II: Equilibrium"
        note="Current game data comes from the Wiki. Fresh League reveals use Jagex until the Wiki catches up. Anything that has not been published stays blank."
      />

      <div className="grid gap-4 md:grid-cols-5">
        <section className="panel md:col-span-2">
          <div className="panel-head flex items-center justify-between">
            League status
            <span className="tag">Pre-launch</span>
          </div>
          <dl className="panel-body space-y-3">
            {STATUS.map(([label, text]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-[0.08em] text-parch-300">{label}</dt>
                <dd className="mt-0.5 text-sm text-parch-100">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel md:col-span-3">
          <div className="panel-head">Planner</div>
          <ul>
            {SURFACES.map(([href, name, purpose]) => (
              <li
                key={href}
                className="flex items-baseline gap-4 border-b border-stone-800 px-3.5 py-2.5 last:border-b-0"
              >
                <Link
                  href={href}
                  className="w-20 shrink-0 font-medium text-parch-50 transition-colors duration-150 hover:text-gem-300"
                >
                  {name}
                </Link>
                <span className="text-sm text-parch-300">{purpose}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel mt-4">
        <div className="panel-head">The league in numbers</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>System</th>
              <th>Structure</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-parch-50">Regions</td>
              <td>2 start + Karamja + 3 picks</td>
              <td>
                Misthalin and Havenhythe start open. Karamja follows the first milestone, then you choose
                3 of the remaining 8 regions.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">Relics</td>
              <td>
                <span className="inline-flex items-center gap-2">
                  <Pips total={7} mode="structure" label="7 relic tiers" /> 7 tiers
                </span>
              </td>
              <td>League Points unlock each tier. Only revealed choices appear in the planner.</td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">Blessings</td>
              <td>
                <span className="inline-flex items-center gap-2">
                  <Pips total={8} mode="structure" label="8 blessing tiers" /> 8 tiers
                </span>
              </td>
              <td>
                Order, Chaos or Balance choices feed into God Tier Blessings at tiers 4 and 8. Up to 3
                resets are available during the League.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">Tasks</td>
              <td>Easy to Master</td>
              <td>10 / 30 / 80 / 200 / 400 League Points by tier.</td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">League Points</td>
              <td>Earned from tasks</td>
              <td>Set trophy progress and unlock Relic tiers.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </Page>
  );
}
