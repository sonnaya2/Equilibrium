import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type SongPatchRow = {
  op: string;
  path: string;
  body: {
    id: string;
    bonuses: { accuracy: number; damage: number };
    setId: string;
    specialAttackId?: string;
    slot: string;
    style: string;
    tier: number;
    unlock: { regions: string[]; requirement: string; type: string };
    sources: Array<{ url: string; verifiedAt: string }>;
  };
};

const patchRows = readFileSync(
  resolve(process.cwd(), "data/patches/2026-08-09-song-of-destruction.jsonl"),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as SongPatchRow);

describe("Song of Destruction equipment patch", () => {
  it("keeps the full Roar and Ode records at their live record paths", () => {
    expect(patchRows.map(({ op, path }) => ({ op, path }))).toEqual([
      { op: "set-record", path: "$.records[36]" },
      { op: "set-record", path: "$.records[37]" },
    ]);
    expect(patchRows.map(({ body }) => body.unlock)).toEqual([
      { regions: ["misthalin"], requirement: "League self-supply: misthalin", type: "drop" },
      { regions: ["misthalin"], requirement: "League self-supply: misthalin", type: "drop" },
    ]);
  });

  it("records current weapon stats and native-special ownership", () => {
    const roar = patchRows[0]!.body;
    const ode = patchRows[1]!.body;
    expect(roar).toMatchObject({
      id: "item:roar-of-awakening",
      bonuses: { accuracy: 2765, damage: 912 },
      setId: "song-of-destruction",
      specialAttackId: "soulfire",
      slot: "mainhand",
      style: "magic",
      tier: 95,
    });
    expect(ode).toMatchObject({
      id: "item:ode-to-deceit",
      bonuses: { accuracy: 2765, damage: 456 },
      setId: "song-of-destruction",
      slot: "offhand",
      style: "magic",
      tier: 95,
    });
    expect(ode.specialAttackId).toBeUndefined();
    expect([...roar.sources, ...ode.sources].every(({ verifiedAt }) => verifiedAt === "2026-08-09")).toBe(
      true,
    );
  });
});
