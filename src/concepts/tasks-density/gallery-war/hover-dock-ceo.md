# CEO verdict — Hover Dock revision (Tasks gallery)

**Date:** 2026-07-26  
**Surface:** production `/tasks` Cipher gallery  
**Bar:** ship if ops + scan clear 9.2-class; kill mid-row expand tax

## Competitive field (short)

| Contender | Thesis | Kill reason / result |
|---|---|---|
| **A — Mid-row band** (prior ship) | Detail under selected row | Loses board height; eye jumps down; click fought complete |
| **B — Side inspector** | Fixed right bay | Twin-desk DNA, not gallery DNA; wastes width on dense cards |
| **C — Hover top dock** | Hover opens sticky dock under track; click = complete | **WINS** |

## Ship decisions

1. **Hover → dock, click → complete.** Scan without committing; complete is one click on the face. Expand ≠ complete holds (dock is not a click state).
2. **Dock at top.** Always under the filter track — never injects height into a virtualized row. Board estimate stays flat (`ROW_EST_PX` only).
3. **World Map icon** for global tasks (wiki `World Map icon.png`, local copy, CC BY-NC-SA). Rail + card + dock. No letter “G”.
4. **Header scale-up.** Page chrome + track title/count/chips to working size (≥14px data, larger display gold).
5. **Wiki Comp% link lives in dock** so the card face stays a single complete control (no nested `<a>` in `<button>`).

## Score (CEO)

| Axis | Score | Note |
|---|---|---|
| Scan / readability | **9.25** | Names + pts stack; dock prose at top where the eye already is |
| Ops | **9.3** | Full virt, filters, My build, hover bridge to dock, touch opens on press |
| Density | **9.15** | No mid-row band tax; dock steals a fixed strip only while hovered |
| Signature | **9.2** | Crest outline + world icon + top gem dock — gallery, not table clone |
| **Composite** | **9.22** | Promote |

## Touch

No true hover — `pointerdown` touch/pen opens dock; click still completes. Hint line hides on `(hover: none)`.
