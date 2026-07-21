# SquareTrack Design System

The visual language for **SquareTrack** — a square-dance "track-everything" app for callers: import and edit calling sequences, manage the underlying choreography, and run live tips on the floor.

This design system was lifted from the *Caller Console* design exploration and grounded in the real product data model from the codebase. Its job is to give SquareTrack one consistent look and feel — **the current app is functional but undesigned** ("pushed together"), and this system is the agreed visual direction to build toward, starting with the sequence import/edit flow.

## Sources

- **Code repo:** `github.com/kevinmcdaniel/squaretrack` (Next.js 15 FE, Express + Prisma BE, TailwindCSS + Shadcn). The design system does **not** copy the repo's current (undesigned) Tailwind styling — it replaces it.
- **Data model & flow** were read from the repo and preserved verbatim in this system:
  - `docs/architecture/build-plan-sequence-import.md` — the canonical spec for the sequence & teach-order import/edit flow.
  - `docs/api/sequences.md` — the sequence API contract.
- **Caller Console** — the original design exploration (kept in the project root as `Caller Console.dc.html`) that established the visual vocabulary.

## Priority order (per Kevin)

1. **Sequence import / edit / save** + the underlying choreography — the hero. See `ui_kits/sequence-editor/`.
2. **Calling views** (Live, Sight, Teaching Order) — secondary. See `ui_kits/calling/`.

---

## Content fundamentals

How SquareTrack talks:

- **Voice:** plain, caller-to-caller, terse. The product assumes domain fluency — it says "FASR", "get-out", "tip", "activator" without explaining them.
- **Casing:** Call names are **Title Case proper nouns** ("Spin Chain Thru", "Allemande Left"). Section labels and metadata are **mono UPPERCASE eyebrows** ("CURRENT FORMATION", "PREREQUISITES"). Formation codes are sentence case ("Ocean Waves", "Two-Faced Lines").
- **Person:** Second person, imperative for actions ("tap a call to mark your place", "Save as draft or resolve before activating"). No marketing "we".
- **Numbers earn their place.** Counts (`×4`), beats (`8 beats`), difficulty (1–5 pips), curriculum positions ("48"), call tallies ("11 calls", "3 of 6 used"). Never decorative stats.
- **Status is spoken like a caller would think it:** "All choreo steps resolved — chain valid.", "3 steps need attention.", "Activated — sequence is now searchable."
- **No emoji** in product chrome. The one exception inherited from the codebase is the 🔒 used to mark caller-private helper text; otherwise status uses small geometric marks (▲ warning, ✓ done, ↳ used-in, → flow).

---

## Visual foundations

**Two skins of one system.** Every token resolves under both `:root` (light) and `[data-theme="dark"]` / `.theme-dark` (dark). Components are theme-agnostic — flip a skin by setting the attribute/class on any ancestor.

- **Light** is the **editing & reference** surface: `#eef1f4` app backdrop, white cards, cool slate text, a single **blue accent `#2f6fed`**, navy `#10233f` callouts. Calm, dense, legible at a desk.
- **Dark** is the **live-calling floor view**: near-black `#1e2127`, pastel **green accent `#9fd6b0`**, low-glare coral/gold status. High contrast, no glare in a dim hall.

**The difficulty ramp is the core signal** and is *shared, identical, never recolored* across both skins: a 5-stop green→red ramp (`--diff-1..5`) rendered as a **pip meter** (4×13px bars). In live calling, difficulty also drives **opacity** of the call text (harder = brighter).

- **Type:** three families, used strictly by role.
  - *Display* — **Space Grotesk** (call names, big numbers, titles), 600/700, set tight.
  - *Body* — **Hanken Grotesk** (prose, definitions, list text, buttons), 400–800.
  - *Mono* — **IBM Plex Mono** (eyebrow labels, counts, formation codes, metadata). Eyebrows are UPPERCASE with 1.5–2px tracking.
  - Calling surfaces run **large** — call lines are 30px so they read mid-floor.
