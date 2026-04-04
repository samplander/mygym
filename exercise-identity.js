(function () {
    function normalizeExerciseName(name) {
        return String(name || '').trim().toLowerCase();
    }

    function findLibraryExerciseById(library, id) {
        if (id === undefined || id === null || id === '') return null;
        return (library || []).find(ex => String(ex.id) === String(id)) || null;
    }

    function findLibraryExerciseByName(library, name) {
        const normalizedName = normalizeExerciseName(name);
        if (!normalizedName) return null;
        return (library || []).find(ex => normalizeExerciseName(ex.name) === normalizedName) || null;
    }

    function resolveExerciseReference(exerciseRecord, library) {
        if (!exerciseRecord) return null;

        const byId = findLibraryExerciseById(library, exerciseRecord.exerciseLibraryId);
        if (byId) return byId;

        return findLibraryExerciseByName(library, exerciseRecord.name);
    }

    function createExerciseSnapshot(record, library) {
        const resolved = resolveExerciseReference(record, library);
        return {
            ...record,
            exerciseLibraryId: resolved ? resolved.id : (record.exerciseLibraryId ?? null),
            name: resolved ? resolved.name : (record.name || ''),
            category: resolved ? (resolved.category || '') : (record.category || '')
        };
    }

    function createWorkoutExerciseFromLibrary(libraryExercise, overrides = {}) {
        return {
            id: overrides.id ?? Date.now(),
            name: libraryExercise.name,
            category: libraryExercise.category || '',
            exerciseLibraryId: libraryExercise.id,
            collapsed: false,
            detailsHidden: false,
            timeMode: false,
            showPrevious: false,
            sets: [],
            ...overrides,
            name: overrides.name ?? libraryExercise.name,
            category: overrides.category ?? (libraryExercise.category || ''),
            exerciseLibraryId: overrides.exerciseLibraryId ?? libraryExercise.id
        };
    }

    function normalizeWorkoutExercise(exercise, library) {
        if (!exercise || typeof exercise !== 'object') return exercise;
        return createExerciseSnapshot(exercise, library);
    }

    function normalizeWorkout(workout, library) {
        if (!workout || !Array.isArray(workout.exercises)) return workout;
        return {
            ...workout,
            exercises: workout.exercises.map(exercise => normalizeWorkoutExercise(exercise, library))
        };
    }

    function normalizeWorkoutHistory(history, library) {
        return (history || []).map(workout => normalizeWorkout(workout, library));
    }

    function matchesLibraryExerciseRecord(exerciseRecord, libraryExercise, options = {}) {
        if (!exerciseRecord || !libraryExercise) return false;

        if (exerciseRecord.exerciseLibraryId !== undefined && exerciseRecord.exerciseLibraryId !== null && exerciseRecord.exerciseLibraryId !== '') {
            return String(exerciseRecord.exerciseLibraryId) === String(libraryExercise.id);
        }

        if (options.allowLegacyNameMatch === false) return false;
        return normalizeExerciseName(exerciseRecord.name) === normalizeExerciseName(libraryExercise.name);
    }

    function matchesExerciseReference(left, right) {
        if (!left || !right) return false;

        if (left.exerciseLibraryId != null && right.exerciseLibraryId != null) {
            return String(left.exerciseLibraryId) === String(right.exerciseLibraryId);
        }

        return normalizeExerciseName(left.name) === normalizeExerciseName(right.name);
    }

    function propagateExerciseLibraryChange({ libraryExerciseId, oldName, newName, newCategory }) {
        const library = window.MyGymStorage.loadExerciseLibrary([]);
        const target = findLibraryExerciseById(library, libraryExerciseId) || {
            id: libraryExerciseId,
            name: newName,
            category: newCategory || ''
        };
        const normalizedOldName = normalizeExerciseName(oldName);

        function shouldUpdate(exercise) {
            if (!exercise) return false;
            if (exercise.exerciseLibraryId != null && exercise.exerciseLibraryId !== '') {
                return String(exercise.exerciseLibraryId) === String(target.id);
            }
            return normalizedOldName && normalizeExerciseName(exercise.name) === normalizedOldName;
        }

        function updateExercise(exercise) {
            if (!shouldUpdate(exercise)) return exercise;
            return {
                ...exercise,
                exerciseLibraryId: target.id,
                name: target.name,
                category: target.category || ''
            };
        }

        const currentWorkout = window.MyGymStorage.loadCurrentWorkout(null);
        let currentWorkoutUpdated = 0;
        if (currentWorkout && Array.isArray(currentWorkout.exercises)) {
            const nextWorkout = {
                ...currentWorkout,
                exercises: currentWorkout.exercises.map(exercise => {
                    const nextExercise = updateExercise(exercise);
                    if (nextExercise !== exercise) currentWorkoutUpdated += 1;
                    return nextExercise;
                })
            };
            window.MyGymStorage.saveCurrentWorkout(nextWorkout, null);
        }

        const workoutHistory = window.MyGymStorage.loadWorkoutHistory([]);
        let historyExerciseUpdates = 0;
        let historyWorkoutUpdates = 0;
        const nextHistory = workoutHistory.map(workout => {
            if (!Array.isArray(workout.exercises)) return workout;
            let workoutChanged = false;
            const nextExercises = workout.exercises.map(exercise => {
                const nextExercise = updateExercise(exercise);
                if (nextExercise !== exercise) {
                    workoutChanged = true;
                    historyExerciseUpdates += 1;
                }
                return nextExercise;
            });
            if (!workoutChanged) return workout;
            historyWorkoutUpdates += 1;
            return { ...workout, exercises: nextExercises };
        });
        window.MyGymStorage.saveWorkoutHistory(nextHistory, []);

        return {
            currentWorkoutUpdated,
            historyExerciseUpdates,
            historyWorkoutUpdates
        };
    }

    window.MyGymExerciseIdentity = {
        normalizeExerciseName,
        findLibraryExerciseById,
        findLibraryExerciseByName,
        resolveExerciseReference,
        createExerciseSnapshot,
        createWorkoutExerciseFromLibrary,
        normalizeWorkoutExercise,
        normalizeWorkout,
        normalizeWorkoutHistory,
        matchesLibraryExerciseRecord,
        matchesExerciseReference,
        propagateExerciseLibraryChange
    };
})();
