import Link from "next/link";
import { Page } from "@/components/Page";
import { Pips } from "@/components/Pips";

const STATUS: [string, string][] = [
  ["Launch", "10 Aug 2026, on dedicated league worlds. Free-to-play worlds included."],
  ["Reveals", "Relic and blessing details publish daily from 28 Jul through launch."],
  ["Character", "Fresh league character, separate from your main account."],
  ["Trading", "Disabled between players for this league."],
  ["Rewards", "Sent to a nominated account when the league ends."],
];

const SURFACES = [
  ["/map", "Map", "Pick your six regions, see what each one gates."],
  ["/tasks", "Tasks", "League task tracker with points toward relic tiers."],
  ["/build", "Build", "Regions, relics, blessings and gear in one plan."],
  ["/combat", "Combat", "Damage calculator and rotation sim with league modifiers."],
  ["/data", "Data", "Record counts, sync dates, and sources per dataset."],
] as const;

export default function OverviewPage() {
  return (
    <Page>
      <header className="mb-6">
        <h1 className="font-display text-lg uppercase tracking-[0.16em] text-brass-400">
          Leagues II: Equilibrium
        </h1>
        <p className="mt-1 max-w-prose text-sm text-parch-300">
          Planner and combat calculator for the league. Numbers go in when the Wiki confirms
          them; until then the fields stay empty.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        <section className="panel md:col-span-2">
          <div className="panel-head flex items-center justify-between">
            League status
            <span className="tag">Provisional</span>
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
                  className="w-20 shrink-0 font-medium text-parch-50 transition-colors duration-150 hover:text-brass-300"
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
              <td>6 of 11 unlockable</td>
              <td>
                Misthalin and Havenhythe fixed, Karamja at the first milestone, then 3 of the
                remaining 8.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">Relics</td>
              <td>
                <span className="inline-flex items-center gap-2">
                  <Pips total={7} mode="structure" label="7 relic tiers" /> 7 tiers
                </span>
              </td>
              <td>Return from Leagues: Catalyst, rebalanced. Each tier adds passive bonuses.</td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">Blessings</td>
              <td>
                <span className="inline-flex items-center gap-2">
                  <Pips total={8} mode="structure" label="8 blessing tiers" /> 8 tiers
                </span>
              </td>
              <td>
                One path per tier: <span className="text-order-400">Order</span>,{" "}
                <span className="text-chaos-400">Chaos</span>,{" "}
                <span className="text-balance-400">Balance</span>. Majority path sets the god tier
                blessing at tiers 4 and 8. Three resets.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">Tasks</td>
              <td>Easy to Master</td>
              <td>10–400 league points each, gated by unlocked regions.</td>
            </tr>
            <tr>
              <td className="font-medium text-parch-50">League points</td>
              <td>Earned from tasks</td>
              <td>Drive the trophy tier and relic tier unlocks.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </Page>
  );
}
