# Design brief

The product in one paragraph: a shared, mobile-friendly way to track a family's record/album/MP3 collections — whose things are whose, where they are, where they came from, what to look for while shopping — without buying the same thing twice because it's sitting at someone else's house.

## Multiple collections, not one big list

The app spans more than one named **collection** (Vinyl, Square Dance Calls, General MP3s, more later), each independently browsable. Square-dance calling music and general MP3s live here rather than in a separate app, because the underlying need — artists, releases, a want list — is the same regardless of format. Collections don't cross-reference each other (a Vinyl copy and a Square Dance Calls MP3 are never "the same item"). Details: [issue #14](https://github.com/kevinmcdaniel/vinylTrack/issues/14).

## Album vs. copy vs. location vs. owner

The most load-bearing modeling decision in the whole app: an **album** (a release/edition — title, artists, format, year) is not the same thing as a **copy** (one physical or digital instance someone actually owns). One album can have zero, one, or many copies — the same title can exist separately at Kevin's house and at a kid's place.

Every copy then answers two questions that must not be collapsed into one. A **location** says *where* it is: nested Room → Shelf for physical storage, or a storage path for digital. An **owner** says *whose* it is. Keeping them apart is what makes lending expressible — lend a record to a cousin and the location changes while the owner stays put. An earlier cut of the schema derived the owner from the location, which made every move look like a change of hands.

An owner is deliberately **not** an account. Not everyone whose records are in the collection signs in: a grandparent, a kid too young for a login, or a household "family" owner. So an owner is its own thing that may or may not link to a user, and gains an account later without its records being rewritten.

That split is what makes the duplicate-purchase check possible: before buying something, search whether *anyone in the family* already has a copy, whose it is, and where. Details: [issue #2](https://github.com/kevinmcdaniel/vinylTrack/issues/2), [issue #53](https://github.com/kevinmcdaniel/vinylTrack/issues/53), [issue #13](https://github.com/kevinmcdaniel/vinylTrack/issues/13).

## Auth & sharing

Real per-user accounts via plain Google sign-in (any Google account — an earlier plan to restrict by a custom Workspace domain was dropped as too fragile for a 20-year-old legacy domain). New sign-ins land in a pending state; an admin (the account owner) approves or denies. Collections are owned by a user and can be shared with specific other family members — note that this owner is an account, unlike the owner of a copy above, which need not be one. A lightweight bot check (Cloudflare Turnstile) sits on the sign-in page independent of whatever network setup (Cloudflare Tunnel today) fronts the app, since hosting is expected to change over time. Details: [issue #11](https://github.com/kevinmcdaniel/vinylTrack/issues/11).

## Album art & external metadata

Cover art, catalog numbers, producer/writer credits, and pressing details (matrix/runout numbers) get pulled from public sources — MusicBrainz (primary, free, no key) and Discogs (secondary, best for vinyl-specific pressing detail) — rather than typed in by hand. A phone camera can drive this: barcode scanning for anything from the barcode era, OCR-then-text-search as a fallback for older vinyl that predates barcodes. Either path surfaces candidate matches for a human to confirm — never auto-applies a guess. Details: [issue #15](https://github.com/kevinmcdaniel/vinylTrack/issues/15), [issue #16](https://github.com/kevinmcdaniel/vinylTrack/issues/16), [issue #17](https://github.com/kevinmcdaniel/vinylTrack/issues/17).

## Hosting

Decided in [#12](https://github.com/kevinmcdaniel/vinylTrack/issues/12): a dedicated **M1 Pro MacBook** at home, behind double NAT, with no inbound ports. The app is published through a **Cloudflare Tunnel** on the family domain; admin SSH and CI deploys go through **Cloudflare Access** on the same tunnel; **UniFi Teleport** is the independent break-glass path. Because auth is real and app-level (not "the network is the auth"), moving to other hardware or a cloud host later is a deploy-target change, not an app change. Details: [remote access](hosting-remote-access.md), [update schedule](hosting-maintenance.md), [#59](https://github.com/kevinmcdaniel/vinylTrack/issues/59), [#60](https://github.com/kevinmcdaniel/vinylTrack/issues/60).
