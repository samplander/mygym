# Feature Inventory

This file is the broad feature bank for MyGym.

Use it for:
- stable understanding of what the app already does
- grouped feature areas
- notable imported ideas worth keeping in the project memory

Do not use it as the main active execution tracker.
Actionable current work should live in `BACKLOG.md`.
Large active changes can have plans in `docs/IMPLEMENTATION_PLANS/`.

## Current known product surface
- AI Coach workout generation
- blank workout mode
- coach customization
- workout history
- templates / quick start
- live exercise swap
- custom exercise library
- per-exercise history
- local-first storage
- export / backup
- offline-capable experience
- stats

## Core feature areas
### Workout execution
- start workout
- log sets
- add exercise
- complete workout
- continue current workout
- reorder exercises during workout
- compare previous workout with current

### Programming / intelligence
- AI coach
- coach preferences
- adaptive recommendations
- workout generation from goals / user inputs
- progression logic ideas
- rationale / notes for generated workouts

### Data / library / history
- exercise library
- categories
- workout history
- exercise history
- stats
- import / export
- repair / update-all-history flow

### UX / onboarding
- first-run clarity
- navigation
- terminology
- settings
- install flow on Android & iOS
- active workout focus improvements

## Imported idea bank from earlier notes
These are preserved as a structured idea bank, not a committed roadmap.

### Confirmed important fixes / learnings
- Edit exercise should update history as well
- Rename exercise across history and current workout

### Workout execution / UX ideas
- Swap should show previous sets and weights for reuse
- Summary screen
- Edit workout data from workout history screen
- Remove top margin in distraction-free mode
- Complete workout button is too large
- Change time icon to `00:00`
- Set exercises per workout
- Reset clock during workout
- Down/up arrow slide to show/hide header/footer
- Auto-hide exercise details on collapse / improve active workout focus
- One-click complete, second click reveals delete confirmation
- Prepopulate weight or sets to show progress
- Auto-select planned when adding new set
- Color-code completed sets / current set
- Remove planned values app-wide
- Copy from previous set
- Use template while keeping planned values

### AI / intelligence ideas
- Free AI workout URL to create a plan
- Store rationale
- Add notes per exercise for AI feedback
- Notes per exercise & AI notes
- Add rationale to each workout with an info icon
- Warn if training more than once a day, then default to light cardio
- Generate workouts with AI based on goals and a user wizard
- Automatic progression logic on successful lifts

### Tracking / analytics / progression ideas
- Track mesocycle / longer-term blocks
- Current volume per completed set
- Git-like workout frequency visual
- General performance stats
- Set / rest timer
- Body-part workout breakdown
- More detail on last time exercise was used
- Track 8-week / duration-based progression blocks

### Platform / system ideas
- Import workout JSON
- Exercise default type, e.g. time or sets
- Color-dot workout groups

### Larger / later ideas
- Weight management
- Food tracking with good/bad day history
- Integrate: skaal
- Goals: short-term & long-term
- Curves gym concept hardware
- Gym trainer
- Alternatives if gym is busy, with workout difficulty / volume adjustments

## Notes
- This doc is intentionally broad.
- If an idea becomes active and actionable, promote it into `BACKLOG.md`.
- If a large change needs structure before coding, create a plan in `docs/IMPLEMENTATION_PLANS/`.
