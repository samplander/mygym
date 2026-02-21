# MyGym Data Schemas

This document describes all data structures and schemas used in the MyGym application.

---

## LocalStorage Keys

The app uses the following localStorage keys:

- `currentWorkout` - Active workout session (JSON)
- `workoutHistory` - Array of completed workouts (JSON array, max 100 items)
- `exerciseLibrary` - User's exercise database (JSON array)
- `categoryConfig` - User's category configuration (JSON array)

---

## Core Data Models

### 1. Current Workout

**Key:** `currentWorkout`  
**Type:** Object or `null` (when no active workout)

```typescript
interface CurrentWorkout {
    id: number;                    // Timestamp (Date.now())
    startTime: string;             // ISO 8601 date string
    endTime?: string;              // ISO 8601 date string (set on completion)
    duration?: number;             // Duration in seconds (calculated on completion)
    accordionMode: boolean;        // If true, only one exercise expanded at a time
    exercises: Exercise[];         // Array of exercises
    totalSets?: number;           // Total sets count (calculated on completion)
    totalExercises?: number;      // Total exercises count (calculated on completion)
}
```

### 2. Exercise

Part of `CurrentWorkout.exercises[]`

```typescript
interface Exercise {
    id: number;                    // Timestamp (Date.now())
    name: string;                  // Exercise name
    collapsed: boolean;            // UI state - exercise card collapsed/expanded
    detailsHidden: boolean;        // UI state - set details hidden/visible
    timeMode: boolean;             // If true, shows time input instead of reps
    showPrevious: boolean;         // Display previous workout data
    selectedSetIndex: number | null; // Currently selected set for editing
    sets: Set[];                   // Array of sets
}
```

### 3. Set

Part of `Exercise.sets[]`

```typescript
interface Set {
    collapsed: boolean;            // UI state - set card collapsed/expanded
    completed: boolean;            // Whether the set was completed
    planned: SetValues;            // Planned/target values
    actual: SetValues;             // Actual performed values
}

interface SetValues {
    weight: number;                // Weight in kg
    reps: number;                  // Number of repetitions
    time: number;                  // Time in seconds (for time-based exercises)
}
```

**Backward Compatibility Note:**  
If `completed` is `undefined`, the app checks if actual values are greater than 0 to determine completion status.

---

## History & Library Models

### 4. Workout History

**Key:** `workoutHistory`  
**Type:** Array of completed workouts

```typescript
interface WorkoutHistory {
    id: number;                    // Timestamp (Date.now())
    startTime: string;             // ISO 8601 date string
    endTime: string;               // ISO 8601 date string
    completedAt: string;           // ISO 8601 date string (same as endTime)
    duration: number;              // Duration in seconds
    accordionMode: boolean;        // Accordion mode state
    exercises: Exercise[];         // Array of exercises (same structure as CurrentWorkout)
    totalSets: number;            // Total number of sets
    totalExercises: number;       // Total number of exercises
}
```

**Storage Limit:** Maximum 100 workouts. Oldest workouts are automatically removed when limit is exceeded.

### 5. Exercise Library

**Key:** `exerciseLibrary`  
**Type:** Array of exercise definitions

```typescript
interface ExerciseLibraryItem {
    id: number;                    // Timestamp (Date.now())
    name: string;                  // Exercise name
    category: string;              // Category name (e.g., "Push", "Pull", "Legs")
    createdAt: string;             // ISO 8601 date string
    lastUsed: string | null;       // ISO 8601 date string or null
    usageCount: number;            // Number of times exercise has been used
}
```

**Default Exercises:**
```javascript
[
    { name: "Bench Press", category: "Push" },
    { name: "Squats", category: "Legs" },
    { name: "Deadlift", category: "Pull" },
    { name: "Overhead Press", category: "Push" },
    { name: "Pull-ups", category: "Pull" }
]
```

### 6. Category Configuration

**Key:** `categoryConfig`  
**Type:** Array of category definitions

```typescript
interface Category {
    id: number;                    // Unique identifier
    name: string;                  // Category name
    color: string;                 // Hex color code (e.g., "#22c55e")
    protected: boolean;            // If true, cannot be deleted
}
```

**Default Categories:**
```javascript
[
    { id: 1, name: 'Push', color: '#22c55e', protected: false },
    { id: 2, name: 'Pull', color: '#3b82f6', protected: false },
    { id: 3, name: 'Legs', color: '#f59e0b', protected: false },
    { id: 4, name: 'Core', color: '#a855f7', protected: false },
    { id: 5, name: 'Cardio', color: '#ef4444', protected: false },
    { id: 6, name: 'Other', color: '#6b7280', protected: true },
    { id: 7, name: 'Uncategorized', color: '#374151', protected: true }
]
```

---

## Analytics & Stats Models

### 7. Heatmap Data

Generated dynamically for the home screen volume heatmap (last 30 days).

