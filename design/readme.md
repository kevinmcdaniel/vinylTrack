# vinylTrack — Design

`wireframes/` holds the vinylTrack UX pass: `VinylTrackApp.dc.html` (every screen, mobile and desktop, three palettes) and `VinylTrack Wireframes.dc.html` (device frames, theme picker, data-model findings). They are the source of truth for how the app looks.

The rules they follow (tokens, type, shape, components, layout) are written up in [docs/design-system.md](../docs/design-system.md), and the tokens are wired into `fe/src/app/globals.css` and `fe/tailwind.config.ts`.

The squaretrack design system that used to sit in `system/` was dropped in #18: it was built for square-dance calling (sequences, choreography, difficulty ramp) and none of its components applied here.
