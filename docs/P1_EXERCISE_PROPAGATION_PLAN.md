# P1 Implementation Plan — Exercise Identity and Propagation

## Purpose
This plan turns the P1 exercise identity / propagation work into an execution-ready implementation path.

The main goal is to make exercise library edits propagate safely and consistently across:
- active workouts
- workout history
- exercise history views
- reporting and category breakdowns
- imported legacy data where possible

## Problem summary
The current app uses a fragile hybrid model:
- workout and history records store exercise snapshots
- some reporting derives category from the current exercise library by matching exercise names
- renames or category changes can split one logical exercise into multiple identities
- old backups may not contain stable identity links

This creates trust issues and inconsistent behavior.

## Decision summary
- Exercise library edits should propagate everywhere.
- A manual `propagate / update all history` style flow should exist.
- The app should move away from fragile name-only matching toward a stable canonical exercise identity model.

## Recommended model
### Canonical identity
Use the exercise library item ID as the canonical exercise identity.

Each exercise stored in:
- `currentWorkout`
- `workoutHistory`
should include:
- `exerciseLibraryId`

### Useful snapshots
To keep the UI simple and preserve helpful context, also store snapshots:
- `name`
- `category`

Recommended practical approach for this app stage:
- keep `name` and `category` directly on workout/history exercise records for display simplicity
- treat `exerciseLibraryId` as canonical when available
- update snapshots during propagation so stored records stay aligned with the library definition

This keeps implementation practical without requiring a full UI rewrite.

## Scope for P1
### In scope
1. Add `exerciseLibraryId` support to active workout exercises
2. Add `exerciseLibraryId` support to workout history exercises
3. Ensure newly added exercises from the library store the canonical ID
4. Update exercise library edit flow to propagate name/category changes to:
   - active workout
   - workout history
5. Update derived/reporting logic to prefer canonical matching where available
6. Add a manual `propagate / update all history` action for legacy cleanup
7. Add legacy reconciliation logic for imported history without IDs

### Out of scope
- cloud sync
- multi-user merge resolution
- full analytics redesign
- cardio model redesign unless directly needed
- a large framework migration

## Design rules
1. **Canonical source:** exercise library record
2. **Canonical key:** `exerciseLibraryId`
3. **Backward compatibility:** continue to support older records without IDs
4. **Progressive migration:** attach IDs and normalized category/name over time
5. **Manual repair exists:** do not rely only on silent auto-migration for old imported data
6. **Safe updates:** use storage helper paths, not raw ad hoc mutation

## Recommended implementation phases

### Phase 1 — Data model foundation
Goal: introduce canonical identity without breaking current behavior.

Tasks:
- define helper utilities for exercise identity resolution
- add helpers such as:
  - `findLibraryExerciseById(id)`
  - `findLibraryExerciseByName(name)`
  - `resolveExerciseReference(exerciseRecord, library)`
- update new workout exercise creation so exercises can carry:
  - `exerciseLibraryId`
  - `name`
  - `category`
- ensure template use / coach-generated workouts can also attach IDs where possible

Acceptance criteria:
- new exercises added from the library store `exerciseLibraryId`
- active workout exercise records can carry canonical reference data
- existing flows still work for records without IDs

### Phase 2 — Propagation engine
Goal: make library edits update live and stored records.

Tasks:
- add a centralized propagation function, e.g.:
  - `propagateExerciseLibraryChange({ libraryExerciseId, oldName, newName, newCategory })`
- when a library item is edited:
  - update active workout exercises matching by ID first, then safe legacy name match
  - update workout history exercises matching by ID first, then safe legacy name match
  - refresh snapshots (`name`, `category`) in matched records
- ensure propagation uses storage helper methods

Acceptance criteria:
- editing a library exercise name updates active workout and history records
- editing a library exercise category updates active workout and history records
- exercise history continuity remains intact after rename

### Phase 3 — Reporting and lookup hardening
Goal: remove fragile reporting dependence on name-only matching.

Tasks:
- update category lookup/reporting functions to prefer:
  1. `exerciseLibraryId`
  2. stored snapshot category
  3. legacy name match
  4. fallback to `Uncategorized`
