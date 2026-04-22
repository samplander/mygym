# UI Refresh Plan — Core Navigation, Lists, and Forms

## Purpose
Deliver a constrained visual refresh for the highest-frequency UI surfaces in MyGym without changing the product structure or interaction model.

This phase should make the app feel more deliberate, modern, and trustworthy while preserving the current fast mobile workflow.

## Scope stance
This is not a redesign.
It is a cleanup and system pass across the existing shell and utility surfaces.

In scope:
- sticky headers and bottom navigation that act as the app shell
- list-driven surfaces in History, Settings, Exercise Library, Categories, Data Browser, swap picker, and related modal lists
- form surfaces in settings, modals, record editors, and workout add/edit flows
- shared surface primitives directly supporting those views

Out of scope:
- new IA or navigation structure
- major workout flow rewrites
- changing core data models
- adding new product features just to justify visual work
- decorative effects that make the app slower or louder

## What the codebase actually looks like today
The refresh should be grounded in the current implementation, not generic UI planning language.

### Current shell structure
From `index.html` and `styles.css`:
- there is no literal desktop sidebar, the main shell is a mobile app shell built from `.sticky-header` and `.bottom-nav`
- History and Settings both use the same shell pattern, with the workout screen using a related sticky header plus floating action region
- active navigation uses a bright green filled pill inside `.nav-icon-wrapper`, while inactive items are low-contrast gray text/icons
- shell styling already uses glass / blur / rounded surfaces, but spacing, radii, and visual weight are inconsistent between shell and content cards

### Current list surfaces
Main list-style surfaces currently in use:
- History feed: `.history-card`, `.history-overview-card`, `.history-insight-pill`, `.history-controls`
- Workout exercise stack: `.exercise-card`, `.exercise-header`, `.set-row`
- Exercise library: `.exercise-library-card`
- Category manager: `.category-card`
- Data browser: `.data-browser-item`
- Swap picker: `.swap-option`
- Detail views and modal list rows also reuse similar but not identical card treatments

Observed issues:
- card surfaces mostly alternate between `#1a1a1a` and `#2a2a2a`, but without a strict rule for when each is used
- border opacity and corner radius vary widely, which makes the app feel hand-tuned rather than systemized
- several list rows use different padding, icon button sizes, and subtitle contrast for similar jobs
- some rows feel heavier than needed because borders, shadows, fills, and gradients are all competing at once

### Current form surfaces
Main form-style surfaces:
- add exercise modal
- coach preferences modal
- add/edit exercise library modal
- category modal
- record editor modal
- history filters and custom date-range controls
- exercise search input and category selects inside Settings

Observed issues:
- global `.form-control, .form-select` styling provides a baseline, but field sizing and grouping are inconsistent across screens
- modals have a strong baseline, yet body spacing, footer spacing, and field group structure vary from one modal to the next
- some high-frequency editors are clean enough functionally, but still feel dense or visually improvised, especially in the record editor and settings sections
- primary and secondary actions are not always visually ranked the same way across forms

## Design principles for this phase
- keep the existing dark, performance-oriented feel
- reduce visual noise before adding polish
- use stronger hierarchy, not more decoration
- make repeated structures look intentionally related
- optimize for thumb-friendly scanability on mobile first
- prefer durable improvements in spacing, contrast, and state treatment over one-off cosmetics

## Target outcome
After this phase:
- shell, list, and form surfaces should feel like one coherent visual system
- the app should still read as the same product, just more resolved
- users should be able to scan settings, history, and editor screens faster
- forms should feel easier to complete and less cramped
- action hierarchy should be clearer without increasing cognitive load

## Surface audit and implementation notes

### 1) App shell: sticky headers + bottom nav
Treat the app shell as the sidebar-equivalent navigation layer for this mobile app.

#### Current strengths
- sticky/fixed navigation already exists and is consistent structurally
- rounded glass treatment matches the product's current dark aesthetic
- active state is obvious

#### Current problems
- shell chrome is visually heavier than some content underneath it
- header and nav use similar ingredients, but not a clearly shared token set
- active item treatment is clear but slightly loud relative to surrounding content
- label sizing and icon wrapper sizing are close, but not system-tight

#### Refresh goals
- tighten shell spacing and visual rhythm
- unify shell radius, border opacity, blur, and shadow rules
- keep active state obvious while slightly reducing the "glow blob" feel
- ensure content cards do not visually fight the shell for attention

#### Primary selectors likely touched
- `.sticky-header`
- `.bottom-nav`
- `.bottom-nav.nav-4-items`
- `.nav-item`
- `.nav-icon-wrapper`
- `.btn-back`
- `.workout-header-icon-btn`

### 2) Lists and cards
#### History list
Current classes:
- `.history-overview-card`
- `.history-controls`
- `.history-card`
- `.history-metric-pill`
- `.history-card-actions`

Refresh intent:
- make overview cards, control panel, and history feed feel related but not identical
- simplify card hierarchy so date/title/value contrast carries more of the structure
- tighten button row hierarchy so actions read as secondary to content

#### Workout exercise list
Current classes:
- `.exercise-card`
- `.exercise-header`
- `.exercise-body`
- `.set-row`
- `.add-set-btn`
- `.exercise-menu`

Refresh intent:
- preserve the strong green exercise header concept, but make body and row surfaces feel more refined
- reduce the sense that each exercise card is built from unrelated subcomponents
- improve set-row legibility and input rhythm without changing behavior
- make the exercise menu feel like part of the same system as other list surfaces

#### Settings lists
Current classes:
- `.exercise-library-card`
- `.category-card`
- `.data-browser-item`
- `.swap-option`

