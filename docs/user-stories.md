# User stories

A framework to design the UX against — not the UX itself. Each story is something a person should be able to do; the issue references show which part of the model/API is supposed to support it. If a story doesn't map cleanly onto the current model, that's a sign the model needs to change before the screen gets designed, not after.

## Auth & session

- I log in with my Google account. ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11))
- My login stays active over time — I'm not re-entering credentials every visit. ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11))
- If I'm new, I request access and see a "waiting for approval" state until an admin approves me. ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11))
- As an admin, I see who's requested access and can approve or deny them. ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11))

## Search & browse

- I have a search box to find things by album title, artist name, etc. ([#4](https://github.com/kevinmcdaniel/vinylTrack/issues/4), [#7](https://github.com/kevinmcdaniel/vinylTrack/issues/7))
- I can switch between collections (Vinyl, Square Dance Calls, …) and browse one at a time. ([#14](https://github.com/kevinmcdaniel/vinylTrack/issues/14))
- I can filter a collection by artist, format, or genre. ([#4](https://github.com/kevinmcdaniel/vinylTrack/issues/4), [#7](https://github.com/kevinmcdaniel/vinylTrack/issues/7))
- I can open an artist's page and see everything they've contributed to. ([#3](https://github.com/kevinmcdaniel/vinylTrack/issues/3), [#7](https://github.com/kevinmcdaniel/vinylTrack/issues/7))
- I can open an album's page and see its details (artists, format, year, genre, cover art, credits) and every copy I own of it — including where each one lives. ([#7](https://github.com/kevinmcdaniel/vinylTrack/issues/7), [#15](https://github.com/kevinmcdaniel/vinylTrack/issues/15), [#16](https://github.com/kevinmcdaniel/vinylTrack/issues/16))

## Adding to a collection

- I can add a new album to a collection by hand. ([#4](https://github.com/kevinmcdaniel/vinylTrack/issues/4))
- I can scan a barcode or photograph a cover and have the details filled in for me, from a short list of candidate matches I confirm. ([#16](https://github.com/kevinmcdaniel/vinylTrack/issues/16), [#17](https://github.com/kevinmcdaniel/vinylTrack/issues/17))
- I can add a copy of an album, specifying where it lives (down to a shelf within a room) and where/when/how much I paid for it. ([#5](https://github.com/kevinmcdaniel/vinylTrack/issues/5))
- I can attach a photo to a copy (condition, wear, whatever's useful). ([#15](https://github.com/kevinmcdaniel/vinylTrack/issues/15))
- Before I add a copy, I can see whether anyone in the family already has one, and where. ([#13](https://github.com/kevinmcdaniel/vinylTrack/issues/13))

## Want list & shopping

- I can add something to my want list — a specific album, or "anything by this artist" — and mark it must-have vs. nice-to-have. ([#6](https://github.com/kevinmcdaniel/vinylTrack/issues/6))
- While shopping, I can check my want list against the whole family's collection, not just mine. ([#8](https://github.com/kevinmcdaniel/vinylTrack/issues/8), [#13](https://github.com/kevinmcdaniel/vinylTrack/issues/13))
- When I find something on my list, marking it "found" turns it straight into a real copy — I don't re-enter everything. ([#6](https://github.com/kevinmcdaniel/vinylTrack/issues/6), [#8](https://github.com/kevinmcdaniel/vinylTrack/issues/8))

## Sharing

- I can share a collection with a specific family member. ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11))
- I only ever see collections I own or that have been shared with me. ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11), [#14](https://github.com/kevinmcdaniel/vinylTrack/issues/14))

## Offline

- I can open the app with no signal and still see my collection. ([#9](https://github.com/kevinmcdaniel/vinylTrack/issues/9))
- If I add or edit something offline, it syncs once I'm back online. ([#10](https://github.com/kevinmcdaniel/vinylTrack/issues/10))
