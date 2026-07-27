---
name: anti-clanker-code
description: Remove obvious AI-assisted code signatures before public release without changing behavior. Use for comments, concept-era naming, CSS archaeology, dead scaffolding, implementation jargon, and accumulated agent patches.
---

# Anti-Clanker Code Cleanup

Make the repository read like maintained software rather than a transcript of repeated agent passes.

## Keep

Keep comments that explain security boundaries, browser behavior, accessibility contracts, data provenance, licensing, non-obvious RuneScape rules, and failure modes that cannot be inferred from the code.

## Remove or rewrite

Remove comments and names that narrate the next line, advertise quality, preserve prompt history, use design-tournament language, describe obsolete alternatives, or sound like instructions to another model.

Prefer literal responsibility-based names. Feature ownership and domain vocabulary are better than invented visual themes.

## CSS

Do not stack another override pass. Consolidate the effective rule, move it to the owning route or component stylesheet, reduce specificity, and verify the rendered route before and after.

## Audit

Search for `champion`, `DNA`, `Composite`, ``, `USER PASS`, `final pass`, `production skin`, `concept`, `R2`, `no gen-AI`, `not SaaS`, `working surface`, `load-bearing`, `clanker`, and `agent`.

Review TODOs, disabled lint rules, empty catches, broad casts, dead props, one-shot scripts, and generated reports. Separate behavior-neutral cleanup from functional changes.

## Release standard

A random source file should communicate the product, domain, and technical constraints without revealing the sequence of prompts that produced it.
