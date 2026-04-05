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

    function resolveExerciseCategory(exerciseRecord, library, fallback = 'Uncategorized') {
        if (!exerciseRecord) return fallback;

        const byId = findLibraryExerciseById(library, exerciseRecord.exerciseLibraryId);
        if (byId?.category) return byId.category;

        if (exerciseRecord.category) return exerciseRecord.category;

        const byName = findLibraryExerciseByName(library, exerciseRecord.name);
        if (byName?.category) return byName.category;

        return fallback;
    }

    function resolveExerciseDisplayName(exerciseRecord, library, fallback = 'Exercise') {
        if (!exerciseRecord) return fallback;

        const byId = findLibraryExerciseById(library, exerciseRecord.exerciseLibraryId);
        if (byId?.name) return byId.name;

        if (exerciseRecord.name) return exerciseRecord.name;

        const byName = findLibraryExerciseByName(library, exerciseRecord.name);
        if (byName?.name) return byName.name;

        return fallback;
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

    function buildLibraryNameIndex(library) {
        const nameIndex = new Map();

        (library || []).forEach(exercise => {
            const key = normalizeExerciseName(exercise?.name);
            if (!key) return;

            const existing = nameIndex.get(key);
            if (!existing) {
                nameIndex.set(key, exercise);
                return;
            }

            if (Array.isArray(existing)) {
                existing.push(exercise);
                return;
            }

            nameIndex.set(key, [existing, exercise]);
        });

        return nameIndex;
    }

    function findConfidentLibraryMatch(exerciseRecord, library, libraryNameIndex = buildLibraryNameIndex(library)) {
        if (!exerciseRecord) return { match: null, matchType: null };

        const byId = findLibraryExerciseById(library, exerciseRecord.exerciseLibraryId);
        if (byId) {
            return { match: byId, matchType: 'id' };
        }

        const normalizedName = normalizeExerciseName(exerciseRecord.name);
        if (!normalizedName) return { match: null, matchType: null };

        const byName = libraryNameIndex.get(normalizedName);
        if (!byName || Array.isArray(byName)) {
            return { match: null, matchType: null };
        }

        return { match: byName, matchType: 'name' };
    }

    function needsExerciseSnapshotUpdate(exerciseRecord, libraryExercise) {
        if (!exerciseRecord || !libraryExercise) return false;

        const currentId = exerciseRecord.exerciseLibraryId ?? null;
        const nextId = libraryExercise.id;
        const currentName = exerciseRecord.name || '';
        const nextName = libraryExercise.name || '';
        const currentCategory = exerciseRecord.category || '';
        const nextCategory = libraryExercise.category || '';

        return String(currentId) !== String(nextId)
            || currentName !== nextName
            || currentCategory !== nextCategory;
    }

    function updateExerciseSnapshot(exerciseRecord, libraryExercise) {
        if (!needsExerciseSnapshotUpdate(exerciseRecord, libraryExercise)) {
            return exerciseRecord;
        }

        return {
            ...exerciseRecord,
            exerciseLibraryId: libraryExercise.id,
            name: libraryExercise.name,
            category: libraryExercise.category || ''
        };
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
            return updateExerciseSnapshot(exercise, target);
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

    function reconcileWorkoutExerciseRecord(exerciseRecord, library, libraryNameIndex) {
        const { match, matchType } = findConfidentLibraryMatch(exerciseRecord, library, libraryNameIndex);
        if (!match) {
            return {
                exercise: exerciseRecord,
                changed: false,
                matched: false,
                matchType: null
            };
        }

        const nextExercise = updateExerciseSnapshot(exerciseRecord, match);
        return {
            exercise: nextExercise,
            changed: nextExercise !== exerciseRecord,
            matched: true,
            matchType
        };
    }

    function reconcileStoredExerciseHistory(options = {}) {
        const {
            includeCurrentWorkout = true
        } = options;

        const library = window.MyGymStorage.loadExerciseLibrary([]);
        const libraryNameIndex = buildLibraryNameIndex(library);
        const workoutHistory = window.MyGymStorage.loadWorkoutHistory([]);

        const summary = {
            workoutsScanned: 0,
            workoutsUpdated: 0,
            exercisesScanned: 0,
            exercisesUpdated: 0,
            linkedById: 0,
            linkedByName: 0,
            skippedUnmatched: 0,
            currentWorkoutScanned: 0,
            currentWorkoutUpdated: 0
        };

        const nextHistory = workoutHistory.map(workout => {
            if (!Array.isArray(workout.exercises)) return workout;

            summary.workoutsScanned += 1;
            let workoutChanged = false;
            const nextExercises = workout.exercises.map(exercise => {
                summary.exercisesScanned += 1;
                const result = reconcileWorkoutExerciseRecord(exercise, library, libraryNameIndex);

                if (!result.matched) {
                    summary.skippedUnmatched += 1;
                    return exercise;
                }

                if (result.matchType === 'id') summary.linkedById += 1;
                if (result.matchType === 'name') summary.linkedByName += 1;

                if (result.changed) {
                    workoutChanged = true;
                    summary.exercisesUpdated += 1;
                }

                return result.exercise;
            });

            if (!workoutChanged) return workout;
            summary.workoutsUpdated += 1;
            return {
                ...workout,
                exercises: nextExercises
            };
        });

        window.MyGymStorage.saveWorkoutHistory(nextHistory, []);

        if (includeCurrentWorkout) {
            const currentWorkout = window.MyGymStorage.loadCurrentWorkout(null);
            if (currentWorkout && Array.isArray(currentWorkout.exercises)) {
                let workoutChanged = false;
                const nextExercises = currentWorkout.exercises.map(exercise => {
                    summary.currentWorkoutScanned += 1;
                    const result = reconcileWorkoutExerciseRecord(exercise, library, libraryNameIndex);
                    if (result.changed) {
                        workoutChanged = true;
                        summary.currentWorkoutUpdated += 1;
                    }
                    return result.exercise;
                });

                if (workoutChanged) {
                    window.MyGymStorage.saveCurrentWorkout({
                        ...currentWorkout,
                        exercises: nextExercises
                    }, null);
                }
            }
        }

        summary.totalUpdatedRecords = summary.exercisesUpdated + summary.currentWorkoutUpdated;
        return summary;
    }

    window.MyGymExerciseIdentity = {
        normalizeExerciseName,
        findLibraryExerciseById,
        findLibraryExerciseByName,
        resolveExerciseReference,
        resolveExerciseCategory,
        resolveExerciseDisplayName,
        createExerciseSnapshot,
        createWorkoutExerciseFromLibrary,
        normalizeWorkoutExercise,
        normalizeWorkout,
        normalizeWorkoutHistory,
        matchesLibraryExerciseRecord,
        matchesExerciseReference,
        buildLibraryNameIndex,
        findConfidentLibraryMatch,
        reconcileWorkoutExerciseRecord,
        reconcileStoredExerciseHistory,
        propagateExerciseLibraryChange
    };
})();
