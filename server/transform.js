// ─── transform.js ────────────────────────────────────────
// Transforms raw localStorage data into LLM-friendly format
// and maps LLM responses back to app-compatible structures
// ─────────────────────────────────────────────────────────

/**
 * Strip UI state fields and reduce workout history to what matters for coaching.
 * This keeps token usage low and the LLM focused on training data.
 */
function transformForLLM(payload) {
  const { workoutHistory, exerciseLibrary, categoryConfig, preferences } = payload;

  return {
    history: (workoutHistory || []).map(transformWorkout),
    exercises: (exerciseLibrary || []).map(e => ({
      name: e.name,
      category: e.category,
      usageCount: e.usageCount,
      lastUsed: e.lastUsed
    })),
    categories: (categoryConfig || []).map(c => c.name),
    preferences: preferences || {},
  };
}

/**
 * Transform a single workout, stripping UI state
 */
function transformWorkout(workout) {
  return {
    date: workout.startTime,
    duration: workout.duration,
    exercises: (workout.exercises || []).map(ex => ({
      name: ex.name,
      timeMode: ex.timeMode || false,
      sets: (ex.sets || []).map(s => ({
        completed: s.completed ?? (s.actual?.weight > 0 || s.actual?.reps > 0 || s.actual?.time > 0),
        planned: s.planned,
        actual: s.actual,
      }))
    }))
  };
}

/**
 * Build a CurrentWorkout object from the LLM response
 * that the app can write straight to localStorage
 */
function buildCurrentWorkout(llmWorkout) {
  const now = Date.now();

  return {
    id: now,
    startTime: new Date().toISOString(),
    accordionMode: true,
    exercises: (llmWorkout.exercises || []).map((ex, i) => ({
      id: now + i + 1,
      name: ex.name,
      collapsed: i > 0,         // First exercise expanded, rest collapsed
      detailsHidden: false,
      timeMode: ex.timeMode || false,
      showPrevious: true,
      selectedSetIndex: null,
      sets: (ex.sets || []).map(s => ({
        collapsed: false,
        completed: false,
        planned: {
          weight: s.weight ?? 0,
          reps: s.reps ?? 0,
          time: s.time ?? 0,
        },
        actual: {
          weight: s.weight ?? 0,
          reps: s.reps ?? 0,
          time: s.time ?? 0,
        },
      }))
    }))
  };
}

/**
 * Patch the exercise library with any new exercises the coach suggested.
 * Returns the updated library (or original if no changes).
 */
function patchExerciseLibrary(existingLibrary, coachExercises, categoryConfig) {
  const existingNames = new Set(
    existingLibrary.map(e => e.name.toLowerCase())
  );
  const validCategories = new Set(
    (categoryConfig || []).map(c => c.name)
  );

  const newExercises = [];

  for (const ex of coachExercises) {
    if (!existingNames.has(ex.name.toLowerCase())) {
      newExercises.push({
        id: Date.now() + Math.random() * 1000,
        name: ex.name,
        category: validCategories.has(ex.category) ? ex.category : 'Uncategorized',
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0,
      });
      existingNames.add(ex.name.toLowerCase());
    }
  }

  if (newExercises.length === 0) return null; // No changes needed

  return [...existingLibrary, ...newExercises];
}

module.exports = {
  transformForLLM,
  buildCurrentWorkout,
  patchExerciseLibrary,
};
