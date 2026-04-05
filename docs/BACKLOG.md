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

### Review repository structure and stack
- Tags: `code` `research`
- Status: open
- Notes: inspect current implementation, identify stack, map major files, and summarize risks/opportunities

### Define and implement exercise identity + propagation model
- Tags: `code` `product` `ux`
- Status: in progress
- Notes: implementation plan prepared in `docs/P1_EXERCISE_PROPAGATION_PLAN.md`; propagation, manual repair flow, and reporting hardening have been implemented and verified through iterative testing. Residual cleanup may remain, but the core trust work is largely complete.

### Plan modular cleanup of `app.js`
- Tags: `code` `ops`
- Status: planned
- Notes: modular cleanup plan prepared in `docs/MODULAR_CLEANUP_PLAN.md`; recommended extraction order is exercise library first, then history/reporting, then data tools

### Create first code-readiness assessment
- Tags: `code`
- Status: open
- Notes: include findings from the exercise propagation trace and identify architecture, reliability, deployment readiness, naming, config, data handling, and polish gaps

## NEXT

### Add manual history propagation / repair flow for imported legacy backups
- Tags: `code` `product`
- Status: open
- Notes: add a user-triggered action to update or reconcile imported workout history with the current exercise library definitions when old data lacks stable identity links

### Create first GTM clarity assessment
- Tags: `gtm` `product` `ux`
- Status: open
- Notes: identify whether the product promise and onboarding are obvious to a new user

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
