# R4 — Daylit Reliquary quality champion

Dedicated Daylit path (not multi-skin soup):

| Module | Role |
|---|---|
| `materials/daylitVine.ts` | Olive plant stem/tendril/leaf; path growth via UV.x |
| `materials/daylitCap.ts` | Noon terrain + warm rim focus + carved walls |
| `materials/daylitOcean.ts` | Multi-swell + fresnel graze, no fractal |
| `RemasterVines.tsx` | Dual tubes, dense leaves, wind/flutter, no scale.y growth |

Growth: ends → middle (opacity), not vertical squash.  
Idle: vines flutter while ocean 30Hz keeps demand loop awake.  
Reduced motion: snap growth, freeze wind.