Refresh intent:
- align these rows around one shared row primitive, with small variants if needed
- normalize row padding, title/subtitle hierarchy, action button placement, and hover/press response
- especially improve `swap-option`, which currently reads more like a dashed CTA tile than a selectable list row

### 3) Forms and editors
#### Modal/forms baseline
Current classes:
- `.modal-content`
- `.modal-header`
- `.modal-body`
- `.modal-footer`
- `.form-control`
- `.form-select`
- `.form-label`
- `.field-editor-group`
- `.field-row`
- `.field-input`

Refresh intent:
- keep the current modal architecture, but standardize vertical rhythm inside forms
- strengthen label, helper, and control hierarchy
- make dense editors feel cleaner through spacing and grouping, not larger screens or more steps
- align primary/secondary button treatment across modals

#### Specific form surfaces to check during implementation
- add exercise modal autocomplete and add-to-library block
- coach preferences modal select/input/textarea spacing
- exercise library add/edit modal
- category modal including swatch selection area
- record editor modal for sets and exercise metadata
- date range controls in category breakdown modal

## Shared visual rules to define before coding
Implementation should start by defining or tightening a small shared set of tokens in `styles.css`, rather than editing every surface ad hoc.

Define or normalize:
- a compact spacing scale for 8 / 10 / 12 / 14 / 16 / 20px usage
- a reduced radius system, likely around 8 / 12 / 16 / 20 / 24px
- a surface stack, for example:
  - page background
  - shell surface
  - section/card surface
  - inset/row surface
  - interactive hover/active overlays
- one consistent border opacity ladder
- one consistent shadow ladder
- shared text hierarchy for title, body, meta, helper, and label text
- consistent interactive states for hover, active, focus-visible, selected, completed, and disabled

## Recommended implementation order

### Slice 1, establish shared tokens and shell cleanup
Do first:
- normalize root-level surface, border, and text variables in `:root`
- refactor `.sticky-header`, `.bottom-nav`, `.nav-item`, `.nav-icon-wrapper`, `.btn-back`
- verify History and Settings still feel balanced after shell changes

Why first:
- this creates the baseline visual language the list and form surfaces can inherit from

### Slice 2, normalize list rows and card sections
Do next:
- refresh `history` cards and controls
- refresh settings/library/category/data-browser rows
- convert `swap-option` from special-case CTA styling into list-row styling
- align action icon buttons used inside list rows

Why second:
- these are the broadest repeated surfaces outside the workout flow

### Slice 3, refresh form controls and modal rhythm
Do next:
- normalize modal spacing
- tighten control heights, labels, helper text, and button hierarchy
- improve `field-editor-group` and `field-row`
- check date inputs, select controls, and textareas for consistency

Why third:
- once row/card primitives are stable, form grouping becomes easier to tune without drifting

### Slice 4, workout-specific pass
Do last inside this phase:
- refine `exercise-card`, `exercise-body`, `set-row`, `exercise-menu`, and related buttons
- keep behavior identical unless a tiny no-risk markup adjustment is clearly needed
- ensure workout screen still prioritizes speed and thumb reach over visual polish

Why last:
- the workout screen is the most sensitive surface and should inherit the new system cautiously

## Implementation constraints
- prefer CSS-first changes
- avoid HTML restructuring unless it is tiny and clearly reduces CSS hacks
- avoid touching app logic in `app.js` unless a no-risk class hook or tiny markup support is required
- do not rename broad classes unnecessarily during this phase
- preserve existing screen flows, button labels, and control order unless a specific issue is obvious

## Acceptance checklist

### Shell
- sticky headers and bottom nav feel related and lighter
- active nav item remains obvious but less visually blunt
- shell chrome no longer outshines content cards

### Lists
- history, library, category, data-browser, and swap rows feel like one family
- title/subtitle hierarchy is consistent
- list action buttons feel aligned and intentionally secondary
- hover/press states are subtle and consistent

### Forms
- modal spacing is consistent across add/edit flows
- fields, labels, and helper text follow the same rhythm
- primary and secondary actions are visually ranked consistently
- dense editor surfaces feel cleaner without losing compactness

### Workout-specific surfaces
- exercise cards and set rows feel more refined but still fast
- menus, inline actions, and completed states match the rest of the system
- no regressions to add set, complete set, swap, or delete flows

## Manual validation pass
After implementation, manually check:
- Home -> History -> Stats -> Settings navigation
- Settings exercise search, add exercise, edit exercise, add category, edit category
- Data Browser for history, exercise library, and current workout
- Add Exercise modal with autocomplete open and closed
- Coach preferences modal on a narrow phone-width viewport
- Workout screen with 0 exercises, 1 exercise, and multiple exercises
- workout screen with UI chrome shown and hidden
- swap exercise flow
- record editor modal on set editing and exercise editing

## Risks to avoid
- overusing gradients, shadows, or glow and making the UI noisier
- making the dark theme flatter but harder to scan
- introducing too many one-off utility fixes instead of shared primitives
- making workout inputs larger/heavier in a way that slows repeated logging
- polishing static screens while leaving the highest-frequency editor surfaces inconsistent

## Recommended definition of done
This phase is done when:
- the shell, list, and form surfaces clearly share one visual system
- the app feels more current and trustworthy without feeling redesigned
- the implementation remains mostly CSS-scoped and low risk
- the next engineering step can be a focused implementation pass, not another planning rewrite

## Recommended next implementation slice
Start with `styles.css` token cleanup plus shell normalization, then move into settings/history/data-browser rows before touching workout set rows.
That order gives the best visual leverage with the lowest product risk.