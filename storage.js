(function () {
    const BACKUP_SUFFIX = '__backup__';

    function createArrayFallback(value) {
        return Array.isArray(value) ? [...value] : [];
    }

    function createObjectFallback(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return { ...value };
        }
        return null;
    }

    function normaliseFallback(factoryOrValue) {
        return typeof factoryOrValue === 'function' ? factoryOrValue() : factoryOrValue;
    }

    function cloneFallback(factoryOrValue, kind) {
        const fallback = normaliseFallback(factoryOrValue);
        if (kind === 'array') return createArrayFallback(fallback);
        if (kind === 'object-or-null') return createObjectFallback(fallback);
        return fallback;
    }

    function serialiseForBackup(value) {
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch (error) {
            try {
                return String(value);
            } catch (_) {
                return '[unserialisable value]';
            }
        }
    }

    function backupKey(key) {
        return `${key}${BACKUP_SUFFIX}${Date.now()}`;
    }

    function preserveCorruptValue(key, rawValue, reason) {
        if (rawValue === null || rawValue === undefined) return;

        const payload = {
            key,
            reason,
            capturedAt: new Date().toISOString(),
            rawValue: serialiseForBackup(rawValue)
        };

        try {
            localStorage.setItem(backupKey(key), JSON.stringify(payload));
        } catch (error) {
            console.warn(`Failed to back up corrupt storage value for ${key}:`, error);
        }
    }

    function validateValue(value, kind) {
        if (kind === 'array') return Array.isArray(value);
        if (kind === 'object-or-null') return value === null || (typeof value === 'object' && !Array.isArray(value));
        return true;
    }

    function recoverValue(key, fallbackValue) {
        try {
            if (fallbackValue === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(fallbackValue));
            }
        } catch (error) {
            console.warn(`Failed to recover storage key ${key}:`, error);
        }
        return fallbackValue;
    }

    function loadJson(key, { fallback, kind }) {
        const fallbackValue = cloneFallback(fallback, kind);
        const rawValue = localStorage.getItem(key);

        if (rawValue === null) {
            return fallbackValue;
        }

        try {
            const parsed = JSON.parse(rawValue);
            if (!validateValue(parsed, kind)) {
                preserveCorruptValue(key, rawValue, 'validation-failed');
                return recoverValue(key, fallbackValue);
            }
            return parsed;
        } catch (error) {
            preserveCorruptValue(key, rawValue, 'json-parse-failed');
            return recoverValue(key, fallbackValue);
        }
    }

    function saveJson(key, value, { fallback, kind }) {
        let nextValue = value;

        if (!validateValue(nextValue, kind)) {
            preserveCorruptValue(key, nextValue, 'invalid-save-value');
            nextValue = cloneFallback(fallback, kind);
        }

        try {
            if (nextValue === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(nextValue));
            }
            return nextValue;
        } catch (error) {
            console.error(`Failed to save storage key ${key}:`, error);
            return null;
        }
    }

    function clearKey(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Failed to clear storage key ${key}:`, error);
            return false;
        }
    }

    window.MyGymStorage = {
        loadCurrentWorkout(fallback = null) {
            return loadJson('currentWorkout', { fallback, kind: 'object-or-null' });
        },
        saveCurrentWorkout(value, fallback = null) {
            return saveJson('currentWorkout', value, { fallback, kind: 'object-or-null' });
        },
        clearCurrentWorkout() {
            return clearKey('currentWorkout');
        },
        loadWorkoutHistory(fallback = []) {
            return loadJson('workoutHistory', { fallback, kind: 'array' });
        },
        saveWorkoutHistory(value, fallback = []) {
            return saveJson('workoutHistory', value, { fallback, kind: 'array' });
        },
        clearWorkoutHistory() {
            return clearKey('workoutHistory');
        },
        loadExerciseLibrary(fallback = []) {
            return loadJson('exerciseLibrary', { fallback, kind: 'array' });
        },
        saveExerciseLibrary(value, fallback = []) {
            return saveJson('exerciseLibrary', value, { fallback, kind: 'array' });
        },
        clearExerciseLibrary() {
            return clearKey('exerciseLibrary');
        },
        loadCategoryConfig(fallback = []) {
            return loadJson('categoryConfig', { fallback, kind: 'array' });
        },
        saveCategoryConfig(value, fallback = []) {
            return saveJson('categoryConfig', value, { fallback, kind: 'array' });
        },
        clearCategoryConfig() {
            return clearKey('categoryConfig');
        }
    };
})();
