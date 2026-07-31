---
name: Gold hero copy contrast on public site
description: Why gold hero subheaders need a local scrim, and how contrast was verified
---
Rule: the brand-gold (#e0c474) hero subheaders on the public site pages sit partly over the hero's bottom light fade gradient (the transition into the page background), so a stronger full-hero dark overlay alone can NOT fix contrast — the light fade stacks above it. Each copy line has a local blurred dark scrim (`::before`, `z-index:-1`, blurred solid navy band) that renders above the light fade but below the text.

**Why:** WCAG AA review found gold copy dropping below 4.5:1; measurement showed worst pixels were over the light fade, not bright photo spots.

**How to apply:** if hero copy styling, gradients, or padding change, keep the per-copy scrim (or an equivalent) and re-verify. Verification recipe that works in this env: run the public-site server on a spare port, screenshot with nix-store ungoogled-chromium headless (`--force-prefers-reduced-motion` makes animate-on-scroll content fully visible), render text in magenta vs transparent to build an exact glyph mask, and compute per-glyph-pixel background luminance vs gold (need bg linear luminance ≤ 0.0869 for 4.5:1).
