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
- Notes: implementation plan prepared in `docs/P1_EXERCISE_PROPAGATION_PLAN.md`; Phase 1 + 2 implemented with `exerciseLibraryId`, identity helpers, and propagation into active workout/history. Manual testing passed; later phases still pending.

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
