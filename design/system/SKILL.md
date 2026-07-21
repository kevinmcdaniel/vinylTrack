---
name: squaretrack-design
description: Use this skill to generate well-branded interfaces and assets for SquareTrack (a square-dance calling / sequence-tracking app for callers), either for production or throwaway prototypes/mocks. Contains the color system (light + dark skins), typography, the difficulty-ramp signal, resolution-state language, reusable UI components, and full UI kits for the sequence editor and calling views.
user-invocable: true
---

Read `readme.md` in this skill first — it is the full design guide and manifest. Then explore the relevant files:

- **Foundations:** `styles.css` (link this one file) → `tokens/` for every CSS custom property. Two skins: `:root` (light, for editing/reference) and `[data-theme="dark"]` / `.theme-dark` (live-calling floor). The difficulty ramp (`--diff-1..5`) is shared and must never be recolored.
- **Components:** `components/**` — `.jsx` primitives with `.d.ts` contracts and `.prompt.md` usage notes. Compose these; don't reinvent them.
- **UI kits:** `ui_kits/sequence-editor/` (the hero flow) and `ui_kits/calling/` (Live/Sight/Teaching Order) are self-contained, interactive HTML you can copy from.
- **Product reference:** `docs/architecture/build-plan-sequence-import.md` and `docs/api/` describe the real data model (sequences, choreo modules, FASRs, teach orders).

If creating visual artifacts (mocks, throwaway prototypes, slides): copy assets out and produce static/self-contained HTML for the user to view, linking `styles.css` for tokens. If working on production code, copy assets and apply the rules here to design with the brand.

If the user invokes this skill with no other guidance, ask what they want to build, ask a few focused questions, then act as an expert designer who outputs HTML artifacts **or** production code, matching SquareTrack's look and feel.

Key rules: three fonts by role (Space Grotesk display / Hanken Grotesk body / IBM Plex Mono labels); flat tinted surfaces, no gradients/textures; geometric Unicode marks and abstract CSS formation diagrams instead of an icon set; resolution states (resolved/ambiguous/unresolved) are a first-class color language.
