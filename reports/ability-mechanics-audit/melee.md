# Melee ability audit

Wave status: **static pass largely complete**; runtime sample done; first fixes landed.

Sources: live wiki [Melee abilities](https://runescape.wiki/w/Melee_abilities) + individual pages (2026-08-04).

## Closed findings

| Id | Status | Note |
|----|--------|------|
| `overpower` / `overpower_igneous` | **MISMATCH fixed** | Hit delay +3 ticks; Berserk CD 9s. See `findings/2026-08-04-overpower-berserk-cd-and-hit-delay.md` |
| `icy_tempest` | HONEST_PARTIAL | ST primary + splash-on-primary; multi-target splash unmodeled |
| most basics / enhanced | static **match** (bands, adren, CD, BL) | Runtime still to deep-audit where not covered by existing tests |

## Static wiki vs engine (summary)

| Engine id | Static | Notes |
|-----------|--------|-------|
| attack | OK | auto; +9 adren; 110-130; BL+1 |
| adaptive_strike_2h / _dw | OK | 120-140 / 2×60-75; +12; 5.4s |
| rend | OK | 135-165; BL+2 |
| fury / greater_fury | OK | next-crit effects in MELEE_EFFECTS |
| backhand | OK | stun/charges out of damage scope |
| punish | OK | 2.5× below 50% LP |
| barge / greater_barge | OK | idle add-on in effects |
| chaos_roar | OK | 1.75× / 7.2s next melee |
| dismember | OK bands | heal % unmodeled (outgoing scope); tooltip vs body 25-31% deferred |
| slaughter / massacre | OK | chain gate; no independent CD |
| assault | OK | offsets 1/3/5/7; channelTicks 8 = last+1 |
| flurry / greater_flurry | OK | BL missing-HP; GF berserk extend |
| hurricane | OK | BL 3rd hit; multi-target CD reduce unmodeled |
| overpower* | fixed | see finding |
| pulverise | OK static | on-kill +50% adren may need runtime pin |
| berserk | OK duration | OP CD now implemented |
| meteor_strike | OK | adren buff path tested elsewhere |

## Runtime suspects (not auto-bugs)

- Pulverise on-kill adren (outgoing kill detection)
- Greater Barge idle scaling edge cases
- Dismember heal (out of scope unless product wants self-heal ledger)
- Hurricane per-enemy CD reduction (multi-target)

## Next

- Finish runtime deep-audit for residual suspects with sim repros only when evidence warrants.
- Proceed Phase 3 ranged static + runtime waves.
