# vinylTrack — Design

`wireframes/` holds the vinylTrack UX pass: `VinylTrackApp.dc.html` (every screen, mobile and desktop, three palettes) and `VinylTrack Wireframes.dc.html` (device frames, theme picker, data-model findings). They are the source of truth for how the app looks.

The rules they follow (tokens, type, shape, components, layout) are written up in [docs/design-system.md](../docs/design-system.md), and the color tokens live in `fe/src/lib/themes.ts`.

`palette.html` shows the three themes (classic, warm, dark) with their final, contrast-adjusted values: a sample card, every token's swatch and hex, and the key contrast ratios. Open it straight from disk. Its colors sit in one JSON block that `fe/src/lib/palettePage.test.ts` holds identical to `themes.ts`, so a color change has to update both.

The squaretrack design system that used to sit in `system/` was dropped in #18: it was built for square-dance calling (sequences, choreography, difficulty ramp) and none of its components applied here.
