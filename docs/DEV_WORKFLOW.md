# MyGym Developer Workflow

## Status
Active workflow adopted on 2026-04-05.

## Core principle
- One inbox
- One planning layer
- One project home

For MyGym, this means:
- Apple Notes is the default raw input inbox
- Tjop is the planning and routing layer
- the MyGym repo docs are the structured execution home
- the codebase is the implementation truth
- Obsidian is no longer part of the active developer workflow

## Default loop
1. Capture
   - China captures a raw idea in Apple Notes or sends it directly to Tjop
2. Route
   - Tjop identifies whether it belongs to MyGym and classifies the work
3. Plan
   - Tjop creates a lean implementation plan when needed
4. Execute
   - implement directly or use agents when useful
5. Record
   - update only the durable project docs that matter

Short version:
- describe -> plan -> execute -> record

## Allowed input types
- feature idea
- bug
- frustration
- architecture concern
- technical debt
- UX concern
- product / GTM observation
- research question

## Handling rules
### Raw note only
Keep it in Apple Notes when:
- it is vague
- not yet actionable
- not prioritized
- not clearly worth project docs yet

### Immediate execution
Skip formal planning when:
- the change is small
- the risk is low
- the implementation path is obvious

### Backlog item
Add to `BACKLOG.md` when:
- it is actionable
- it matters to the project
- it is not being executed immediately

### Implementation plan
Create a plan doc when:
- the work touches multiple parts of the app
- there is material data / UX / architecture risk
- validation needs to be explicit
- the change is large enough that structure will save time

Default plan format:
- problem
- desired outcome
- proposed approach
- likely files / modules
- risks / edge cases
- validation steps

### Decision log
Add to `DECISIONS.md` when:
- a durable technical or product decision is made
- we want to avoid re-deciding the same thing later

## Source-of-truth map
- raw capture -> Apple Notes
- active actionable work -> `BACKLOG.md`
- durable decisions -> `DECISIONS.md`
- significant active implementation design -> `docs/IMPLEMENTATION_PLANS/`
- technical health / review snapshot -> `CODE_READINESS.md`
- product / market thinking -> `GTM.md`
- stable project framing -> `PROJECT_BRIEF.md`
- broad feature bank / inventory -> `FEATURE_INVENTORY.md`

## Non-goals
- do not use Obsidian as an active execution surface
- do not duplicate the same active item across Apple Notes, repo docs, and chat unless needed
- do not create heavyweight docs for small obvious changes

## Cleanup stance
Old notes and historical artifacts can remain for reference if needed, but the active workflow should run through:
- Apple Notes
- chat with Tjop
- repo docs
- codebase
