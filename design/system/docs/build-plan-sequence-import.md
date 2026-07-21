# Build Plan: Sequence & Teach Order Import UI

## Scope

Two import flows, similar shape, different data:

- **A. Sequence import** — paste calling text → parse → edit per-step → save as `sequence` + `sequence_calls[]`
- **B. Teach order import** — paste a program curriculum → parse → save as `teach_order` + `teach_order_entry[]`

Both share parser primitives: call name resolution (with synonyms), designator extraction, formation lookup.

---

## Development Policy: Tests First

**All schema changes and new API endpoints require failing tests written before implementation.**

Build order for every feature block:
1. Write integration tests against the new endpoints — they must fail (schema/routes don't exist yet)
2. Write the Prisma migration
3. Run `prisma migrate dev` inside Docker (see `prisma-migrate` skill)
4. Implement services + controllers
5. Run tests — all must pass
6. Clean up any `_TEST_` prefixed data created during development

This applies to both the teach order schema migration (Phase 2) and all subsequent endpoint work.

---

## Schema — Already Implemented (Phase 1)

```prisma
model sequence {
  startFormationId Int       // required; default = Squared Set formation id
  variantGroupId   String?   // shared uuid across sequences with identical Taminations output
  isValid          Boolean   @default(false)
  @@index([variantGroupId])
}
```

- `startFormationId`, `variantGroupId`, `isValid` are live on main.
- Migrations `expand_calls_domain` and `add_sequence_start_formation` are applied.

---

## Schema — Phase 2 Migration (teach order + program)

### New model: `program_call_formation`

Links a program to the specific call_formations that are valid within it, and records how difficult each is at that program level.

```prisma
// Defines which call_formations belong to a program and their difficulty at that level.
// Difficulty is program-relative: a FASR that is 'challenging' in Mainstream
// is 'easy' in Plus because Plus dancers have already mastered it.
model program_call_formation {
  programId     Int
  program       program        @relation(fields: [programId], references: [programId])
  callId        Int
  startId       Int
  callFormation call_formation @relation(fields: [callId, startId], references: [callId, startId])
  difficulty    String         // easy | hard | challenging

  @@id([programId, callId, startId])
  @@index([programId, difficulty])
}
```

Back-relations to add:
- `program.programCallFormations  program_call_formation[]`
- `call_formation.programEntries  program_call_formation[]`

### Revised model: `teach_order_entry`

The atomic unit is `(call, FASR)` — a specific call from a specific starting formation. The same call appears multiple times when it is valid from multiple FASRs, each introduced at a potentially different sortOrder and week.

```prisma
// One row per (call, FASR) pair introduced in this teach order.
// The same call appears multiple times if it is valid from multiple starting formations
// and those FASRs are introduced at different points in the curriculum.
// Family header rows have entryType='family', null callId and startId.
model teach_order_entry {
  id            Int             @id @default(autoincrement())
  teachOrderId  Int
  teachOrder    teach_order     @relation(fields: [teachOrderId], references: [id])

  sortOrder     Int             // teaching sequence within this teach order; drives safeAfterPosition
  position      Int             // Callerlab curriculum number (e.g. 10 for "Right and Left Thru")
  subPosition   String?         // Callerlab sub-letter ('a'–'e'); null when call has no sub-entries
  entryType     String          // 'family' | 'call'
  label         String?         // family header text; or caller display override on call rows

  callId        Int?            // null when entryType = 'family'
  startId       Int?            // null when entryType = 'family'; the FASR being introduced
  callFormation call_formation? @relation(fields: [callId, startId], references: [callId, startId])

  week          Int?            // class night this (call, FASR) pair is introduced; nullable until scheduled

  @@unique([teachOrderId, sortOrder])
  @@unique([teachOrderId, callId, startId])   // each (call, FASR) appears once per teach order
  @@index([teachOrderId, position, subPosition])
  @@index([teachOrderId, week])
}
```

**Why `sortOrder` ≠ `position`:**
- `position` is the Callerlab curriculum reference number — it never changes and matches the official list.
- `sortOrder` is the actual teaching sequence. Some sub-entries at the same position are taught weeks apart (e.g. Ocean Wave Family: Alamo Style at week 8, Step to a Wave at week 14 — both position 31, different sortOrder and week).
- `safeAfterPosition` on `sequence` uses `MAX(sortOrder)`, not `MAX(position)`.

**Example — Right and Left Thru (position 10, two FASRs):**

| sortOrder | position | subPosition | entryType | callId | startId | week |
|---|---|---|---|---|---|---|
| 35 | 10 | null | call | Right and Left Thru | Facing Couples | 9 |
| 61 | 10 | null | call | Right and Left Thru | Ocean Wave | 15 |

Same Callerlab position, two rows, different sortOrder and week.

**Example — Trade Family (position 32, Callerlab sub-letters, some FASRs spread across weeks):**

| sortOrder | position | subPosition | entryType | callId | startId | week |
|---|---|---|---|---|---|---|
| 72 | 32 | null | family | null | null | null |
| 73 | 32 | a | call | Couples Trade | Two-Faced Line | 10 |
| 74 | 32 | b | call | (Named Dancers) Trade | Ocean Wave | 10 |
| 75 | 32 | b | call | (Named Dancers) Trade | Two-Faced Line | 10 |
| 76 | 32 | c | call | Right Hand Trade | Ocean Wave | 10 |
| 77 | 32 | c | call | Left Hand Trade | Ocean Wave | 14 |
| 78 | 32 | d | call | Partner Trade | Two-Faced Line | 10 |

---

## Backend (`be/`)

### Parser service — `be/src/service/parser.ts`

Already implemented for sequence parsing. The teach order parser is a separate function in the same file.

**Sequence parser** (existing):

```ts
type Resolution = 'resolved' | 'unresolved' | 'ambiguous'

type ParsedStep = {
  rawLine: string
  type: 'call' | 'activator' | 'filler' | 'warning' | 'tip' | 'recovery'
  designator?: string
  count?: number
  callMatches: { callId: number; name: string; confidence: number }[]
  formationMatches: { startId: number; name: string }[]
  resolution: Resolution
  text?: string
}
```

**Teach order parser** (new):

```ts
type ParsedEntry = {
  rawLine: string
  position: number
  subPosition: string | null
  entryType: 'family' | 'call'
  label: string
  callMatches: { callId: number; name: string }[]
  formationMatches: { startId: number; name: string; difficulty: string | null }[]
  resolution: 'resolved' | 'unresolved' | 'ambiguous'
}
```

Parse rules per line:
1. Strip leading number + period (e.g. `10. `) → `position`
2. Strip leading letter + period (e.g. `a. `) → `subPosition`
3. Strip parenthetical variants (e.g. `(1/4, 1/2, 3/4, Full)`) — these are call parameters, not separate entries
4. If line ends with "Family" or has no sub-letter → `entryType = 'family'`
5. Handle `Left/Right` pattern → two separate `callMatches` entries
6. Match call name against `call.name` and `call_synonym.alias`
7. For resolved calls, look up `program_call_formation` entries for the target program → `formationMatches` with difficulty

### Routes

**Sequence (existing):**
- `POST /api/sequence/parse` — body `{ text, startFormationId? }` → `ParsedStep[]`. Stateless.
- `POST /api/sequence` — save full draft. Computes `safeAfterPosition`, `variantGroupId`, `isValid` in txn.
- `PUT /api/sequence/:id` — replace steps in txn; recompute derived fields.
- `GET /api/sequence/:id` — load for re-edit.

**Teach order (new):**
- `POST /api/teach-order/parse` — body `{ text, programId }` → `ParsedEntry[]`. Stateless.
- `POST /api/teach-order` — body `{ name, programId, entries[] }` → saved teach order with all entries.
- `PUT /api/teach-order/:id` — replace entries in txn.
- `GET /api/teach-order/:id` — load with all entries ordered by `sortOrder`.
- `GET /api/teach-order/list` — all teach orders (summary, no entries).

**Program (new):**
- `GET /api/program/list` — all programs.
- `GET /api/program/:programId/call-formations` — all `program_call_formation` rows for a program (with difficulty).
- `POST /api/program/:programId/call-formation` — body `{ callId, startId, difficulty }` → add a FASR to a program.

**Quick-add (existing):**
- `POST /api/call` — new call
- `POST /api/formation` — new formation
- `POST /api/call-formation` — new `(call, startFormation) → endFormation` tuple with optional flow fields
- `POST /api/call/:id/synonym` — add alias

**Lookup (existing):**
- `GET /api/call?search=…` — autocomplete
- `GET /api/formation?callId=X` — formations valid for a given call
- `GET /api/formation?search=…` — general formation search

### Controllers + validation

- Zod schemas for every body
- Shared `DraftTeachOrderSchema` reused by POST and PUT
- Thin controllers, logic in services

### Save-time variant detection (sequence)

On `POST/PUT /api/sequence`:

1. Generate `taminationsText` from `type='call'` steps (`designator + call.tamSeq + count`, skipping non-call entries)
2. Query for existing sequences whose computed Taminations text matches
3. If matches: adopt their `variantGroupId` (create one if the group is unassigned and update all members)
4. If no matches: `variantGroupId = null`

Generated Taminations text is not stored — derived on the fly for comparison and export.

---

## Frontend (`fe/`)

### Routes

- `/calling/sequences/new`
- `/calling/sequences/[id]/edit`
- `/calling/teach-orders/new`
- `/calling/teach-orders/[id]/edit`

### Client state — sequence (existing shape)

```ts
type DraftStep = {
  localId: string
  order: number
  type: 'call' | 'activator' | 'filler' | 'warning' | 'tip' | 'recovery'
  callId: number | null
  startId: number | null
  designator: string | null
  count: number | null
  text: string | null
  helperText: string | null
  resolution: 'resolved' | 'unresolved' | 'ambiguous'
  rawLine: string
  candidates?: { callId: number; name: string }[]
}

type DraftSequence = {
  name: string
  teachOrderId: number | null
  startFormationId: number
  activator: 'heads' | 'sides' | null
  rating: string | null
  notes: string | null
  sourceText: string
  steps: DraftStep[]
}
```

### Client state — teach order (new)

```ts
type DraftEntry = {
  localId: string                 // uuid for React keys; not persisted
  sortOrder: number
  position: number
  subPosition: string | null
  entryType: 'family' | 'call'
  label: string | null
  callId: number | null
  startId: number | null
  week: number | null
  resolution: 'resolved' | 'unresolved' | 'ambiguous'
  rawLine: string
  callMatches: { callId: number; name: string }[]
  formationMatches: { startId: number; name: string; difficulty: string | null }[]
}

type DraftTeachOrder = {
  name: string
  programId: number
  entries: DraftEntry[]
}
```

Single `useReducer`. Actions: `SET_ENTRIES`, `UPDATE_ENTRY`, `SET_META`.

### Component tree — sequence editor (existing)

```
SequenceEditor (page)
 ├── SequenceMetaForm         — name, teach order, start formation, activator, rating, notes
 ├── PasteDropzone            — textarea + Parse button; only shown when steps empty
 ├── StepList
 │    └── StepRow (per step)
 │         ├── TypeBadge       — call | activator | filler | warning | tip | recovery
 │         ├── DesignatorPill
 │         ├── CallPicker      — autocomplete; red border if unresolved; inline "add new call"
 │         ├── FormationPicker — appears when call has >1 valid FASR; inline "add new call_formation"
 │         ├── CountInput
 │         ├── TextInput       — display override
 │         ├── HelperTextInput
 │         └── RowActions      — delete, drag-handle reorder, insert-before
 ├── UnresolvedBanner          — "3 steps need attention" → scrolls to next
 └── FooterBar                 — Save (always enabled; shows WIP vs Valid), Cancel
```

### Component tree — teach order editor (new)

```
TeachOrderEditor (page)
 ├── TeachOrderMetaForm        — name, program picker
 ├── PasteDropzone             — textarea + Parse button
 ├── EntryList
 │    └── EntryRow (per entry)
 │         ├── PositionBadge   — "10" or "10a"; family rows show label only
 │         ├── EntryTypeBadge  — family | call
 │         ├── CallPicker      — same component as sequence editor; hidden for family rows
 │         ├── FormationPicker — shows difficulty badge per FASR option; hidden for family rows
 │         ├── WeekInput       — nullable; family rows inherit min week of children
 │         └── RowActions      — delete only (no reorder; sortOrder is positional)
 ├── UnresolvedBanner
 └── FooterBar                 — Save, Cancel
```

### Key interactions — teach order

- **Paste + Parse**: `POST /api/teach-order/parse` with `{ text, programId }`; hydrate `DraftTeachOrder.entries`.
- **Family rows**: rendered as section headers; no call/formation pickers.
- **FASR picker**: shows difficulty badge (easy / hard / challenging) next to each formation option. Difficulty sourced from `program_call_formation` for the selected program.
- **Unresolved call**: same `CallPicker` flow as sequence editor. On resolve, offer synonym save.
- **Multiple FASRs for one call**: each FASR is a separate row in the entry list at the same position/subPosition.
- **Week assignment**: optional. Entered per-row. Family row displays the minimum week of its children.

---

## Build order

### Phase 1 — Complete ✓
1. ✓ Migration: `startFormationId`, `variantGroupId`, `isValid` on sequence
2. ✓ Parser service + sequence parse endpoint
3. ✓ Sequence CRUD endpoints
4. ✓ Quick-add endpoints (call, formation, call-formation, synonym)
5. ✓ 52 integration tests passing

### Phase 2 — Teach order schema + program endpoints

> **Tests first.** Write all tests in this phase before running any migration or writing any implementation code. Confirm they fail. Then implement.

6. Write failing tests for `program_call_formation` CRUD (`be/src/tests/program.test.ts`)
7. Write failing tests for revised `teach_order_entry` shape (`be/src/tests/teach-order.test.ts`)
8. Run tests — confirm all new tests fail
9. Write migration: add `program_call_formation`; revise `teach_order_entry` (sortOrder, subPosition, entryType, label, nullable callId/startId, autoincrement PK)
10. Run `prisma migrate dev` inside Docker
11. Implement `program_call_formation` service + controller + routes
12. Implement teach order service + controller + routes (CRUD + parse)
13. Run all tests — 52 existing + all new must pass
14. Seed MS26: program record, call families, calls, formations, call_formations, program_call_formations, teach_order + entries

### Phase 3 — Sequence editor UI
15. `SequenceEditor` skeleton + paste flow
16. Per-step editing with CallPicker + FormationPicker + quick-add modals
17. Save flow (WIP + valid)
18. Reorder + add/delete steps
19. Load for re-edit (`PUT /api/sequence/:id`)

### Phase 4 — Teach order editor UI
20. `TeachOrderEditor` skeleton + paste flow
21. Per-entry resolution with CallPicker + FormationPicker (with difficulty badges)
22. Save flow
23. Load for re-edit

### Phase 5 — Variant detection
24. `variantGroupId` computation on sequence save

---

## Policy decisions (resolved)

| Question | Decision |
|---|---|
| Parser location | Backend only |
| Formation defaulting | Chain off prior step's `endId`; fall back to `sequence.startFormationId` at step 1 |
| Unresolved policy on save | Allow save; `isValid=false` marks it as draft |
| Sequence uniqueness | `name` is unique; `variantGroupId` handles choreography-level dedup |
| On-the-fly dataset growth | Every picker must support inline quick-add; dataset grows with use |
| Teach order atomic unit | `(call, FASR)` — one row per call_formation, not one row per call |
| sortOrder vs position | `position` = Callerlab reference (immutable); `sortOrder` = actual teaching sequence (drives safeAfterPosition) |
| Difficulty scope | Program-relative, stored on `program_call_formation`; not on call_formation or teach_order_entry |
| Same call, multiple FASRs | Each FASR is a separate teach_order_entry row; introduced at different sortOrder/week as needed |
| Synonym uniqueness | Globally unique; a collision means call names need more specificity, not a duplicate alias |
| Test strategy | Failing tests written before every schema change and API implementation |

## Open items

- Sample sequences from Kevin (parser fixtures for sequence editor)
- Taminations text format spec — exact output format for `call.tamSeq` concatenation
- FASR per-dancer flow model — deferred until FASR reference document arrives
- MS26 week schedule — which calls are introduced on which class night (needed to populate `week` on teach_order_entry)
