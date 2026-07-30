# Data platform benchmark

Measured locally on 2026-07-29 with Node v26.4.0. Values are produced by `npm run data:benchmark`; no timings are estimated.

| Scenario | Time | Data files read | Input bytes | Files rewritten | Bytes rewritten |
| --- | ---: | ---: | ---: | ---: | ---: |
| Show one equipment item | 0.71 ms | 1 | 30478336 | 0 | 0 |
| equipment source patch + scoped export diff | 4524.26 ms | 2 | 30478455 | 4 | 684890 |
| training region patch + scoped export diff | 4483.37 ms | 2 | 30478567 | 4 | 477067 |
| cross region patch + scoped export diff | 4485.95 ms | 2 | 30478451 | 3 | 318091 |
| Rebuild one Asgarnia region payload (880 records) | 3.73 ms | 1 | 30478336 | 1 | 102970 |
| Full clean rebuild | 5492.80 ms | 65 | 6396880 | 1 | 30478336 |

Peak RSS during the full rebuild was 254.2 MiB. The clean rebuild regenerated the ignored SQLite file; unchanged frontend artifacts were byte-compared and not rewritten.

The representative equipment correction requires 25 lines of bounded context plus one JSONL patch line.

Scoped patch details:

- equipment source: 3 affected entities; domains/equipment-01.json, domains/equipment-02.json, domains/unlock-01.json, manifest.json.
- training region: 1 affected entities; domains/training-method-01.json, regions/misthalin.json, regions/kandarin.json, manifest.json.
- cross region: 1 affected entities; domains/equipment-02.json, regions/tirannwn.json, manifest.json.
