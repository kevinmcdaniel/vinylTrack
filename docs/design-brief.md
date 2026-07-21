# Design brief

The product in one paragraph: a shared, mobile-friendly way to track a family's record/album/MP3 collections — where things are, where they came from, what to look for while shopping — without buying the same thing twice because it's sitting at someone else's house.

## Multiple collections, not one big list

The app spans more than one named **collection** (Vinyl, Square Dance Calls, General MP3s, more later), each independently browsable. Square-dance calling music and general MP3s live here rather than in a separate app, because the underlying need — artists, releases, a want list — is the same regardless of format. Collections don't cross-reference each other (a Vinyl copy and a Square Dance Calls MP3 are never "the same item"). Details: [issue #14](https://github.com/kevinmcdaniel/vinylTrack/issues/14).

## Album vs. copy vs. location

The most load-bearing modeling decision in the whole app: an **album** (a release/edition — title, artists, format, year) is not the same thing as a **copy** (one physical or digital instance someone actually owns). One album can have zero, one, or many copies, each at its own **location** — because the same title can exist separately at Kevin's house and at a kid's place. Locations nest (Room → Shelf) for physical storage, or point at a storage path for digital collections. This split is what makes the duplicate-purchase check possible: before buying something, search whether *anyone in the family* already has a copy, and where. Details: [issue #2](https://github.com/kevinmcdaniel/vinylTrack/issues/2), [issue #13](https://github.com/kevinmcdaniel/vinylTrack/issues/13).

## Auth & sharing

Real per-user accounts via plain Google sign-in (any Google account — an earlier plan to restrict by a custom Workspace domain was dropped as too fragile for a 20-year-old legacy domain). New sign-ins land in a pending state; an admin (the account owner) approves or denies. Collections have an owner and can be shared with specific other family members. A lightweight bot check (Cloudflare Turnstile) sits on the sign-in page independent of whatever network setup (Tailscale, etc.) ends up fronting the app, since hosting is expected to change over time. Details: [issue #11](https://github.com/kevinmcdaniel/vinylTrack/issues/11).

## Album art & external metadata

Cover art, catalog numbers, producer/writer credits, and pressing details (matrix/runout numbers) get pulled from public sources — MusicBrainz (primary, free, no key) and Discogs (secondary, best for vinyl-specific pressing detail) — rather than typed in by hand. A phone camera can drive this: barcode scanning for anything from the barcode era, OCR-then-text-search as a fallback for older vinyl that predates barcodes. Either path surfaces candidate matches for a human to confirm — never auto-applies a guess. Details: [issue #15](https://github.com/kevinmcdaniel/vinylTrack/issues/15), [issue #16](https://github.com/kevinmcdaniel/vinylTrack/issues/16), [issue #17](https://github.com/kevinmcdaniel/vinylTrack/issues/17).

## Hosting

Undecided as of this writing — likely a home Raspberry Pi (reachable via Tailscale) or cheap cloud hosting, and expected to possibly change over time. Because auth is real and app-level (not "the network is the auth"), the hosting choice shouldn't require touching the app itself. Details: [issue #12](https://github.com/kevinmcdaniel/vinylTrack/issues/12).
