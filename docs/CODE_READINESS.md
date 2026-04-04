# Code Readiness

This document is for assessing whether the app is robust enough for broader usage and market-facing release.

## Review dimensions
- project structure
- architecture clarity
- data model and persistence
- onboarding flow
- UX clarity for first-time users
- error handling
- environment / config handling
- analytics / observability
- performance
- offline behavior
- import / export reliability
- security and privacy posture
- release readiness

## Current status
- Initial technical review completed on 2026-04-04.
- App is promising and genuinely usable, but still prototype-to-early-product grade rather than relaxed-beta grade.
- P0 safe storage layer has been implemented and manually verified.
- Exercise identity / propagation is now identified as a top trust-critical follow-up issue.

## Current architecture snapshot
- Frontend is a lightweight PWA with `index.html`, `styles.css`, `app.js`, `storage.js`, and `sw.js`
- Most application logic still lives inside a large single `app.js`
- `storage.js` now centralizes trust-critical storage access for key local-first data
- Service worker is minimal and focused more on installability than rich offline caching

## Key findings

### 1) Giant single-file frontend architecture
- Severity: high
- User impact: indirect but meaningful over time
- Finding: the app remains concentrated in one large `app.js` with around 140 functions, mixing UI, domain, persistence, reporting, and integration logic
- Recommended fix: continue extracting domain modules after trust-critical fixes, starting with exercise identity / library/history concerns
- Priority: high

### 2) Exercise identity / propagation is a top trust issue
- Severity: critical
- User impact: high
- Finding: exercise edits do not propagate reliably everywhere because the app uses a fragile hybrid of stored workout snapshots and name-based matching against the exercise library
- Recommended fix: implement a stable exercise identity model and propagation logic, plus a manual `propagate / update all history` flow for legacy imports
- Priority: highest

### 3) Storage safety improved materially
- Severity: positive improvement / medium residual risk
- User impact: high
- Finding: the new safe storage layer reduced corruption risk for `currentWorkout`, `workoutHistory`, `exerciseLibrary`, and `categoryConfig`; manual testing passed and old backups still imported successfully
- Recommended fix: keep building on this pattern and avoid reintroducing scattered trust-critical storage access
- Priority: maintain

### 4) Frontend config / secret handling is not release-ready
- Severity: high
- User impact: medium now, high later
- Finding: coach API configuration and API key are exposed in frontend code, which is acceptable for temporary iteration but poor for broader release posture
- Recommended fix: move toward safer config/auth handling before wider launch
- Priority: high

### 5) UX feedback patterns are still prototype-grade
- Severity: medium
- User impact: medium
- Finding: the app still relies heavily on blocking `alert()` and `confirm()` flows for validation, destructive actions, and errors
- Recommended fix: gradually replace with in-context confirmations, toasts, and friendlier error handling after trust-critical fixes
- Priority: medium

### 6) Observability and analytics are minimal
- Severity: medium-high
- User impact: product-learning risk more than immediate breakage
- Finding: there is no clear lightweight analytics, event tracking, or front-end error monitoring in place
- Recommended fix: add lightweight event tracking before broader beta to understand onboarding and usage behavior
- Priority: medium-high

### 7) Offline / PWA support is basic
- Severity: medium
- User impact: depends on positioning
- Finding: service worker supports installability but does not yet implement richer offline caching behavior
- Recommended fix: keep current approach for now unless stronger offline promises are made publicly
- Priority: medium-later

### 8) Import / export is in decent shape for current stage
- Severity: moderate positive
- User impact: high trust value
- Finding: import/export remains compatible after the storage hardening pass, including old backup compatibility and category config support
- Recommended fix: tie future import cleanup into the exercise propagation / legacy repair flow
- Priority: maintain

## Overall assessment
- Product readiness: promising
- Code readiness: medium-low to medium
- Release confidence for broader use: not yet, but moving in the right direction

The app already has real utility and strong product signal, but it still needs a few trust-critical engineering improvements before broader exposure.

## Recommended priority order
1. Implement P1 exercise identity + propagation
2. Continue modular extraction from `app.js` in the same area
3. Do a readiness polish pass covering config hygiene, analytics, and UX feedback patterns
4. Pair this with GTM clarity / onboarding review

## Important recent outcomes
- P0 safe storage layer was implemented in `storage.js`
- Manual testing passed
- Old backups still import successfully
- Exercise propagation has been elevated into a formal work item and decision
