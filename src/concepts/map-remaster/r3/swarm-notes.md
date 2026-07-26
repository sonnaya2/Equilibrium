# Map remaster R3 — agent swarm

Parallel pass after R2 WebGPU skins. Reference: [RuneScape:Map](https://runescape.wiki/w/RuneScape:Map) (wiki cartography / surface game coords).

## Swarm

| Agent | Outcome |
|---|---|
| **Markers** | 77/157 pins reprojected via game coords + local georef residual; ring snap; max Δuv 0.150; tests green |
| **Landmass** | Wild taller N-S; Fremennik less squat; Karamja more diamond; islands resized; shared seams held |
| **Shader A** | daylit + boardsky TSL factories (`remasterCap` / `Ocean` / `Vine`) |
| **Shader B** | crystal / cartographer / raised shade tables + material branches |
| **Terrain** | 11× 512px procedural tiles, higher structure/contrast, still 14% BOARD_MEAN grade |

## Georef

`src/map/data/gameCoords.ts` — control landmarks + `gameToUv` affine. Markers use nearest-control residual so stylised board controls stay exact.

## Review

`/concepts/map-remaster` — tab skins; terrain + pins + proportions update production geometry too (`regionShapes`, `placeAnchors`, `public/game/terrain`).
