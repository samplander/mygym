# Backlog

This backlog is the structured home for work that emerges from chats, reviews, notes, and code exploration.

## Status lanes
- NOW
- NEXT
- LATER
- PARKING LOT

## Tags
Use one or more:
- `code`
- `product`
- `ux`
- `gtm`
- `ops`
- `research`

---

## NOW

### Plan modular cleanup of `app.js`
- Tags: `code` `ops`
- Status: planned
- Notes: modular cleanup plan prepared in `docs/IMPLEMENTATION_PLANS/MODULAR_CLEANUP_PLAN.md`; recommended extraction order is exercise library first, then history/reporting, then data tools

### Create first GTM clarity assessment
- Tags: `gtm` `product` `ux`
- Status: open
- Notes: identify whether the product promise and onboarding are obvious to a new user

### Refresh code-readiness assessment after P1 trust work
- Tags: `code`
- Status: open
- Notes: update the readiness view now that safe storage, propagation, reporting hardening, and the manual repair flow are all in place and have passed testing

## NEXT

### Define follow-up cleanup for exercise identity + propagation model
- Tags: `code` `product` `ux`
- Status: largely complete
- Notes: implementation plan prepared in `docs/IMPLEMENTATION_PLANS/P1_EXERCISE_PROPAGATION_PLAN.md`; core propagation, reporting hardening, and the explicit manual repair / update-all-history utility are implemented. Remaining work is mainly residual cleanup, guardrails, and any edge cases found during normal use.

### Build a concise regression checklist for trust-critical history flows
- Tags: `code` `ops`
- Status: open
- Notes: capture the highest-value manual checks for rename/category propagation, history continuity, reporting consistency, import compatibility, and the repair flow so future changes are easier to validate

## LATER

### Define launch path
- Tags: `gtm` `product`
- Status: open
- Notes: decide on private beta, small public test, waitlist, or broader launch

### Build prioritization rhythm
- Tags: `ops`
- Status: open
- Notes: weekly or session-based review of now/next/later priorities

## PARKING LOT
- Empty for now