```typescript
interface HeatmapDay {
    date: string;                  // YYYY-MM-DD format
    volume: number;                // Total volume in kg for the day
    workoutCount: number;          // Number of workouts completed
    categoryBreakdown: {           // Volume by category
        [categoryName: string]: number;
    };
}

type HeatmapData = HeatmapDay[];   // Array of 30 days
```

### 8. Workout Statistics

Calculated dynamically when viewing workout details.

```typescript
interface WorkoutStats {
    totalSets: number;             // Total sets in workout
    completedSets: number;         // Number of completed sets
    completionRate: number;        // Percentage (0-100)
    totalVolume: number;           // Total volume in kg (weight × reps)
    highlights: WorkoutHighlight[]; // Notable achievements
}

interface WorkoutHighlight {
    icon: string;                  // Emoji or icon
    text: string;                  // Description of achievement
}
```

### 9. Exercise Statistics

Calculated dynamically for individual exercises in workout details.

```typescript
interface ExerciseStats {
    allCompleted: boolean;         // All sets completed
    summary: string;               // Human-readable summary (e.g., "3 sets • 150kg")
    volume: number;                // Total volume for exercise
}
```

### 10. Category Breakdown

Generated dynamically for the category breakdown modal.

```typescript
interface CategoryBreakdown {
    workoutCount: number;          // Total workouts in date range
    totalVolume: number;           // Total volume across all categories
    categories: {                  // Volume by category
        [categoryName: string]: number;
    };
}
```

---

## Export/Import Schema

### 11. Backup Data

Used for data export/import functionality.

```typescript
interface BackupData {
    exportDate: string;            // ISO 8601 date string
    version: string;               // Backup format version (currently "1.0")
    currentWorkout: CurrentWorkout | null;
    workoutHistory: WorkoutHistory[];
    exerciseLibrary: ExerciseLibraryItem[];
    categoryConfig?: Category[];   // Optional, may not exist in older backups
}
```

**File Format:** JSON  
**File Name Pattern:** `mygym-backup-YYYY-MM-DD.json`

---

## UI State Models

### 12. Data Browser State

Internal state for the data management browser modal.

```typescript
interface DataBrowserState {
    type: 'history' | 'exercises' | 'current' | null;
    workoutId: number | null;      // Selected workout ID (for history navigation)
    exerciseIndex: number | null;  // Selected exercise index
    breadcrumb: string[];          // Navigation breadcrumb trail
}
```

### 13. Autocomplete State

Internal state for exercise name autocomplete.

```typescript
let selectedAutocompleteIndex: number; // Currently selected suggestion (-1 = none)
```

---

## Validation Rules

### Field Constraints

- **Exercise Name:** Required, non-empty string
- **Weight:** Non-negative number (≥ 0)
- **Reps:** Non-negative integer (≥ 0)
- **Time:** Non-negative integer (≥ 0) in seconds
- **Category Name:** Required for new categories
- **Color:** Valid hex color code (e.g., "#22c55e")

### Business Rules

1. **Workout History Limit:** Maximum 100 workouts stored
2. **Exercise Uniqueness:** Exercise names are case-insensitive unique in the library
3. **Protected Categories:** "Other" and "Uncategorized" cannot be deleted
4. **Set Completion:** A set is considered completed if:
   - `completed` property is `true`, OR
   - `actual.weight > 0` OR `actual.reps > 0` OR `actual.time > 0`
5. **Accordion Mode:** When enabled, expanding an exercise collapses all others

---

## Migration Notes

### Backward Compatibility

The app handles missing properties gracefully:

- `accordionMode` defaults to `true` if undefined
- `completed` in sets falls back to value-based checking
- `completedAt` may be missing in older workouts (uses `endTime` instead)
- `categoryConfig` may not exist in older installations (uses default categories)

### Version History

- **v1.0 (Current):** Initial schema with all features documented above

---

## Related Files

- **Data Logic:** [app.js](app.js) lines 1-2700 (all data management functions)
- **Persistence:** [app.js](app.js#L825-L839) (localStorage functions)
- **UI Rendering:** [index.html](index.html) (all modals and screens)
- **Style Definitions:** [styles.css](styles.css) (visual styling)

---

## Quick Reference

### Key Functions

- `saveCurrentWorkout()` - Persist current workout to localStorage
- `loadCurrentWorkout()` - Load current workout from localStorage
- `saveToHistory()` - Move completed workout to history
- `loadExerciseLibrary()` - Get exercise library
- `saveExerciseLibrary(lib)` - Persist exercise library
- `loadCategoryConfig()` - Get category configuration
- `saveCategoryConfig(cats)` - Persist category configuration

### Storage Usage Estimate

- **Current Workout:** ~5-50 KB (depends on exercise/set count)
- **Workout History:** ~500 KB - 2 MB (100 workouts)
- **Exercise Library:** ~10-100 KB (depends on exercise count)
- **Total Typical Usage:** < 3 MB (well within 5-10 MB localStorage limit)