- **Color discipline:** subtly-toned cool whites/blacks (no pure-white panels in dark; no pure-black text). Accents share chroma — one blue (light) / one green (dark) carries primary; status hues (success/warn/danger) are muted, more so in dark.
- **Layout:** screens are tablet-scale rounded frames (`--r-screen` 20px) with a single soft cool drop shadow (`--shadow-screen`). Inside: header bar → flex/grid body → optional sticky footer. Three-pane splits (list · detail · rail) are the norm.
- **Backgrounds:** flat tinted surfaces only. **No gradients, no textures, no patterns.** Depth comes from one lifted layer + hairline borders.
- **Borders & radius:** hairline 1px dividers (`--border`, `--row-divider`); radii step down by role — screen 20 → panel 16 → card 12 → cell 9 → chip 7 → tag 5 → pill.
- **Cards:** flat fill + 1px border, or a single soft shadow for lifted panels. No left-border-accent cards, no double borders.
- **Hover/press:** buttons darken to `--accent-press`; secondary/ghost fill with a soft tint; rows get an accent-soft background + accent left-border when selected. Subtle, fast (~120ms), no bounce.
- **Resolution states** (sequence import) are a first-class color language: **resolved** = calm (neutral border, green confirm dot), **ambiguous** = amber border+tint, **unresolved** = red border+tint. Carried by `--res-*` tokens.
- **Iconography:** see below — geometric marks and abstract diagrams, not an icon set.

---

## Iconography & imagery

SquareTrack is **nearly icon-free by design.** It communicates with:

- **Geometric status marks** as Unicode glyphs: `▲` warning, `✓` done, `↳` used-in / child, `→` formation flow, `●`/`↳` list bullets, `＋` add. These inherit text color from their semantic token. No icon font is loaded.
- **The pip meter** — the difficulty primitive, drawn with plain divs.
- **Abstract formation diagrams** — squares (boys) and circles (girls) with CSS-triangle facing arrows and amber hand-link bars. Built from divs, never SVG. See `FormationDiagram`.
- **The dancer set** — a square of boy(□)/girl(○) markers with a highlighted key couple.
- **Real imagery:** `assets/squareset.png` is the product's own square-set photo (from the repo). Photo slots (e.g. "photo of the set" in Sight calling) are user-filled drop zones, not decorative stock.

If a true icon need arises later, add a thin-stroke set (e.g. Lucide) via CDN and document it here — but prefer a Unicode mark or an abstract diagram first.

> **Fonts are Google Fonts** (`tokens/fonts.css` uses an `@import`). For a fully self-hosted/offline system, swap those for local `@font-face` + `.woff2` in `assets/fonts/`. **Flagged for Kevin — confirm if you want committed font binaries.**

---

## Index / manifest

**Root**
- `styles.css` — the single entry point consumers link. `@import`s the tokens only.
- `Caller Console.dc.html` — original design exploration (kept for reference).
- `readme.md` (this file), `SKILL.md` (portable Agent Skill).

**`tokens/`** — all CSS custom properties + fonts
- `fonts.css` · `colors.css` (light + dark) · `typography.css` · `layout.css`

**`guidelines/`** — foundation specimen cards (Design System tab)
- Colors (light/dark surfaces & accent), Difficulty Ramp, Resolution States, Type Badges, type specimens, spacing, radius & elevation.

**`components/`** — reusable React primitives (`.jsx` + `.d.ts` + `.prompt.md`)
- `badges/` — `DifficultyPips`, `TypeBadge`, `DesignatorPill`, `WarningChip`, `LevelBadge`
- `controls/` — `Button`, `SegmentedToggle`
- `choreo/` — `CallStepRow`, `FormationDiagram`, `GetOutCard`

**`ui_kits/`** — full interactive surfaces
- `sequence-editor/` — **the hero.** Paste calling text → parse → resolve each call to its choreo (resolved/ambiguous/unresolved) → set FASR formation → Save draft → Activate. Themeable light/dark.
- `calling/` — Live (dark floor), Sight, and Teaching Order views.

**`docs/`** — product reference carried from the repo
- `build-plan-sequence-import.md` · `api/sequences.md` + the other API contracts.

**`assets/`** — `squareset.png`.

> **Namespace note:** the component preview cards mount the auto-generated `_ds_bundle.js`. They resolve whatever global namespace the compiler emits (they scan `window` for the object holding the components), so they survive regardless of the exact namespace string.
