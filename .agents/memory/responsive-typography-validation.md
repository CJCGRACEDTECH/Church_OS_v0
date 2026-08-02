---
name: Responsive typography validation
description: A durable visual QA rule for responsive typography changes on the public church pages.
---

When changing responsive typography on the public church pages, validate at both a narrow 320px viewport and a representative 390px phone viewport, plus a large desktop view. Check hero copy, section headings, buttons, card metadata, and overlap transitions rather than relying on CSS inspection alone.

**Why:** The pages use image fades, negative margins, and overlapping sections. A heading can appear correct in the stylesheet while still becoming cramped, clipped, or visually lost at an edge width.

**How to apply:** Capture representative screenshots after restarting the public-site workflow, and correct wrapping or spacing before considering the typography pass complete.