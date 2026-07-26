# Wiki Dense — Round 2 · Agent F

**Thesis:** Tables fail when body ink sits too dark on warm stone and rows
bleed together. Steal the RuneScape Wiki dark-mode move — higher body
luminance, zebra or hairline separation, 15px data, 12px labels that still
clear 4.5:1 — without leaving the warm umber identity for slate cyber.

**Fixture only.** `WikiDenseMock.tsx` + this note. No production CSS/token
edits. Control Surface shell (R1 winner) stays the layout DNA; this pass is
color + type scale clarity on that skeleton.

---

## Palette (canonical tokens only)

All from `app/globals.css` `@theme`. Inline hex in product JSX is a defect;
this mock uses Tailwind token classes only.

| Role | Token | Hex | Use here |
|---|---|---|---|
| Void ground | `stone-950` | `#0d0a07` | Page + even table rows |
| Deep rail | `stone-900` | `#14100b` | Tree, inspector, zebra odd rows |
| Panel | `stone-850` | `#1b1610` | Selected row / active leaf fill |
| Raised | `stone-800` | `#231d15` | (available; zebra prefers 900/950) |
| Hairline | `stone-750` | `#332a1e` | Borders, sticky head bottom edge |
| Carve | `stone-carve` | `#463a29` | `.panel` inset only |
| **Body ink** | **`parch-50`** | **`#efe7d5`** | Primary table cells, titles |
| Secondary ink | `parch-100` | `#d3c8b0` | Labels, secondary cells, inactive tab hover target |
| Meta | `parch-300` | `#a99f88` | Scale legend, count meta — never sole body |
| Mute (avoid as text) | `parch-400` / `500` | `#948a73` / `#8b7f68` | Decoration only; `parch-500` fails body contrast |
| Active chrome | `gem-300` / `500` | `#57e0ae` / `#1fa372` | Selected tab ink + border; selected row outline |
| Key figure | `gem-400` | `#2ecb8f` | Mono key number only |
| Display ink | `gold-400` | `#e0b264` | Inspector `Record` heading only — never tabs |

**What changed vs weak production tables**

1. Body cells: `parch-50` (not `parch-300` / `parch-100` only).
2. Column headers: `parch-100` at 12px (not `parch-400` at 11px uppercase murk).
3. Zebra: odd `bg-stone-900`, even `bg-stone-950` + `border-stone-750` hairlines.
4. Sticky thead: solid `bg-stone-950` so rows do not show through.
5. Active tab: `text-gem-300` + `border-gem-500` — stronger gem, gold untouched.
6. Tree / filter labels: 12–13px `parch-100`, not 11px `parch-400`.

Warm umber stays. No `slate-*`, no cool gray void, no order-blue chrome.

---

## Type scale (rem / px @ 16px root)

| Step | rem | px | Role |
|---|---:|---:|---|
| Meta floor | 0.6875 | **11** | Counts, scale legend mono, densest chrome only |
| **Label** | **0.75** | **12** | Column headers, field labels, tab text, inspector dt/dd |
| Tree leaf | 0.8125 | **13** | Category tree rows |
| **Data** | **0.9375** | **15** | Table cell body (Wiki-dense working size) |
| Title | 0.9375–1 | 15–16 | Panel h2 / record name |
| **Key figure** | **1.25–1.375** | **20–22** | Inspector mono key (floor 20px / `data-readability`) |
| Display | Cinzel | — | Gold engraved headings only |

**Binding floors** (`equilibrium-ui` / `data-readability`):

- Data working ≥14px → this concept sets **15px** for head-still scanning.
- Labels ≥11px → this concept sets **12px** so labels still pass contrast when ink is raised.
- Key figure ≥20px mono + `tabular-nums`.
- Body contrast ≥4.5:1 on its surface.

Rough contrast (approx on `stone-950` / `stone-900`):

- `parch-50` on void/deep: passes easily for body.
- `parch-100` on void/deep: labels OK.
- `parch-300` on void: meta only; do not use for table data.
- `parch-500` on void: **fails** as body ink — known defect; never primary text.

---

## Table rules

1. **Sticky header** — `thead` sticky with opaque `bg-stone-950` (or panel ground matching the scrollport). Transparent sticky heads are a defect.
2. **Zebra** — alternate `stone-950` / `stone-900`. If zebra is dropped, keep **1px `stone-750` hairlines** between every row; never rely on whitespace alone.
3. **Selected row** — `stone-850` fill + 1px gem outline (inset). Gem only on selection; no glow at rest.
4. **Data size** — 15px / `text-[15px]` on `td`. Do not compress working tables to 12–13px body.
5. **Headers** — 12px, medium weight, `parch-100`. Optional slight tracking; avoid all-caps + low luminance together.
6. **Numeric columns** — `font-mono` + `tabular-nums` (body already has tabular-nums globally).
7. **Density** — row pad ~6px vertical (`py-1.5`); no 40px+ voids inside the table stage.
8. **Pairing** — table + inspector stay on one head-still plane (Control Surface DNA).

---

## bot-audit fails if done wrong

| Failure | Why it fails |
|---|---|
| Gold on active tabs / selected rows | Gold is display ink only; interactive chrome is gem |
| Order-blue or chaos fill as chrome | Path triad is blessing data only |
| `slate-*` / cool gray void | Breaks warm umber identity → cyber SaaS fingerprint |
| Rainbow gradients / glassmorphism default | no-slop-ui fingerprint bans |
| Glow at rest / idle pulse | Motion only on state change; selection outline is OK |
| Marketing hero above the table | Tools open on the working surface |
| `parch-500` (or similar) as table body | Contrast fail; hard readability axis hit |
| 11px body data to “look dense” | Below data floor; density ≠ illegibility |
| Sticky head without solid fill | Rows read through headers → bot-audit + readability |
| Invented league numbers as real | Hard fail on rubric; fixtures must be labeled |
| EverSense pink / Print skin | Wrong product |
| Gem on every row / every label | Accent inflation; gem = active only |
| Cloned wiki/rs-analysis markup | Lesson stolen, layout not copied |

**What should PASS bot-audit here**

- Dark warm ground (sanctioned exception for this product).
- Gem active tab + selected row outline; gold on “Record” only.
- Fixture rows labeled; no hero; no path colors as buttons.
- Focus-visible gem ring via global rules; reduced-motion respected (no decorative animation).

---

## Ship path (if promoted)

Not this PR. If CEO picks Wiki Dense for readability:

1. Raise default `.data-table td` ink toward `parch-50` / `parch-100`.
2. Add optional zebra utility or odd-row `stone-900` in `globals.css` only after a deliberate token decision — still no new hex outside `@theme`.
3. Column headers: 12px, brighter than current `parch-300` + 11px uppercase default.
4. Keep 15px as the dense-table working size on Data/Tasks/Combat reference tables.
5. Re-run visual check at 1440×900; confirm ≥4.5:1 on body and labels.

---

## Paths

| File | Role |
|---|---|
| `src/concepts/r2/WikiDenseMock.tsx` | Client fixture mock |
| `src/concepts/r2/wiki-dense.md` | Tokens, type scale, table rules, audit traps |
| `src/concepts/ConceptFrame.tsx` | Shared lab chrome + fixture rows (unchanged) |
| `app/globals.css` | Canonical tokens (not edited this round) |
