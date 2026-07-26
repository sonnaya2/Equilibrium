# Team Bravo — STONE UI · Round 1

**Codename:** Stone UI  
**Agents:** bravo-design + bravo-build  
**Thesis:** 2026 Road to Restoration stone UI — classic carved stone panels, clean heritage chrome, public-site craft. Not a SaaS landing. Not a terminal.

## Intent

Jagex’s 2026 Road to Restoration UI refresh reads as **cleaner classic**: stone icon frames, tighter bevels, heritage interface language without the mud of “brown on brown.” Keyart fort architecture and ArtStation stone materials teach the same lesson — material depth from **carve and light**, not from fog, glass, or noise.

Bravo ships a **workbench companion** that feels like a polished public RS tool: dense, scannable, carved, arm’s-length readable. Gem is interaction only. Gold is engraved titles only.

## Accent law (binding)

| Role | Token | Rule |
|---|---|---|
| Active chrome | gem-300 / gem-400 | Selected nav, selected row, focus, primary control |
| Display ink | gold-400 | Brand mark + section titles only — never active state |
| Path triad | chaos / order / balance | Data semantics only — never button chrome |
| Neutrals | stone + parch | ~95% of surface |

## Token map (skin remap)

Scoped under `.restoration-skin--bravo`. Production `@theme` stays untouched. Values are the Bravo proposal; gem/gold match product identity.

| Token | Hex | Role |
|---|---|---|
| `--color-stone-950` | `#0e0c09` | Void — page ground (slightly limestone-dark, not pure black) |
| `--color-stone-900` | `#15120e` | Shell — nav / chrome rail |
| `--color-stone-850` | `#1e1913` | Panel face — carved limestone face |
| `--color-stone-800` | `#272015` | Table stage — reading well |
| `--color-stone-raised` | `#312a1f` | Hover / selected fill (neutral, not gem wash) |
| `--color-stone-zebra` | `#1c1812` | Odd-row stripe |
| `--color-stone-inset` | `#16120d` | Input wells, dig-in fields |
| `--color-stone-750` | `#4f4130` | Border — clean mortar line |
| `--color-stone-carve` | `#6e5a42` | Lit top edge of carve |
| `--bravo-edge-dark` | `#241c14` | Outer heritage frame (shadow edge) |
| `--bravo-mortar` | `#3a3126` | Secondary seam between stacked panels |
| `--color-parch-50` | `#f1ead8` | Primary body ink |
| `--color-parch-100` | `#e2d6bc` | Secondary body / table headers |
| `--color-parch-300` | `#cbbda2` | Labels, quiet body |
| `--color-parch-400` | `#b8a88e` | Meta / captions |
| `--color-parch-500` | `#a69880` | Disabled / whisper |
| `--color-gold-400` | `#e0b264` | Titles only |
| `--color-gold-500` | `#a87c3c` | Quiet gold trim (non-interactive) |
| `--color-gem-300` | `#57e0ae` | Active text |
| `--color-gem-400` | `#2ecb8f` | Active outline / focus |
| `--color-gem-500` | `#1fa372` | Active border weight |
| `--color-gem-600` | `#157a55` | Pressed / deep active |

### Hex summary (copy block)

```
void #0e0c09 · shell #15120e · panel #1e1913 · stage #272015 · raised #312a1f
zebra #1c1812 · inset #16120d · border #4f4130 · carve #6e5a42 · edge-dark #241c14
parch 50#f1ead8 100#e2d6bc 300#cbbda2 400#b8a88e 500#a69880
gold #e0b264 · gem #2ecb8f / #57e0ae
```

## Stone material rules

1. **Carve is the only depth method.** Outer dark edge + main border + 1px inset lit carve. No soft drop-shadow garden. No glass blur.
2. **Heritage double-frame** on primary panels (`.bravo-carved`): `box-shadow: 0 0 0 1px edge-dark` outside the mortar border, plus inset carve highlight. Reads as cut stone, not CSS card.
3. **Face vs well.** Panel faces sit on `stone-850`. Data tables dig to `stone-800` stage. Inputs dig further to `stone-inset`. Hierarchy by depth, not by rainbow.
4. **Top-lit only.** A single horizontal light on the carve edge. No multi-stop brand gradients, no sheen animation.
5. **Corners stay tight.** `2px` max. Stone blocks, not SaaS pills.
6. **No terminal chrome.** No scanlines, no CRT glow, no monospace-as-identity. Mono is for figures only.
7. **No SaaS funnel.** No hero billboard, no three feature cards, no CTA strip. Open on nav + panels + table.
8. **Art is real.** Region crests from `public/game/regions/`. No gen-AI substitutes.

## Type scale

| Step | Size | Weight / face | Use |
|---|---|---|---|
| Brand | 13px | Cinzel · tracking 0.16em · gold-400 | `EQUILIBRIUM` mark |
| Section title | 14–15px | Cinzel · tracking 0.12–0.14em · gold-400 | Panel / page headings |
| Nav link | 13px | Sans medium when active (gem), regular when idle (parch-100) | Primary IA |
| Panel head | 13px | Sans medium · parch-100 | `.panel-head` |
| Data body | **15px** | Sans · parch-50 · line-height 1.4 | Table cells — floor for arm’s-length |
| Secondary data | 14px | Sans · parch-100 / parch-300 | Region, note columns |
| Column head | **12px** | Sans medium · uppercase · tracking 0.06em · parch-100 | Sticky thead |
| Label / meta | 11–12px | Sans · parch-300–400 | Field labels, fixture badges |
| Key figure | 22–28px | Mono tabular · gem-400 | Inspector hero number |
| Caption floor | 11px | Sans · parch-400 | Source lines, fixture disclaimers |

**Contrast floors:** body ≥ 4.5:1 on its surface. Headers use parch-100 on stage, not parch-500 whisper. Never put gold on interactive chrome.

## Layout DNA (R1 preview)

```
┌──────────────────────────────────────────────────────────┐
│ EQUILIBRIUM   Overview  Map  Tasks  Build  Combat  Data  │  shell nav
├────────────┬─────────────────────────────┬───────────────┤
│ Tree rail  │ Table stage (15px data)     │ Inspector     │
│ carved     │ sticky head · zebra · gem   │ gold title    │
│            │ select                      │ key figures   │
└────────────┴─────────────────────────────┴───────────────┘
```

Control Surface topology (tree · table · inspector) remains binding. Bravo’s contribution is **material + type + chrome clarity**, not a new IA.

## Deliverables

| File | Job |
|---|---|
| `bravo-brief.md` | This brief — tokens, material, type |
| `bravo.css` | `.restoration-skin--bravo` variable remap + panel/table polish |
| `BravoPreview.tsx` | Client fixture preview (nav, panels, data-table) |

## Anti-goals (hard)

- SaaS hero / feature-card garden  
- Terminal / cyber / Inter-indigo  
- Gold as active nav  
- EverSense pink / Print skin  
- Inventing league numbers as real facts  
- Gen-AI art  
- Editing production `app/globals.css`
