# Modular Cleanup Plan — MyGym frontend extraction

## Purpose
This plan defines the next cleanup pass for the MyGym frontend after the trust-critical storage, identity, propagation, manual repair, and reporting hardening work.

The goal is not a framework rewrite.
The goal is to reduce change risk in `app.js`, improve maintainability, and create cleaner seams for future work.

## Current situation
The frontend currently consists mainly of:
- `index.html`
- `styles.css`
- `app.js`
- `storage.js`
- `exercise-identity.js`
- `sw.js`

`app.js` still contains most application logic, with a very large surface area spanning:
- app bootstrap
- workout lifecycle
- exercise logging
- exercise library management
- autocomplete / search
- history rendering
- data management / editors
- import / export
- category configuration
- category reporting
- install prompt and PWA helpers
- coach integration

This concentration raises regression risk and makes future features slower to implement safely.

## Cleanup philosophy
1. **Extract by domain, not by arbitrary file size**
2. **Prefer stable seams that already exist conceptually**
3. **Do not rewrite behavior while extracting**
4. **Preserve the current simple no-build setup**
5. **Keep backward compatibility with current global function usage where practical**
6. **Use module-style global namespaces similar to `MyGymStorage` and `MyGymExerciseIdentity`**

## Recommended extraction targets

### Target 1 — Exercise library domain
Best first extraction target.

Why:
- already closely related to `exercise-identity.js`
- high-change surface
- central to propagation, repair, and future UX improvements
- contains both library CRUD and exercise selection/search behavior

Candidate responsibilities:
- load/save wrapper usage for library
- render exercise library list
- add/edit/delete library item flows
- usage stats update
- add-to-library helper
- autocomplete / suggestion flows
- search filtering
- swap candidate generation helpers if they remain library-driven

Suggested file:
- `exercise-library.js`

Suggested namespace:
- `MyGymExerciseLibrary`

### Target 2 — History and reporting domain
Second strongest extraction target.

Why:
- trust-critical and increasingly complex
- already improved by identity/reporting hardening
- easier to reason about when separated from workout-entry UI

Candidate responsibilities:
- history rendering
- workout detail modal rendering
- exercise history lookup/rendering
- category breakdown calculations
- heatmap generation
- reporting helpers
- history deletion / template reuse if they fit better here

Suggested file:
- `history-reporting.js`

Suggested namespace:
- `MyGymHistoryReporting`

### Target 3 — Data management / import-export tools
Strong third extraction target.

Why:
- naturally grouped in settings/data tools
- contains editor-like flows that clutter the main app file
- increasingly related to manual repair, import/export, and future admin-style tooling

Candidate responsibilities:
- data browser flows
- edit current workout/history/library utilities
- import/export handlers
- manual history repair trigger helpers
- summary formatting for repair flows

Suggested file:
- `data-tools.js`

Suggested namespace:
- `MyGymDataTools`

### Lower-priority later targets
#### Coach integration
Suggested file:
- `coach.js`

Includes:
- coach preference modal logic
- coach request payload assembly
- fetch/integration response handling

#### PWA / install helpers
Suggested file:
- `pwa.js`

Includes:
- install prompt logic
- banner show/hide behavior
- service worker registration helper if desired

#### Workout session UI
This is important but should likely be extracted later because it has the most direct UI coupling and highest break risk.

Suggested future file:
- `workout-session.js`

## Recommended implementation order

### Phase A — Library extraction
Move exercise library + autocomplete/search logic into `exercise-library.js`.

Why first:
- highest leverage with relatively clear boundaries
- directly adjacent to recent identity work
- reduces clutter in `app.js` quickly

Acceptance criteria:
- library CRUD still works exactly as before
- autocomplete still works
- add exercise flow still works
- propagation hooks still work
- `app.js` loses a meaningful chunk of library/search code

### Phase B — History/reporting extraction
Move history rendering and reporting helpers into `history-reporting.js`.

Acceptance criteria:
- history screen renders unchanged
- workout detail modal works
- exercise history modal works
- heatmap/category breakdown still works
- identity/reporting hardening remains intact

### Phase C — Data tools extraction
Move import/export and editor-style data management into `data-tools.js`.

Acceptance criteria:
- export/import still works
- manual repair action still works
- data browser still works
- no trust-critical regressions

### Phase D — Optional cleanup sweep
After extraction:
- simplify `app.js` into mostly bootstrap + top-level routing + core workout session orchestration
- remove dead duplication
- normalize cross-module helper usage

## Suggested architecture style
Because the app is currently no-build / script-tag based, use the same pattern as existing extracted files:

```js
(function () {
  function internalHelper() {}

  window.MyGymExerciseLibrary = {
    publicMethod() {}
  };
})();
```

This keeps the app simple and avoids premature tooling complexity.

## Guardrails during extraction
1. Do not change behavior and structure in the same step unless necessary.
2. Extract one domain at a time and manually test it.
3. Preserve current function names temporarily through thin delegating wrappers if needed.
4. Keep `index.html` script order explicit and stable.
5. Prefer moving helper clusters together rather than splitting tightly coupled logic across many tiny files.

## What not to do
- no framework migration
- no bundler/toolchain migration just for cleanup
- no simultaneous full UI redesign
- no large rename sweep unless it improves clarity inside the extracted module itself

## Recommended first cleanup item
**Start with `exercise-library.js`.**

Why this is the best first slice:
- most aligned with recent exercise identity work
- most likely to be touched again soon
- improves the codebase without destabilizing the workout core too early
- creates a clean bridge between library CRUD, autocomplete, and identity propagation

## Manual test checklist for cleanup phases
After each extraction phase, verify:
1. start workout
2. add exercise from library
3. autocomplete works
4. edit exercise library item
5. propagation still works
6. complete workout
7. view history
8. open exercise history
9. run repair/update history if relevant
10. export/import smoke check when data tools are touched

## Recommended next execution step
Create and implement **Phase A: `exercise-library.js` extraction** first.
