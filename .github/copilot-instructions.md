# MyGym - Copilot Instructions

## Project Overview
MyGym is a **mobile-first Progressive Web App** (PWA) for tracking gym workouts. It's a single-page application using vanilla JavaScript, Bootstrap 5, and localStorage for data persistence. No build tools, no framework—just HTML, CSS, and JS.

## Architecture

### Core Files
- [index.html](../index.html) - Single HTML file with all screens and modals
- [app.js](../app.js) - All application logic (~1500 lines)
- [styles.css](../styles.css) - Mobile-first styles with glassmorphism effects (~2000 lines)
- [sw.js](../sw.js) - Minimal service worker (fetch pass-through for PWA installability)
- [manifest.json](../manifest.json) - PWA configuration

### Screen Management Pattern
The app uses a screen-based navigation system with Bootstrap classes:
- All screens exist in DOM simultaneously
- Navigation toggles `.d-none` class to show/hide screens
- Screens: `homeScreen`, `workoutScreen`, `historyScreen`, `settingsScreen`
- Navigation functions: `showHomeScreen()`, `showWorkoutScreen()`, etc.

```javascript
// When navigating, hide all screens, show target screen, then render
document.getElementById('homeScreen').classList.add('d-none');
document.getElementById('workoutScreen').classList.remove('d-none');
```

### State Management
Global state in `app.js`:
- `currentWorkout` - Active workout session (null when no workout active)
- `timerInterval` - Workout timer reference

**Critical**: Always call `saveCurrentWorkout()` after ANY state mutation to persist to localStorage.

### Data Models

#### Workout Structure
```javascript
currentWorkout = {
    id: timestamp,
    startTime: ISO date string,
    endTime: ISO date string (on completion),
    duration: seconds (calculated on completion),
    accordionMode: boolean, // All exercises collapsed except active one
    exercises: [
        {
            id: timestamp,
            name: string,
            collapsed: boolean,
            detailsHidden: boolean,
            timeMode: boolean, // Show time input instead of reps
            showPrevious: boolean, // Display previous workout data
            sets: [
                {
                    collapsed: boolean,
                    completed: boolean,
                    planned: { weight: number, reps: number, time: number },
                    actual: { weight: number, reps: number, time: number }
                }
            ],
            selectedSetIndex: number | null
        }
    ],
    totalSets: number (calculated),
    totalExercises: number (calculated)
}
```

#### Exercise Library
```javascript
exerciseLibrary = [
    {
        id: timestamp,
        name: string,
        category: "Push" | "Pull" | "Legs" | "Core" | "Cardio" | "Other" | "",
        createdAt: ISO string,
        lastUsed: ISO string | null,
        usageCount: number
    }
]
```

### LocalStorage Keys
- `currentWorkout` - Active workout session
- `workoutHistory` - Array of completed workouts (max 100, newest first)
- `exerciseLibrary` - User's exercise database

## Key Features & Patterns

### Accordion Mode
Exercises auto-collapse when a new one is expanded. Set `currentWorkout.accordionMode = true` (default).

### Autocomplete System
- Searches `exerciseLibrary` by name prefix
- Shows usage stats (last used, usage count)
- Keyboard navigation: Arrow keys + Enter
- Auto-adds new exercises to library when checkbox is checked
- Implementation: `initializeAutocomplete()` in [app.js](../app.js#L1270-L1350)

### Set Completion Toggle
- Sets track `completed` state (boolean)
- Backward compatibility: If `completed` undefined, check if actual values > 0
- See `calculateWorkoutStats()` for completion logic

### Direct Input Mode
- Users can type values directly into set displays
- Functions: `handleDirectInput()`, `handleDirectInputBlur()`
- Updates `actual` values in set objects

### Timer
- Starts on workout screen load
- Format: HH:MM:SS
- Global interval: `timerInterval`
- Functions: `startTimer()`, `stopTimer()`, `updateTimer()`

## Development Guidelines

### Adding New Features
1. **New exercise properties**: Add to both creation and rendering logic
2. **New modals**: Follow Bootstrap 5 modal pattern in [index.html](../index.html)
3. **New stats**: Update `calculateWorkoutStats()` and `renderQuickStats()`

### Mobile-First Rules
- Touch target minimum: 44px (see `--touch-target` in [styles.css](../styles.css))
- Test viewport: 375px-430px width
- Use Bootstrap breakpoints: `modal-fullscreen-sm-down` for mobile modals
- Safe area insets: `padding-bottom: env(safe-area-inset-bottom)`

### Styling Conventions
- Glassmorphism effects: `.glass-btn`, `.glass-card`
- Gradient backgrounds: See `#homeScreen` in [styles.css](../styles.css)
- Icons: Bootstrap Icons (bi-\*)
- Cards use: `.exercise-card`, `.history-card`, `.set-card`

### Data Persistence
**IMPORTANT**: After every state change, call `saveCurrentWorkout()`. This is the ONLY way data persists.

Common mistake:
```javascript
// ❌ Wrong - changes lost on refresh
currentWorkout.exercises[0].name = "New Name";

// ✅ Correct
currentWorkout.exercises[0].name = "New Name";
saveCurrentWorkout();
```

### History & Templates
- `saveToHistory()` - Adds completed workout to history
- History limited to 100 workouts (oldest auto-pruned)
- "Use as Template" clones workout structure without set data

## Testing Locally
1. Open [index.html](../index.html) in browser (no server needed)
2. For PWA testing: Use Live Server or `python -m http.server`
3. Check localStorage in DevTools → Application → Local Storage

## Common Tasks

### Add a new screen
1. Add HTML in [index.html](../index.html) with class `screen d-none`
2. Create `showXScreen()` function
3. Add navigation button with `onclick="showXScreen()"`
4. Update bottom nav in all screens

### Add modal functionality
1. Define modal HTML with `modal fade` classes
2. Initialize with `new bootstrap.Modal(element)`
3. Show: `modal.show()`
4. Close: `modal.hide()` or `data-bs-dismiss="modal"`

### Modify exercise card rendering
See `renderExercises()` in [app.js](../app.js#L435-L600) - uses template literals with inline event handlers.

## Performance Notes
- No bundler - browser parses JS on load
- Keep [app.js](../app.js) under 2000 lines for maintainability
- LocalStorage has ~5-10MB limit - history cap prevents overflow
- Service worker intentionally minimal (no aggressive caching)

## Code Style
- Use `function` declarations (not arrow functions for top-level)
- Event handlers: Mix of `addEventListener` and inline `onclick`
- No semicolons on some lines (inconsistent) - match existing style
- Template literals for HTML generation
- camelCase for variables/functions
