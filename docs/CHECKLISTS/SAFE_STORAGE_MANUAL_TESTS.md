# Safe storage manual test checklist

Quick smoke tests for the P0 safe storage layer.

## Normal flow
- Start a new workout, add an exercise, refresh, and confirm the active workout resumes.
- Complete the workout and confirm it moves into history.
- Add/edit an exercise in the library and confirm it persists after refresh.
- Add/edit categories and confirm they persist after refresh.

## Recovery flow
Open DevTools and manually corrupt stored values, then refresh:
- `localStorage.setItem('currentWorkout', '{broken json')`
- `localStorage.setItem('workoutHistory', '{broken json')`
- `localStorage.setItem('exerciseLibrary', '"not-an-array"')`
- `localStorage.setItem('categoryConfig', '{"bad":true}')`

After refresh, confirm:
- The app still loads.
- `currentWorkout` recovers to `null`.
- `workoutHistory` recovers to an array.
- `exerciseLibrary` recovers to the default exercise list.
- `categoryConfig` recovers to default categories.
- Backup keys like `currentWorkout__backup__...` exist in localStorage.

## Import/export
- Export data and confirm the JSON includes current workout, history, and exercise library.
- Import a valid backup and confirm trust-critical data is restored.
- Import a backup with duplicate/missing workout IDs and confirm history still loads.
