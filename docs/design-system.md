# Design system

How vinylTrack looks, and why. The source of truth is the UX wireframe in [`design/wireframes/VinylTrackApp.dc.html`](../design/wireframes/VinylTrackApp.dc.html) (screens) and [`VinylTrack Wireframes.dc.html`](../design/wireframes/VinylTrack%20Wireframes.dc.html) (device frames, theme picker, data-model findings). This page writes down the rules those wireframes follow, so components can be built against them without opening the wireframe. Tracked in [issue #18](https://github.com/kevinmcdaniel/vinylTrack/issues/18).

It replaces the squaretrack design system that was copied into `design/system/` at scaffold time. That system was built for a caller's console: sequence editing, choreography resolution states, a difficulty ramp, formation diagrams. None of that applies here. What vinylTrack keeps from it is the type pairing and the flat look. Its palette, components and UI kits were not carried over.

## Principles

- **Three fonts, each with one job.** Space Grotesk for display (titles, the wordmark), Hanken Grotesk for body and controls, IBM Plex Mono for metadata, counts and labels.
- **Flat, tinted surfaces.** Cards are a surface on a slightly darker page background, with a 1px border and at most a faint shadow. There are no gradients or textures. The one exception is the striped placeholder used where cover art is missing.
- **State is a tint pair.** Every status (condition, priority, duplicate check, active filter) is drawn as a `*-bg` background with its matching foreground color. A status never gets a solid fill with white text.
- **No icon set.** The few marks are Unicode glyphs: `＋` add, `▲` warning, `→` in location paths (`Living Room → Shelf 2`), `×` close. Avatars are the owner's initial on a colored circle.
- **Mono uppercase eyebrows** label sections (`YOUR COLLECTIONS`, `WANT LIST`, `SHARED WITH`, form field labels).
- **Mobile first.** The phone layout is the primary one. The desktop layout rearranges the same pieces and adds nothing new.

## Color tokens

Defined as CSS custom properties in [`fe/src/app/globals.css`](../fe/src/app/globals.css) and mapped to Tailwind color names in [`fe/tailwind.config.ts`](../fe/tailwind.config.ts) (`bg-surface`, `text-text-muted`, `border-border-strong`, …). Light ("classic") is the default. Dark follows `prefers-color-scheme`.

| token | light | dark | used for |
| --- | --- | --- | --- |
| `bg` | `#eef1f4` | `#14161b` | page background |
| `surface` | `#ffffff` | `#1d2027` | cards, sheets, inactive chips |
| `surface-alt` | `#f4f7fb` | `#23262d` | search fields, inset rows, neutral results |
| `border` | `#dbe2e9` | `#2b2f38` | card and input borders, list dividers |
| `border-light` | `#e1e7ee` | `#262a32` | placeholder stripes |
| `border-strong` | `#cdd6e0` | `#383d47` | chips, secondary buttons, segmented controls |
| `text` | `#142031` | `#eef1f4` | primary text |
| `text-secondary` | `#3a4856` | `#c3c9d4` | secondary-button labels, inactive chips and tabs |
| `text-tertiary` | `#5b6878` | `#9aa2b0` | credit keys, low-priority tags |
| `text-muted` | `#8a98a8` | `#737b8a` | mono metadata, eyebrows |
| `chevron` | `#aebccb` | `#565e6b` | disabled controls, placeholder hints |
| `primary` | `#2f6fed` | `#5b8cff` | primary action, active tab/chip text, links |
| `primary-text` | `#ffffff` | `#ffffff` | text on `primary` |
| `primary-bg` | `#e7eefc` | `#223256` | active tab/chip/room fill, info notes |
| `primary-border` | `#c7d9fb` | `#33487a` | border of the selected album row (desktop) |
| `accent-purple` | `#7a52c4` | `#a480e0` | owner avatar |
| `accent-green` | `#2f9e63` | `#4fbf82` | owner avatar, success text, "Save copy" |
| `success-bg` | `#e3f3ea` | `#1d3327` | success tint |
| `warn-bg` / `warn-border` / `warn-text` | `#fbf1df` / `#e0a64e` / `#a9701a` | `#3a2f18` / `#a9761f` / `#e3b767` | warning banners, "already owned" |
| `danger-bg` / `danger-text` | `#fdeceb` / `#c2483f` | `#3a2020` / `#e2685a` | must-have priority, errors |

The wireframe also has a third, **warm "record store"** palette (`THEMES.warm`, terracotta primary on cream). It is not wired in. Whether it ships as a user-selectable theme is an open question (see [Remaining work](#remaining-work)).

### State mappings

These live in wireframe code rather than in markup, so they are listed here:

| state | bg | fg |
| --- | --- | --- |
| condition `NM` | `success-bg` | `accent-green` |
| condition `VG+` | `primary-bg` | `primary` |
| condition `VG` | `warn-bg` | `warn-text` |
| condition none (`—`) | `bg` | `text-muted` |
| want priority *must* | `danger-bg` | `danger-text` |
| want priority *nice* | `bg` | `text-tertiary` |
| want check: found | `success-bg` | `accent-green` |
| want check: not found | `surface-alt` | `text-tertiary` |
| duplicate check: nobody owns it | `success-bg` | `accent-green` |
| duplicate check: someone in the family owns it | `warn-bg` | `warn-text` |
| duplicate check: it's on the want list | `primary-bg` | `primary` |
| chip / tab / room picker, active | `primary-bg` | `primary` |
| chip / tab / room picker, inactive | `surface` (tab: transparent) | `text-secondary` |

The wireframe only shows `NM`, `VG+` and `VG`. The rest of the Goldmine scale (`M`, `VG-`, `G+`, `G`, `F`, `P`) still needs a color.

Owner avatars use a fixed color per owner (`primary`, `accent-purple`, `accent-green`, falling back to `text-tertiary`) with white text. With real data the color should be derived from the owner id, so it is stable and doesn't depend on a hand-written table.

## Typography

Font families are Tailwind `font-display`, `font-sans` (the default on `body`) and `font-mono`.

| role | font | size / weight |
| --- | --- | --- |
| album title (detail) | display | 22px mobile, 24px desktop, 700 |
| screen header | display | 20px, 700 |
| sheet title, wordmark | display | 17px, 700 |
| collection card name | display | 17px, 600 |
| body / list title | sans | 14–15px, 600 for titles |
| button | sans | 13–14px, 600 |
| metadata line, location, counts | mono | 11–12px, `text-muted` |
| eyebrow | mono | 11px, uppercase, letter-spacing 1.5px, `text-muted` |
| tag (condition, priority) | mono | 10px, 600 |

## Shape and elevation

| element | radius |
| --- | --- |
| chips, search fields, avatars, round add button | full (`999px`) |
| cards, list containers | 12px |
| copy rows, want cards, sheets' inner blocks | 10px |
| buttons, inputs, segmented controls | 7px |
| cover thumbnail | 6px (list), 10px (detail) |
| condition tag | 5px |

Cards use `box-shadow: 0 1px 3px rgba(20,40,70,0.08)`. Sheets and modals use `0 12px 36px rgba(20,40,70,0.24)`. Nothing else has a shadow.

## Components

These are the building blocks the wireframe repeats. Each should become one component in `fe/src/ui/`.

- **Button.** *Primary*: `primary` fill, `primary-text` label. *Secondary*: `border-strong` outline, `text-secondary` label. *Outline-primary*: `primary` outline and label ("Add another copy"). *Confirm*: `accent-green` fill ("Save copy"). *Disabled*: `chevron` label, `cursor: not-allowed`.
- **Search field.** Pill shape on `surface-alt` with a `border` outline.
- **Filter chip.** Mono text in a pill with a `border-strong` outline, colored by the active/inactive mapping. On mobile chips scroll horizontally.
- **Segmented control.** Inline mono options in a `border-strong` box (want type *album/artist*, priority *must/nice*).
- **Card.** `surface`, `border`, 12px radius, card shadow. List containers are cards with `border`-divided rows.
- **Album row.** Cover thumbnail (44px mobile, 36px desktop), then the title (600) and a mono meta line (artist · year · format).
- **Cover placeholder.** Diagonal stripes of `border-light` and `surface-alt`, with the format (`LP`, `MP3`) or `COVER ART` in mono. Replaced by real art in #15.
- **Copy row.** Owner avatar, the owner's name, the location path in mono, and a condition tag. Tapping it opens Move.
- **Tag.** Mono 10px/600 tint pair: square-ish (5px) for condition, pill for priority.
- **Avatar.** A circle with the initial in white bold.
- **Banner / result box.** Padded, 8px-radius tint pair (`warn` banner, duplicate-check result, want-check result, `primary-bg` info note).
- **Sheet.** A bottom sheet on mobile and a centered modal on desktop. `surface`, sheet shadow, display-font title with `×`. Used for Add a copy (two steps: choose album, then place it) and Move copy.
- **Eyebrow.** Mono uppercase section label.

## Layout

- **Mobile.** Sticky header with the screen title (display font) and a round `＋` add button. Content scrolls. A bottom tab bar holds mono labels, and the active tab gets a 2px `primary` top border. Tabs: Collections, Want list, Account.
- **Desktop.** Top bar with the wordmark, pill tabs and the account avatar. Below it, a collection rail on the left, then the album list with search and chips, then album detail in a third pane.
- The current app shell (`fe/src/app/(app)/layout.tsx`) is a single `max-w-2xl` column with a header and no tab bar. Moving to this layout is part of the remaining work.

## Remaining work

The tokens and fonts are wired in. No component has been rebuilt against them yet: existing pages still use ad-hoc `black/10`, `white/15`, `red-500` and `blue-600` utilities. See [issue #18](https://github.com/kevinmcdaniel/vinylTrack/issues/18) for the task breakdown.