- update exercise history lookups to use canonical ID when available
- verify swap/recommendation flows also use canonical matching where possible

Acceptance criteria:
- renamed exercises do not become uncategorized in reporting
- exercise history views remain continuous after propagation
- reporting still works for legacy records without IDs

### Phase 4 — Manual legacy repair flow
Goal: help imported or older data align with the current library.

Tasks:
- add a user-triggered action in settings or library management:
  - `Propagate / update all history`
- build a reconciliation routine for history exercises that do not yet have IDs
- matching strategy:
  1. exact ID match if present
  2. case-insensitive exact name match
  3. optionally safe normalized match later if needed
- when matched confidently:
  - set `exerciseLibraryId`
  - update `name`
  - update `category`
- generate a summary message, e.g.:
  - updated X workouts
  - linked Y exercises
  - skipped Z unmatched records

Acceptance criteria:
- user can run a manual repair after importing an old backup
- the repair flow updates old history where confident matches exist
- unmatched records are left untouched rather than guessed incorrectly

### Phase 5 — Cleanup and guardrails
Goal: reduce regression risk.

Tasks:
- remove or minimize remaining fragile name-only paths for core exercise identity
- add a concise manual test checklist for propagation behavior
- optionally add version tagging to exported/imported structures if useful

Acceptance criteria:
- core exercise identity paths no longer rely primarily on raw name matching
- manual test checklist exists for future regression checks

## Legacy migration strategy
The safest strategy is **progressive migration** rather than a one-shot destructive migration.

### Automatic migration
Whenever an exercise record is loaded/edited/matched confidently:
- attach `exerciseLibraryId` if missing
- refresh `name` / `category` snapshot if confidently linked

### Manual migration
After importing an old backup, user can run:
- `Propagate / update all history`

This avoids forcing risky automatic rewrites when legacy data is ambiguous.

## Matching strategy recommendations
### Preferred matching order
1. `exerciseLibraryId`
2. exact case-insensitive name match
3. later optional normalization layer if required

### Do not do yet
Avoid fuzzy guessing in the first implementation.

Examples to avoid auto-merging in P1:
- `Bench Press` -> `Barbell Bench`
- `DB Shoulder Press` -> `Dumbbell Shoulder Press`

Those can be handled later with a more explicit merge/relink UI if needed.

## Suggested code areas to touch
Likely implementation areas:
- `app.js`
  - exercise library edit/save flows
  - add exercise flow
  - current workout mutation logic
  - history rendering / exercise history lookups
  - category/reporting functions
  - import handling
- `storage.js`
  - if helper-level utility storage wrappers are needed for propagation-safe writes

Recommended extraction opportunity during P1:
- create a focused module for exercise identity / library-history propagation logic rather than adding all of it back into `app.js`

## Risks to manage
1. **Legacy records without IDs**
   - Mitigation: manual repair flow + conservative matching
2. **Accidental mass rename corruption**
   - Mitigation: ID-first matching, then exact name matching only
3. **Breaking history rendering**
   - Mitigation: keep snapshots on records and maintain backward compatibility
4. **Confusing user expectations on old data**
   - Mitigation: clear repair action and result summary

## Manual test checklist
1. Create a new library exercise and add it to a workout
2. Complete the workout and confirm history stores the exercise coherently
3. Rename the exercise in the library and confirm:
   - active workout updates
   - history updates
   - exercise history still resolves
   - category reporting still works
4. Change the category and confirm reports/stat views reflect it
5. Import an older backup and run `propagate / update all history`
6. Confirm matched records update and unmatched records are safely skipped

## Recommended implementation order
1. Phase 1 — data model foundation
2. Phase 2 — propagation engine
3. Phase 3 — reporting and lookup hardening
4. Phase 4 — manual legacy repair flow
5. Phase 5 — cleanup and guardrails

## Ready-to-build summary
The safest practical version of P1 is:
- add `exerciseLibraryId`
- keep snapshots for simplicity
- propagate edits using ID-first matching
- support conservative exact-name legacy relinking
- add a manual repair flow for imported old backups

This gives the app a much stronger trust model without forcing a huge rewrite.
