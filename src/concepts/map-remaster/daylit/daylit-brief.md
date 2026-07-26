# Daylit Reliquary — design notes

**Thesis:** Warm noon war table under a clerestory window. Land reads as lit umber plinths, not mud. Selected region rises on a plinth and stays brightest; others dim without mint-washing the board.

## Scene

- **Key light:** soft sun from upper-left (radial noon wash + soft-light overlay). Land tones mixed toward parchment/noon cream so grain is readable at rest.
- **Water:** deep teal sea with drift shine, caustic spots, and a foam rim hugging the land mass — animated, reduced-motion safe.
- **Vines:** SVG tube (dark stroke + highlight stroke + drop-shadow depth) along land borders, not viewport corners. Leaf ellipses sway subtly on the tube.
- **Slabs:** absolute fixture boxes; focus = translateY lift + tall plinth shadow + gem focus rim only (chrome, not fill flood).

## UI (Board Sky)

```
nav (EQUILIBRIUM · Map · picks)
board (majority height)
ledger strip (keyboard-first region chips)
dossier under board (pin → content + drops tables; honest empty)
```

No side inspector. Pins only for focused region (Misthalin default). Fixture data only.

## Tokens

Editorial stone/parch/gem/gold. Gem on interactive chrome (pressed ledger, pin, focus rim). Gold on brand + dossier title only.

## Win bets vs dark flat board

1. Readable land at rest (noon lift)
2. Unmistakable elevated selection
3. Plants that read as border vegetation
4. Sea that moves like water, not blobs
5. Dense under-board dossier, not a modal carnival
