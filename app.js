// State Management
let currentWorkout = null;
let timerInterval = null;

window.MyGymAppState = {
    getCurrentWorkout: () => currentWorkout,
    setCurrentWorkout: (workout) => {
        currentWorkout = workout;
        return currentWorkout;
    },
    saveCurrentWorkout: () => saveCurrentWorkout()
};

// Coach API Configuration
const COACH_API_URL = 'https://mygym-b733e99f8879.herokuapp.com';
const COACH_API_KEY = '0616851c50ff903bd26b9f57f61f100131337b7ad415f777e695a8c45e4e172f'; // Change this to match your server's API_KEY
const CLIENT_ID = localStorage.getItem('clientId') || (() => { const id = crypto.randomUUID(); localStorage.setItem('clientId', id); return id; })();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(registration => console.log('Service Worker registered:', registration.scope))
        .catch(error => console.log('Service Worker registration failed:', error));
}

// PWA Install Prompt
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallBanner();
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Check if there's an active workout
    loadCurrentWorkout();
    
    // Event listeners
    document.getElementById('coachWorkoutBtn').addEventListener('click', () => showCoachPreferencesModal());
    document.getElementById('startWorkoutBtn').addEventListener('click', startWorkout);
    document.getElementById('continueWorkoutBtn').addEventListener('click', () => {
        if (currentWorkout) {
            showWorkoutScreen();
        } else {
            alert('No active workout found. Please start a new workout.');
        }
    });
    document.getElementById('addExerciseBtn').addEventListener('click', () => showAddExerciseModal());
    document.getElementById('saveExerciseBtn').addEventListener('click', saveExercise);
    document.getElementById('completeWorkoutBtn').addEventListener('click', completeWorkout);
    document.getElementById('generateFromPreferencesBtn').addEventListener('click', generateFromPreferences);
    document.getElementById('startCoachWorkoutBtn').addEventListener('click', startCoachGeneratedWorkout);
    
    // Modal enter key support
    document.getElementById('exerciseNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveExercise();
    });
    
    // Exercise Library listeners
    const saveLibraryBtn = document.getElementById('saveExerciseLibraryBtn');
    if (saveLibraryBtn) {
        saveLibraryBtn.addEventListener('click', saveExerciseLibraryItem);
    }
    
    const libraryNameInput = document.getElementById('exerciseLibraryNameInput');
    if (libraryNameInput) {
        libraryNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveExerciseLibraryItem();
        });
    }
    
    // Initialize search
    setTimeout(() => initializeExerciseSearch(), 100);

    // Initialize PWA install prompt (delayed so it doesn't interrupt page load)
    setTimeout(() => initializeInstallPrompt(), 2500);
    
    // Initialize autocomplete
    initializeAutocomplete();
    
    // Initialize category dropdowns
    populateCategoryDropdowns();
    
    // Render quick stats
    renderQuickStats();
    
    // Show appropriate screen
    if (currentWorkout) {
        //showWorkoutScreen(); //disabled this for now to always show home screen first, can re-enable later if we want to auto-resume workout on page load
         showHomeScreen();
    } else {
        showHomeScreen();
    }
}

// Quick Stats Rendering
function renderQuickStats() { return MyGymHistoryReporting.renderQuickStats(); }

// Volume Heatmap Rendering
function generateHeatmapData() { return MyGymHistoryReporting.generateHeatmapData(); }

function getVolumeIntensity(volume, maxVolume) { return MyGymHistoryReporting.getVolumeIntensity(volume, maxVolume); }

function buildCategoryGradient(categoryBreakdown, totalVolume) { return MyGymHistoryReporting.buildCategoryGradient(categoryBreakdown, totalVolume); }

function buildCategoryTooltip(categoryBreakdown, totalVolume) { return MyGymHistoryReporting.buildCategoryTooltip(categoryBreakdown, totalVolume); }

function renderVolumeHeatmap() { return MyGymHistoryReporting.renderVolumeHeatmap(); }

// Screen Management
function showHomeScreen() {
    renderQuickStats(); // Refresh stats when returning to home
    renderVolumeHeatmap(); // Refresh heatmap
    document.getElementById('homeScreen').classList.remove('d-none');
    document.getElementById('workoutScreen').classList.add('d-none');
    document.getElementById('historyScreen').classList.add('d-none');
    document.getElementById('settingsScreen').classList.add('d-none');
}

function showWorkoutScreen() {
    document.getElementById('homeScreen').classList.add('d-none');
    document.getElementById('workoutScreen').classList.remove('d-none');
    document.getElementById('historyScreen').classList.add('d-none');
    document.getElementById('settingsScreen').classList.add('d-none');
    renderExercises();
    startTimer();
    restoreUIState();
}

function showHistoryScreen() {
    document.getElementById('homeScreen').classList.add('d-none');
    document.getElementById('workoutScreen').classList.add('d-none');
    document.getElementById('historyScreen').classList.remove('d-none');
    document.getElementById('settingsScreen').classList.add('d-none');
    renderHistory();
}

function showSettingsScreen() {
    document.getElementById('homeScreen').classList.add('d-none');
    document.getElementById('workoutScreen').classList.add('d-none');
    document.getElementById('historyScreen').classList.add('d-none');
    document.getElementById('settingsScreen').classList.remove('d-none');
    renderExerciseLibrary();
    renderCategoryList();
}

// Workout Management
function startWorkout() {
    currentWorkout = {
        id: Date.now(),
        startTime: new Date().toISOString(),
        accordionMode: true,
        exercises: []
    };
    saveCurrentWorkout();
    showWorkoutScreen();
}

// AI Coach Workout Generation
async function generateCoachWorkout(customPreferences = null) {
    // Check if there's an active workout
    if (currentWorkout !== null) {
        if (!confirm('Replace current workout with AI-generated plan?')) {
            return;
        }
    }
    
    try {
        // Show loading state
        const coachBtn = document.getElementById('coachWorkoutBtn');
        const coachBtnText = document.getElementById('coachBtnText');
        const coachBtnIcon = document.getElementById('coachBtnIcon');
        const originalText = coachBtnText.textContent;
        coachBtn.disabled = true;
        coachBtn.classList.add('glass-btn-loading');
        coachBtnText.textContent = 'Generating...';
        coachBtnIcon.className = 'bi bi-arrow-clockwise spin';
        
        // Gather localStorage data
        const workoutHistory = loadWorkoutHistory();
        const exerciseLibrary = loadExerciseLibrary();
        const categoryConfig = loadCategoryConfig();
        
        // Build preferences (use custom or defaults)
        const preferences = customPreferences || {
            mode: 'progressive_overload',
            timeAvailable: 60,
            injuries: '',
            notes: ''
        };
        
        // Call API
        await requestCoachWorkout({
            workoutHistory,
            exerciseLibrary,
            categoryConfig,
            preferences
        });
        
        // Reset button state
        coachBtn.disabled = false;
        coachBtn.classList.remove('glass-btn-loading');
        coachBtnText.textContent = originalText;
        coachBtnIcon.className = 'bi bi-robot';
        
    } catch (error) {
        // Reset button state
        const coachBtn = document.getElementById('coachWorkoutBtn');
        const coachBtnText = document.getElementById('coachBtnText');
        const coachBtnIcon = document.getElementById('coachBtnIcon');
        coachBtn.disabled = false;
        coachBtn.classList.remove('glass-btn-loading');
        coachBtnText.textContent = 'AI Coach Workout';
        coachBtnIcon.className = 'bi bi-robot';
        
        // Show error to user
        console.error('Coach API Error:', error);
        alert('Failed to generate workout: ' + error.message);
    }
}

async function requestCoachWorkout(payload) {
    try {
        const response = await fetch(`${COACH_API_URL}/api/coach`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': COACH_API_KEY,
                'X-Client-Id': CLIENT_ID
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            // Try to extract error message from response
            let errorMessage = `Server error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // Response wasn't JSON, use default message
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data.currentWorkout || !data.rationale || !data.focus) {
            throw new Error('Invalid response from Coach API');
        }
        
        // Process the response
        handleCoachResponse(data);
        
    } catch (error) {
        // Network errors or fetch failures
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to Coach API. Is the server running on port 3001?');
        }
        throw error;
    }
}

function handleCoachResponse(data) {
    const { currentWorkout: newWorkout, exerciseLibrary, rationale, focus, estimatedMinutes } = data;
    
    // Write new workout to localStorage
    currentWorkout = newWorkout;
    saveCurrentWorkout();
    
    // Update exercise library if coach added new exercises
    if (exerciseLibrary !== null && exerciseLibrary !== undefined) {
        saveExerciseLibrary(exerciseLibrary);
    }
    
    // Show rationale modal before entering workout
    showCoachRationaleModal(rationale, focus, estimatedMinutes);
}

function showCoachRationaleModal(rationale, focus, estimatedMinutes) {
    document.getElementById('rationaleFocus').textContent = focus;
    document.getElementById('rationaleDuration').textContent = `~${estimatedMinutes} min`;

    // Split into individual sentences and render each as its own paragraph
    const container = document.getElementById('rationaleText');
    container.innerHTML = '';
    const sentences = rationale.match(/[^.!?]+[.!?]+/g) || [rationale];
    sentences.map(s => s.trim()).filter(Boolean).forEach(sentence => {
        const p = document.createElement('p');
        p.className = 'mb-2';
        p.textContent = sentence;
        container.appendChild(p);
    });

    const modal = new bootstrap.Modal(document.getElementById('coachRationaleModal'));
    modal.show();
}

function showCoachPreferencesModal() {
    // Load saved preferences if they exist
    const savedPrefs = JSON.parse(localStorage.getItem('coachPreferences') || '{}');
    
    // Populate fields
    document.getElementById('coachModeSelect').value = savedPrefs.mode || 'progressive_overload';
    document.getElementById('timeAvailableInput').value = savedPrefs.timeAvailable || 60;
    document.getElementById('injuriesInput').value = savedPrefs.injuries || '';
    document.getElementById('notesInput').value = savedPrefs.notes || '';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('coachPreferencesModal'));
    modal.show();
}

function generateFromPreferences() {
    // Collect form values
    const preferences = {
        mode: document.getElementById('coachModeSelect').value,
        timeAvailable: parseInt(document.getElementById('timeAvailableInput').value) || 60,
        injuries: document.getElementById('injuriesInput').value.trim(),
        notes: document.getElementById('notesInput').value.trim()
    };
    
    // Save preferences for next time
    localStorage.setItem('coachPreferences', JSON.stringify(preferences));
    
    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('coachPreferencesModal'));
    modal.hide();
    
    // Generate workout with custom preferences
    generateCoachWorkout(preferences);
}

function startCoachGeneratedWorkout() {
    // Hide rationale modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('coachRationaleModal'));
    modal.hide();
    
    // Navigate to workout screen
    showWorkoutScreen();
}

function completeWorkout() {
    if (!currentWorkout || currentWorkout.exercises.length === 0) {
        alert('Add at least one exercise before completing the workout!');
        return;
    }
    
    if (confirm('Complete this workout?')) {
        // Calculate metadata
        currentWorkout.endTime = new Date().toISOString();
        currentWorkout.completedAt = new Date().toISOString(); // Add this line
        const startTime = new Date(currentWorkout.startTime).getTime();
        const endTime = new Date(currentWorkout.endTime).getTime();
        currentWorkout.duration = Math.floor((endTime - startTime) / 1000); // in seconds
        
        let totalSets = 0;
        currentWorkout.exercises.forEach(ex => {
            totalSets += ex.sets.length;
        });
        currentWorkout.totalSets = totalSets;
        currentWorkout.totalExercises = currentWorkout.exercises.length;
        
        // Save to history
        saveToHistory();
        
        // Clear current workout
        currentWorkout = null;
        clearCurrentWorkout();
        
        // Stop timer
        stopTimer();
        
        // Show home screen
        showHomeScreen();
        
        alert('Workout completed and saved!');
    }
}

function saveToHistory() {
    const history = loadWorkoutHistory();
    history.unshift(MyGymExerciseIdentity.normalizeWorkout(currentWorkout, loadExerciseLibrary()));
    
    // Keep only last 100 workouts to manage storage
    if (history.length > 100) {
        history.splice(100);
    }
    
    saveWorkoutHistory(history);
}

// Exercise Management
function showAddExerciseModal() {
    const modal = new bootstrap.Modal(document.getElementById('addExerciseModal'));
    document.getElementById('exerciseNameInput').value = '';
    modal.show();
    setTimeout(() => document.getElementById('exerciseNameInput').focus(), 300);
}

function saveExercise() {
    const name = document.getElementById('exerciseNameInput').value.trim();
    if (!name) {
        alert('Please enter an exercise name');
        return;
    }
    
    // Check if "Add to Library" checkbox is checked and visible
    const addToLibraryContainer = document.getElementById('addToLibraryContainer');
    const addToLibraryCheckbox = document.getElementById('addToLibraryCheckbox');
    const categorySelect = document.getElementById('quickCategorySelect');
    
    if (addToLibraryContainer.style.display !== 'none' && addToLibraryCheckbox.checked) {
        // Add the exercise to the library if it doesn't exist
        const library = loadExerciseLibrary();
        const existingExercise = MyGymExerciseIdentity.findLibraryExerciseByName(library, name);
        
        if (!existingExercise) {
            addExerciseToLibrary(name, categorySelect.value);
        }
    }
    
    const library = loadExerciseLibrary();
    const libraryExercise = MyGymExerciseIdentity.findLibraryExerciseByName(library, name);

    // Update usage stats if selecting from library
    updateExerciseUsage(name, libraryExercise?.id);

    const exercise = libraryExercise
        ? MyGymExerciseIdentity.createWorkoutExerciseFromLibrary(libraryExercise, { id: Date.now() })
        : {
            id: Date.now(),
            name: name,
            category: '',
            exerciseLibraryId: null,
            collapsed: false,
            detailsHidden: false,
            timeMode: false,
            showPrevious: false,
            sets: []
        };
    
    // In accordion mode, collapse all others and open new one
    if (currentWorkout.accordionMode) {
        currentWorkout.exercises.forEach(ex => ex.collapsed = true);
    }
    
    currentWorkout.exercises.push(exercise);
    saveCurrentWorkout();
    renderExercises();
    
    // Close modal and reset
    const modal = bootstrap.Modal.getInstance(document.getElementById('addExerciseModal'));
    modal.hide();
    
    // Reset input and hide autocomplete
    document.getElementById('exerciseNameInput').value = '';
    hideAutocomplete();
    addToLibraryContainer.style.display = 'none';
}

function deleteExercise(exerciseId) {
    if (confirm('Delete this exercise and all its sets?')) {
        currentWorkout.exercises = currentWorkout.exercises.filter(ex => ex.id !== exerciseId);
        saveCurrentWorkout();
        renderExercises();
    }
}

function moveExercise(exerciseId, direction) {
    const exercises = currentWorkout.exercises;
    const currentIndex = exercises.findIndex(ex => ex.id === exerciseId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    
    // Swap positions
    [exercises[currentIndex], exercises[newIndex]] = [exercises[newIndex], exercises[currentIndex]];
    saveCurrentWorkout();
    renderExercises();
}

// Set Management
function addSet(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    // In accordion mode, ensure this exercise is expanded and others are collapsed
    if (currentWorkout.accordionMode) {
        currentWorkout.exercises.forEach(ex => {
            ex.collapsed = ex.id !== exerciseId;
        });
    }
    
    // Get previous set values or use defaults
    const previousSet = exercise.sets[exercise.sets.length - 1];
    const defaultValues = previousSet ? { ...previousSet.actual } : { weight: 0, reps: 0, time: 0 };
    
    const newSet = {
        collapsed: false,
        completed: false,
        planned: { ...defaultValues },
        actual: { ...defaultValues }
    };
    
    exercise.sets.push(newSet);
    
    // Auto-select the newly added set
    if (exercise.selectedSetIndex === null) {
        exercise.selectedSetIndex = 0;
    }
    
    saveCurrentWorkout();
    renderExercises();
}

function deleteSet(exerciseId, setIndex) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    if (confirm('Delete this set?')) {
        exercise.sets.splice(setIndex, 1);
        
        // Adjust selected index after deletion
        if (exercise.selectedSetIndex >= exercise.sets.length) {
            exercise.selectedSetIndex = exercise.sets.length - 1;
        }
        if (exercise.sets.length === 0) {
            exercise.selectedSetIndex = null;
        }
        
        saveCurrentWorkout();
        renderExercises();
    }
}

function handleDirectInput(exerciseId, setIndex, field, value) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise || !exercise.sets[setIndex]) return;
    
    // Prevent editing locked/completed sets
    if (exercise.sets[setIndex].completed) return;
    
    let numValue = parseInt(value) || 0;
    if (numValue < 0) numValue = 0;
    
    // Update both actual and planned to keep data consistent
    exercise.sets[setIndex].actual[field] = numValue;
    exercise.sets[setIndex].planned[field] = numValue;
    saveCurrentWorkout();
}

function toggleSetCompletion(exerciseId, setIndex) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise || !exercise.sets[setIndex]) return;
    
    exercise.sets[setIndex].completed = !exercise.sets[setIndex].completed;
    saveCurrentWorkout();
    renderExercises();
}

// Collapse Management
function toggleExercise(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    const isOpening = exercise.collapsed;
    
    // If opening in accordion mode, close all others
    if (isOpening && currentWorkout.accordionMode) {
        currentWorkout.exercises.forEach(ex => {
            ex.collapsed = ex.id !== exerciseId;
        });
    } else {
        exercise.collapsed = !exercise.collapsed;
    }
    
    saveCurrentWorkout();
    renderExercises();
}

function toggleSet(exerciseId, setIndex) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise || !exercise.sets[setIndex]) return;
    
    exercise.sets[setIndex].collapsed = !exercise.sets[setIndex].collapsed;
    saveCurrentWorkout();
    renderExercises();
}

function toggleExerciseDetails(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    exercise.detailsHidden = !exercise.detailsHidden;
    saveCurrentWorkout();
    renderExercises();
}

function toggleTimeMode(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    exercise.timeMode = !exercise.timeMode;
    saveCurrentWorkout();
    renderExercises();
}

function toggleShowPrevious(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    exercise.showPrevious = !exercise.showPrevious;
    saveCurrentWorkout();
    renderExercises();
}

function toggleAllExercises() {
    if (!currentWorkout || currentWorkout.exercises.length === 0) return;
    
    // Check if any exercise is expanded
    const anyExpanded = currentWorkout.exercises.some(ex => !ex.collapsed);
    
    const btnText = document.getElementById('toggleAllText');
    const btnIcon = document.querySelector('#toggleAllBtn i');
    
    if (anyExpanded) {
        // Collapse All - re-enable accordion mode
        currentWorkout.exercises.forEach(exercise => {
            exercise.collapsed = true;
        });
        currentWorkout.accordionMode = true;
        btnText.textContent = 'Expand All';
        btnIcon.className = 'bi bi-arrows-expand';
    } else {
        // Expand All - disable accordion mode (allow multiple open)
        currentWorkout.exercises.forEach(exercise => {
            exercise.collapsed = false;
        });
        currentWorkout.accordionMode = false;
        btnText.textContent = 'Collapse All';
        btnIcon.className = 'bi bi-arrows-collapse';
    }
    
    saveCurrentWorkout();
    renderExercises();
}

// Workout UI Toggle (Header/Footer Hide/Show)
let isUIHidden = false;

function toggleWorkoutUI() {
    isUIHidden = !isUIHidden;
    
    const header = document.querySelector('#workoutScreen .sticky-header');
    const bottomNav = document.querySelector('#workoutScreen .bottom-nav');
    const content = document.querySelector('#workoutScreen .workout-content');
    const toggleBtn = document.getElementById('toggleUIBtn');
    const toggleIcon = toggleBtn.querySelector('i');
    
    if (isUIHidden) {
        // Hide header and footer
        header.classList.add('hidden');
        bottomNav.classList.add('hidden');
        content.classList.add('fullscreen');
        toggleBtn.classList.add('fullscreen');
        toggleIcon.className = 'bi bi-eye';
    } else {
        // Show header and footer
        header.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        content.classList.remove('fullscreen');
        toggleBtn.classList.remove('fullscreen');
        toggleIcon.className = 'bi bi-eye-slash';
    }
    
    // Save state to localStorage
    localStorage.setItem('workoutUIHidden', isUIHidden);
}

function restoreUIState() {
    const savedState = localStorage.getItem('workoutUIHidden');
    if (savedState === 'true' && !isUIHidden) {
        toggleWorkoutUI();
    } else if (savedState === 'false' && isUIHidden) {
        toggleWorkoutUI();
    }
}

// Rendering
function renderExercises() {
    const container = document.getElementById('exercisesList');
    
    if (!currentWorkout || currentWorkout.exercises.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-clipboard-x"></i>
                <p>No exercises yet.<br>Tap "Add Exercise" to begin!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = currentWorkout.exercises.map((exercise, index) => `
        <div class="exercise-card">
            <div class="exercise-header" onclick="event.target.closest('.exercise-header').querySelector('.delete-exercise-btn')?.contains(event.target) || event.target.closest('.exercise-header').querySelector('.toggle-time-btn')?.contains(event.target) || event.target.closest('.exercise-header').querySelector('.exercise-history-btn')?.contains(event.target) || event.target.closest('.exercise-header').querySelector('.reorder-up-btn')?.contains(event.target) || event.target.closest('.exercise-header').querySelector('.reorder-down-btn')?.contains(event.target) ? null : toggleExercise(${exercise.id})">
                <div class="exercise-header-left">
                    <i class="bi bi-chevron-down chevron ${exercise.collapsed ? 'collapsed' : ''}"></i>
                    <h6>${exercise.name}</h6>
                </div>
                <div class="exercise-header-right">
                    <button class="reorder-btn reorder-up-btn" onclick="event.stopPropagation(); moveExercise(${exercise.id}, 'up')" title="Move up" ${index === 0 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-up"></i>
                    </button>
                    <button class="reorder-btn reorder-down-btn" onclick="event.stopPropagation(); moveExercise(${exercise.id}, 'down')" title="Move down" ${index === currentWorkout.exercises.length - 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-down"></i>
                    </button>
                    <button class="toggle-time-btn" onclick="event.stopPropagation(); toggleTimeMode(${exercise.id})" title="${exercise.timeMode ? 'Switch to Reps' : 'Switch to Time'}">
                        <i class="bi bi-${exercise.timeMode ? '123' : 'stopwatch'}"></i>
                    </button>
                    <button class="exercise-history-btn" onclick="event.stopPropagation(); showCurrentWorkoutExerciseHistory(${exercise.id})" title="View exercise history">
                        <i class="bi bi-graph-up"></i>
                    </button>
                    <button class="delete-exercise-btn" onclick="event.stopPropagation(); deleteExercise(${exercise.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="exercise-body ${exercise.collapsed ? 'collapsed' : ''}">
                ${renderSet(exercise.id, exercise)}
                <div class="d-flex gap-2 mt-2">
                    <button class="add-set-btn" onclick="addSet(${exercise.id})">
                        <i class="bi bi-plus-lg"></i> Add Set
                    </button>
                    <button class="swap-exercise-btn" onclick="swapExercise(${exercise.id})">
                        <i class="bi bi-arrow-left-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}


function swapExercise(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const library = loadExerciseLibrary();
    const category = MyGymExerciseIdentity.resolveExerciseCategory(exercise, library, '');

    // Filter library for exercises in the same category (or all if no category)
    const candidates = category
        ? library.filter(ex => ex.category === category && !MyGymExerciseIdentity.matchesLibraryExerciseRecord(exercise, ex, { allowLegacyNameMatch: true }))
        : library.filter(ex => !MyGymExerciseIdentity.matchesLibraryExerciseRecord(exercise, ex, { allowLegacyNameMatch: true }));
    if (candidates.length === 0) {
        alert('No alternative exercises available in the library to swap with!');
        return;
    }

    // Show swap exercise modal
    const swapExerciseModal = new bootstrap.Modal(document.getElementById('swapExerciseModal'));
    swapExerciseModal.show();
    renderSwapOptions(exerciseId);
}

function renderSwapOptions(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const library = loadExerciseLibrary();
    const category = MyGymExerciseIdentity.resolveExerciseCategory(exercise, library, '');
    const candidates = category
        ? library.filter(ex => ex.category === category && !MyGymExerciseIdentity.matchesLibraryExerciseRecord(exercise, ex, { allowLegacyNameMatch: true }))
        : library.filter(ex => !MyGymExerciseIdentity.matchesLibraryExerciseRecord(exercise, ex, { allowLegacyNameMatch: true }));

    const container = document.getElementById('swapOptionsContainer');
    container.innerHTML = candidates.map(candidate => `
        <div class="swap-option" onclick="performSwap(${exerciseId}, ${candidate.id})">
            <h6>${candidate.name}</h6>
        </div>
    `).join('');
}

function performSwap(exerciseId, libraryExerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    const libraryExercise = MyGymExerciseIdentity.findLibraryExerciseById(loadExerciseLibrary(), libraryExerciseId);
    if (!libraryExercise) return;
    exercise.name = libraryExercise.name;
    exercise.category = libraryExercise.category || '';
    exercise.exerciseLibraryId = libraryExercise.id;
    saveCurrentWorkout();
    renderExercises();
    const swapExerciseModal = bootstrap.Modal.getInstance(document.getElementById('swapExerciseModal'));
    swapExerciseModal.hide();
}


function renderSet(exerciseId, exercise) {
    if (!exercise.sets || exercise.sets.length === 0) {
        return '';
    }

    const isTimeMode = exercise.timeMode || false;

    return exercise.sets.map((set, index) => {
        // Get previous set for reference
        const previousSet = index > 0 ? exercise.sets[index - 1] : null;
        let previousText = '---';
        if (previousSet) {
            if (isTimeMode) {
                previousText = `${previousSet.actual.time || 0}s`;
            } else {
                const prevWeight = previousSet.actual.weight || 0;
                const prevReps = previousSet.actual.reps || 0;
                previousText = `${prevWeight}kg × ${prevReps}`;
            }
        }

        return `
            <div class="set-row ${exercise.detailsHidden ? 'hidden' : ''} ${set.completed ? 'set-completed' : ''}">
                <div class="set-number-badge">#${index + 1}</div>
                ${exercise.showPrevious ? `<div class="set-previous">${previousText}</div>` : ''}
                
                <!-- Completion Toggle Button (Left side for easy thumb reach) -->
                <button class="set-complete-btn ${set.completed ? 'completed' : ''}" 
                        onclick="toggleSetCompletion(${exerciseId}, ${index})"
                        title="${set.completed ? 'Mark incomplete' : 'Mark complete'}">
                    <i class="bi bi-${set.completed ? 'check-circle-fill' : 'circle'}"></i>
                </button>
                
                ${isTimeMode ? `
                    <!-- Time Mode -->
                    <div class="set-input-group">
                        <input type="number" 
                               class="set-input" 
                               value="${set.actual.time}"
                               placeholder="0"
                               ${set.completed ? 'disabled' : ''}
                               onchange="handleDirectInput(${exerciseId}, ${index}, 'time', this.value)"
                               inputmode="numeric">
                        <span class="set-input-unit">s</span>
                    </div>
                ` : `
                    <!-- Weight/Reps Mode -->
                    <div class="set-input-group">
                        <input type="number" 
                               class="set-input" 
                               value="${set.actual.weight}"
                               placeholder="0"
                               ${set.completed ? 'disabled' : ''}
                               onchange="handleDirectInput(${exerciseId}, ${index}, 'weight', this.value)"
                               inputmode="numeric">
                        <span class="set-input-unit">kg</span>
                        <span class="set-input-separator">×</span>
                        <input type="number" 
                               class="set-input set-input-reps" 
                               value="${set.actual.reps}"
                               placeholder="0"
                               ${set.completed ? 'disabled' : ''}
                               onchange="handleDirectInput(${exerciseId}, ${index}, 'reps', this.value)"
                               inputmode="numeric">
                    </div>
                `}
                
                <button class="set-delete-btn" onclick="deleteSet(${exerciseId}, ${index})" title="Delete set">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

// Timer
function startTimer() {
    if (timerInterval) return;
    
    const startTime = new Date(currentWorkout.startTime).getTime();
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const display = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        document.getElementById('workoutTimer').textContent = display;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    currentWorkout.startTime = new Date().toISOString();
    saveCurrentWorkout();
    stopTimer();
    startTimer();
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// LocalStorage
function saveCurrentWorkout() {
    const library = loadExerciseLibrary();
    currentWorkout = MyGymExerciseIdentity.normalizeWorkout(currentWorkout, library);
    MyGymStorage.saveCurrentWorkout(currentWorkout);
}

function clearCurrentWorkout() {
    MyGymStorage.clearCurrentWorkout();
}

function loadCurrentWorkout() {
    currentWorkout = MyGymStorage.loadCurrentWorkout();
    if (currentWorkout && currentWorkout.accordionMode === undefined) {
        // Default to accordion mode if property doesn't exist (backwards compatibility)
        currentWorkout.accordionMode = true;
    }
    if (currentWorkout) {
        currentWorkout = MyGymExerciseIdentity.normalizeWorkout(currentWorkout, loadExerciseLibrary());
    }
}

function loadWorkoutHistory() {
    return MyGymExerciseIdentity.normalizeWorkoutHistory(MyGymStorage.loadWorkoutHistory([]), loadExerciseLibrary());
}

function saveWorkoutHistory(history) {
    return MyGymStorage.saveWorkoutHistory(MyGymExerciseIdentity.normalizeWorkoutHistory(history, loadExerciseLibrary()), []);
}

function clearWorkoutHistory() {
    return MyGymStorage.clearWorkoutHistory();
}

// History Management
function renderHistory() { return MyGymHistoryReporting.renderHistory(); }

function formatDuration(seconds) { return MyGymHistoryReporting.formatDuration(seconds); }

function viewWorkoutDetail(workoutId) { return MyGymHistoryReporting.viewWorkoutDetail(workoutId); }

function calculateWorkoutStats(workout) { return MyGymHistoryReporting.calculateWorkoutStats(workout); }

function calculateExerciseStats(exercise) { return MyGymHistoryReporting.calculateExerciseStats(exercise); }

// Exercise History Functions
function getExerciseHistory(exerciseName) { return MyGymHistoryReporting.getExerciseHistory(exerciseName); }

function showExerciseHistory(exerciseName) { return MyGymHistoryReporting.showExerciseHistory(exerciseName); }

function showCurrentWorkoutExerciseHistory(exerciseId) { return MyGymHistoryReporting.showCurrentWorkoutExerciseHistory(exerciseId); }

function getSetStatus(set) { return MyGymHistoryReporting.getSetStatus(set); }

function getPerformanceBadgeClass(rate) { return MyGymHistoryReporting.getPerformanceBadgeClass(rate); }

function toggleDetailExercise(exerciseId) { return MyGymHistoryReporting.toggleDetailExercise(exerciseId); }

function deleteWorkout(workoutId) { return MyGymHistoryReporting.deleteWorkout(workoutId); }

function clearAllHistory() { return MyGymHistoryReporting.clearAllHistory(); }

function useAsTemplate(workoutId) { return MyGymHistoryReporting.useAsTemplate(workoutId); }

// ===== EXERCISE LIBRARY MANAGEMENT =====

function loadExerciseLibrary() {
    return MyGymExerciseLibrary.loadExerciseLibrary();
}

function saveExerciseLibrary(library) {
    return MyGymExerciseLibrary.saveExerciseLibrary(library);
}

function getDefaultExercises() {
    return MyGymExerciseLibrary.getDefaultExercises();
}

function renderExerciseLibrary(searchQuery = '') {
    return MyGymExerciseLibrary.renderExerciseLibrary(searchQuery);
}

function showAddExerciseLibraryModal() {
    return MyGymExerciseLibrary.showAddExerciseLibraryModal();
}

function editExerciseLibrary(exerciseId) {
    return MyGymExerciseLibrary.editExerciseLibrary(exerciseId);
}

function saveExerciseLibraryItem() {
    const result = MyGymExerciseLibrary.saveExerciseLibraryItem();

    loadCurrentWorkout();
    if (currentWorkout) {
        currentWorkout = MyGymExerciseIdentity.normalizeWorkout(currentWorkout, loadExerciseLibrary());
    }

    if (!document.getElementById('workoutScreen').classList.contains('d-none')) {
        renderExercises();
    }

    return result;
}

// ============================================
// AUTOCOMPLETE FUNCTIONALITY
// ============================================

function initializeAutocomplete() {
    return MyGymExerciseLibrary.initializeAutocomplete();
}

function showAutocompleteSuggestions(searchText) {
    return MyGymExerciseLibrary.showAutocompleteSuggestions(searchText);
}

function updateAutocompleteSelection(items) {
    return MyGymExerciseLibrary.updateAutocompleteSelection(items);
}

function selectSuggestion(name) {
    return MyGymExerciseLibrary.selectSuggestion(name);
}

function hideAutocomplete() {
    return MyGymExerciseLibrary.hideAutocomplete();
}

function highlightMatch(text, search) {
    return MyGymExerciseLibrary.highlightMatch(text, search);
}

function formatLastUsed(lastUsedDate) {
    return MyGymExerciseLibrary.formatLastUsed(lastUsedDate);
}

function updateExerciseUsage(exerciseName, exerciseLibraryId = null) {
    return MyGymExerciseLibrary.updateExerciseUsage(exerciseName, exerciseLibraryId);
}

function addExerciseToLibrary(name, category = '') {
    return MyGymExerciseLibrary.addExerciseToLibrary(name, category);
}

function deleteExerciseLibrary(exerciseId) {
    return MyGymExerciseLibrary.deleteExerciseLibrary(exerciseId);
}

function initializeExerciseSearch() {
    return MyGymExerciseLibrary.initializeExerciseSearch();
}

// ===== DATA MANAGEMENT =====


let dataBrowserState = {
    type: null,           // 'history', 'exercises', 'current'
    workoutId: null,      // selected workout ID
    exerciseIndex: null,  // selected exercise index
    breadcrumb: []        // navigation path
};

let dataBrowserModal = null;
let recordEditorModal = null;

function getDataBrowserModal() {
    if (!dataBrowserModal) {
        dataBrowserModal = new bootstrap.Modal(document.getElementById('dataBrowserModal'));
    }
    return dataBrowserModal;
}

function getRecordEditorModal() {
    if (!recordEditorModal) {
        recordEditorModal = new bootstrap.Modal(document.getElementById('recordEditorModal'));
    }
    return recordEditorModal;
}

function showDataBrowser(type) {
    dataBrowserState = { type, workoutId: null, exerciseIndex: null, breadcrumb: [] };
    
    const titles = {
        'history': 'Workout History',
        'exercises': 'Exercise Library', 
        'current': 'Current Workout'
    };
    
    document.getElementById('dataBrowserTitle').textContent = titles[type] || 'Data Browser';
    document.getElementById('dataBrowserBackBtn').classList.add('d-none');
    document.getElementById('dataBrowserBreadcrumb').classList.add('d-none');
    
    renderDataBrowserContent();
    getDataBrowserModal().show();
}

function renderDataBrowserContent() {
    const content = document.getElementById('dataBrowserContent');
    const { type, workoutId, exerciseIndex } = dataBrowserState;
    
    if (type === 'history') {
        if (workoutId !== null && exerciseIndex !== null) {
            renderSetsList(content);
        } else if (workoutId !== null) {
            renderExercisesList(content);
        } else {
            renderHistoryList(content);
        }
    } else if (type === 'exercises') {
        renderExerciseLibraryBrowser(content);
    } else if (type === 'current') {
        renderCurrentWorkoutBrowser(content);
    }
    
    updateBreadcrumb();
}

function renderHistoryList(container) {
    const history = loadWorkoutHistory();
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="data-browser-empty">
                <i class="bi bi-inbox"></i>
                <p>No workout history</p>
            </div>`;
        return;
    }
    
    container.innerHTML = history.map((w, idx) => {
        const date = new Date(w.startTime).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric' 
        });
        const exerciseCount = w.exercises?.length || 0;
        const duration = w.duration ? Math.round(w.duration / 60) + ' min' : 'N/A';
        const hasValidId = w.id != null;
        
        return `
            <div class="data-browser-item" onclick="${hasValidId ? `selectWorkoutToEdit(${w.id})` : ''}">
                <div class="data-browser-item-info">
                    <div class="data-browser-item-title">${date}</div>
                    <div class="data-browser-item-subtitle">${exerciseCount} exercises • ${duration}${!hasValidId ? ' • <span class="text-warning">missing ID</span>' : ''}</div>
                </div>
                <div class="data-browser-item-actions">
                    ${hasValidId
                        ? `<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteHistoryItem(${w.id})"><i class="bi bi-trash"></i></button>`
                        : `<button class="btn btn-sm btn-outline-danger" disabled title="Cannot delete: workout has no ID"><i class="bi bi-trash"></i></button>`
                    }
                    <i class="bi bi-chevron-right"></i>
                </div>
            </div>`;
    }).join('');
}

function selectWorkoutToEdit(workoutId) {
    dataBrowserState.workoutId = workoutId;
    dataBrowserState.breadcrumb.push('Workout');
    document.getElementById('dataBrowserBackBtn').classList.remove('d-none');
    renderDataBrowserContent();
}

function renderExercisesList(container) {
    const history = loadWorkoutHistory();
    const workout = history.find(w => w.id === dataBrowserState.workoutId);
    
    if (!workout || !workout.exercises?.length) {
        container.innerHTML = `
            <div class="data-browser-empty">
                <i class="bi bi-inbox"></i>
                <p>No exercises in this workout</p>
            </div>`;
        return;
    }
    
    container.innerHTML = workout.exercises.map((ex, idx) => {
        const setCount = ex.sets?.length || 0;
        return `
            <div class="data-browser-item" onclick="selectExerciseToEdit(${idx})">
                <div class="data-browser-item-info">
                    <div class="data-browser-item-title">${ex.name}</div>
                    <div class="data-browser-item-subtitle">${setCount} sets</div>
                </div>
                <div class="data-browser-item-actions">
                    <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteHistoryExercise(${idx})">
                        <i class="bi bi-trash"></i>
                    </button>
                    <i class="bi bi-chevron-right"></i>
                </div>
            </div>`;
    }).join('');
}

function selectExerciseToEdit(exerciseIndex) {
    dataBrowserState.exerciseIndex = exerciseIndex;
    dataBrowserState.breadcrumb.push('Exercise');
    renderDataBrowserContent();
}

function renderSetsList(container) {
    const history = loadWorkoutHistory();
    const workout = history.find(w => w.id === dataBrowserState.workoutId);
    const exercise = workout?.exercises?.[dataBrowserState.exerciseIndex];
    
    if (!exercise || !exercise.sets?.length) {
        container.innerHTML = `
            <div class="data-browser-empty">
                <i class="bi bi-inbox"></i>
                <p>No sets in this exercise</p>
            </div>`;
        return;
    }
    
    document.getElementById('dataBrowserTitle').textContent = exercise.name;
    
    container.innerHTML = exercise.sets.map((set, idx) => {
        const actual = set.actual || {};
        const display = exercise.timeMode 
            ? `${actual.weight || 0}kg × ${actual.time || 0}s`
            : `${actual.weight || 0}kg × ${actual.reps || 0}`;
        const completed = set.completed ? '✓' : '';
        
        return `
            <div class="data-browser-item" onclick="openSetEditor(${idx})">
                <div class="data-browser-item-info">
                    <div class="data-browser-item-title">Set ${idx + 1} ${completed}</div>
                    <div class="data-browser-item-subtitle">${display}</div>
                </div>
                <i class="bi bi-pencil"></i>
            </div>`;
    }).join('');
}

function openSetEditor(setIndex) {
    const history = loadWorkoutHistory();
    const workout = history.find(w => w.id === dataBrowserState.workoutId);
    const exercise = workout?.exercises?.[dataBrowserState.exerciseIndex];
    const set = exercise?.sets?.[setIndex];
    
    if (!set) return;
    
    const planned = set.planned || {};
    const actual = set.actual || {};
    const isTimeMode = exercise.timeMode;
    
    document.getElementById('recordEditorTitle').textContent = `Edit Set ${setIndex + 1}`;
    document.getElementById('recordEditorBody').innerHTML = `
        <input type="hidden" id="editSetIndex" value="${setIndex}">
        
        <div class="field-editor-group">
            <h6><i class="bi bi-bullseye"></i> Planned</h6>
            <div class="field-row">
                <div class="field-input">
                    <label>Weight (kg)</label>
                    <input type="number" id="editPlannedWeight" value="${planned.weight || 0}" inputmode="decimal">
                </div>
                <div class="field-input">
                    <label>${isTimeMode ? 'Time (sec)' : 'Reps'}</label>
                    <input type="number" id="editPlannedReps" value="${isTimeMode ? (planned.time || 0) : (planned.reps || 0)}" inputmode="numeric">
                </div>
            </div>
        </div>
        
        <div class="field-editor-group">
            <h6><i class="bi bi-check2-circle"></i> Actual</h6>
            <div class="field-row">
                <div class="field-input">
                    <label>Weight (kg)</label>
                    <input type="number" id="editActualWeight" value="${actual.weight || 0}" inputmode="decimal">
                </div>
                <div class="field-input">
                    <label>${isTimeMode ? 'Time (sec)' : 'Reps'}</label>
                    <input type="number" id="editActualReps" value="${isTimeMode ? (actual.time || 0) : (actual.reps || 0)}" inputmode="numeric">
                </div>
            </div>
        </div>
        
        <div class="field-editor-group">
            <div class="completed-toggle">
                <input type="checkbox" id="editSetCompleted" ${set.completed ? 'checked' : ''}>
                <label for="editSetCompleted">Mark as completed</label>
            </div>
        </div>
        
        <div class="field-editor-group mt-3">
            <button class="btn btn-outline-danger w-100" onclick="deleteHistorySet(${setIndex})">
                <i class="bi bi-trash"></i> Delete Set
            </button>
        </div>
    `;
    
    getRecordEditorModal().show();
}

function saveRecordChanges() {
    const setIndex = parseInt(document.getElementById('editSetIndex').value);
    
    let history = loadWorkoutHistory();
    const workoutIdx = history.findIndex(w => w.id === dataBrowserState.workoutId);
    
    if (workoutIdx === -1) return;
    
    const exercise = history[workoutIdx].exercises[dataBrowserState.exerciseIndex];
    const set = exercise.sets[setIndex];
    const isTimeMode = exercise.timeMode;
    
    set.planned = set.planned || {};
    set.actual = set.actual || {};
    
    set.planned.weight = parseFloat(document.getElementById('editPlannedWeight').value) || 0;
    set.actual.weight = parseFloat(document.getElementById('editActualWeight').value) || 0;
    
    if (isTimeMode) {
        set.planned.time = parseInt(document.getElementById('editPlannedReps').value) || 0;
        set.actual.time = parseInt(document.getElementById('editActualReps').value) || 0;
    } else {
        set.planned.reps = parseInt(document.getElementById('editPlannedReps').value) || 0;
        set.actual.reps = parseInt(document.getElementById('editActualReps').value) || 0;
    }
    
    set.completed = document.getElementById('editSetCompleted').checked;
    
    saveWorkoutHistory(history);
    
    getRecordEditorModal().hide();
    renderDataBrowserContent();
}

function dataBrowserBack() {
    if (dataBrowserState.exerciseIndex !== null) {
        dataBrowserState.exerciseIndex = null;
        dataBrowserState.breadcrumb.pop();
    } else if (dataBrowserState.workoutId !== null) {
        dataBrowserState.workoutId = null;
        dataBrowserState.breadcrumb.pop();
        document.getElementById('dataBrowserBackBtn').classList.add('d-none');
        
        const titles = { 'history': 'Workout History', 'exercises': 'Exercise Library', 'current': 'Current Workout' };
        document.getElementById('dataBrowserTitle').textContent = titles[dataBrowserState.type];
    }
    renderDataBrowserContent();
}

function updateBreadcrumb() {
    const el = document.getElementById('dataBrowserBreadcrumb');
    if (dataBrowserState.breadcrumb.length > 0) {
        el.classList.remove('d-none');
        el.innerHTML = dataBrowserState.breadcrumb.map(b => `<span>${b}</span>`).join(' › ');
    } else {
        el.classList.add('d-none');
    }
}

function renderExerciseLibraryBrowser(container) {
    const library = loadExerciseLibrary();
    
    if (library.length === 0) {
        container.innerHTML = `
            <div class="data-browser-empty">
                <i class="bi bi-bookmark"></i>
                <p>No exercises in library</p>
            </div>`;
        return;
    }
    
    container.innerHTML = library.map(ex => {
        const lastUsed = ex.lastUsed ? new Date(ex.lastUsed).toLocaleDateString() : 'Never';
        return `
            <div class="data-browser-item" onclick="openExerciseLibraryEditor(${ex.id})">
                <div class="data-browser-item-info">
                    <div class="data-browser-item-title">${ex.name}</div>
                    <div class="data-browser-item-subtitle">${ex.category || 'No category'} • Used ${ex.usageCount || 0}× • Last: ${lastUsed}</div>
                </div>
                <i class="bi bi-pencil"></i>
            </div>`;
    }).join('');
}

function openExerciseLibraryEditor(exerciseId) {
    const library = loadExerciseLibrary();
    const exercise = library.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    document.getElementById('recordEditorTitle').textContent = 'Edit Exercise';
    document.getElementById('recordEditorBody').innerHTML = `
        <input type="hidden" id="editExerciseId" value="${exerciseId}">
        
        <div class="field-editor-group">
            <h6><i class="bi bi-tag"></i> Details</h6>
            <div class="field-input mb-3">
                <label>Name</label>
                <input type="text" id="editExerciseName" value="${exercise.name}" class="form-control">
            </div>
            <div class="field-input mb-3">
                <label>Category</label>
                <select id="editExerciseCategory" class="form-select">
                    ${getCategoryOptionsHtml(exercise.category)}
                </select>
            </div>
        </div>
        
        <div class="field-editor-group">
            <h6><i class="bi bi-graph-up"></i> Stats</h6>
            <div class="field-row">
                <div class="field-input">
                    <label>Usage Count</label>
                    <input type="number" id="editExerciseUsage" value="${exercise.usageCount || 0}" inputmode="numeric">
                </div>
            </div>
        </div>
    `;
    
    // Override save button for exercise editing
    document.getElementById('saveRecordBtn').onclick = saveExerciseLibraryChanges;
    getRecordEditorModal().show();
}

function saveExerciseLibraryChanges() {
    const exerciseId = parseInt(document.getElementById('editExerciseId').value);
    let library = loadExerciseLibrary();
    const idx = library.findIndex(ex => ex.id === exerciseId);
    
    if (idx === -1) return;
    
    library[idx].name = document.getElementById('editExerciseName').value.trim();
    library[idx].category = document.getElementById('editExerciseCategory').value;
    library[idx].usageCount = parseInt(document.getElementById('editExerciseUsage').value) || 0;
    
    saveExerciseLibrary(library);
    
    // Reset save button to default
    document.getElementById('saveRecordBtn').onclick = saveRecordChanges;
    
    getRecordEditorModal().hide();
    renderDataBrowserContent();
}

function renderCurrentWorkoutBrowser(container) {
    if (!currentWorkout) {
        container.innerHTML = `
            <div class="data-browser-empty">
                <i class="bi bi-lightning"></i>
                <p>No active workout</p>
            </div>`;
        return;
    }
    
    container.innerHTML = currentWorkout.exercises.map((ex, idx) => {
        const setCount = ex.sets?.length || 0;
        return `
            <div class="data-browser-item" onclick="openCurrentWorkoutExerciseEditor(${idx})">
                <div class="data-browser-item-info">
                    <div class="data-browser-item-title">${ex.name}</div>
                    <div class="data-browser-item-subtitle">${setCount} sets</div>
                </div>
                <i class="bi bi-pencil"></i>
            </div>`;
    }).join('');
}

function openCurrentWorkoutExerciseEditor(exerciseIndex) {
    const exercise = currentWorkout.exercises[exerciseIndex];
    if (!exercise) return;
    
    document.getElementById('recordEditorTitle').textContent = exercise.name;
    
    let setsHtml = exercise.sets.map((set, idx) => {
        const planned = set.planned || {};
        const actual = set.actual || {};
        const isTimeMode = exercise.timeMode;
        
        return `
            <div class="set-edit-card ${set.completed ? 'completed' : ''}">
                <div class="set-edit-header">
                    <h6>Set ${idx + 1}</h6>
                    <div class="completed-toggle">
                        <input type="checkbox" id="currentSetCompleted${idx}" ${set.completed ? 'checked' : ''}>
                        <label for="currentSetCompleted${idx}">Done</label>
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-input">
                        <label>Weight</label>
                        <input type="number" id="currentActualWeight${idx}" value="${actual.weight || 0}" inputmode="decimal">
                    </div>
                    <div class="field-input">
                        <label>${isTimeMode ? 'Time' : 'Reps'}</label>
                        <input type="number" id="currentActualReps${idx}" value="${isTimeMode ? (actual.time || 0) : (actual.reps || 0)}" inputmode="numeric">
                    </div>
                </div>
            </div>`;
    }).join('');
    
    document.getElementById('recordEditorBody').innerHTML = `
        <input type="hidden" id="currentEditExerciseIndex" value="${exerciseIndex}">
        ${setsHtml}
    `;
    
    document.getElementById('saveRecordBtn').onclick = saveCurrentWorkoutChanges;
    getRecordEditorModal().show();
}

function saveCurrentWorkoutChanges() {
    const exerciseIndex = parseInt(document.getElementById('currentEditExerciseIndex').value);
    const exercise = currentWorkout.exercises[exerciseIndex];
    
    exercise.sets.forEach((set, idx) => {
        set.actual = set.actual || {};
        set.actual.weight = parseFloat(document.getElementById(`currentActualWeight${idx}`).value) || 0;
        
        if (exercise.timeMode) {
            set.actual.time = parseInt(document.getElementById(`currentActualReps${idx}`).value) || 0;
        } else {
            set.actual.reps = parseInt(document.getElementById(`currentActualReps${idx}`).value) || 0;
        }
        
        set.completed = document.getElementById(`currentSetCompleted${idx}`).checked;
    });
    
    saveCurrentWorkout();
    
    document.getElementById('saveRecordBtn').onclick = saveRecordChanges;
    getRecordEditorModal().hide();
    renderDataBrowserContent();
}

function deleteHistoryItem(workoutId) {
    if (!confirm('Delete this workout from history?')) return;
    
    let history = loadWorkoutHistory();
    const idx = history.findIndex(w => w.id === workoutId);
    if (idx === -1) {
        alert('Workout not found — it may have already been deleted.');
        renderDataBrowserContent();
        return;
    }
    history.splice(idx, 1);
    saveWorkoutHistory(history);
    
    renderDataBrowserContent();
}

function deleteHistoryExercise(exerciseIndex) {
    if (!confirm('Delete this exercise and all its sets?')) return;
    
    let history = loadWorkoutHistory();
    const workoutIdx = history.findIndex(w => w.id === dataBrowserState.workoutId);
    
    if (workoutIdx === -1) return;
    
    history[workoutIdx].exercises.splice(exerciseIndex, 1);
    saveWorkoutHistory(history);
    
    renderDataBrowserContent();
}

function deleteHistorySet(setIndex) {
    if (!confirm('Delete this set?')) return;
    
    let history = loadWorkoutHistory();
    const workoutIdx = history.findIndex(w => w.id === dataBrowserState.workoutId);
    
    if (workoutIdx === -1) return;
    
    const exercises = history[workoutIdx].exercises;
    const exerciseIdx = dataBrowserState.exerciseIndex;
    if (exerciseIdx == null || exerciseIdx < 0 || exerciseIdx >= exercises.length) {
        alert('Could not locate the exercise — please close and reopen the editor.');
        getRecordEditorModal().hide();
        return;
    }
    
    const exercise = exercises[exerciseIdx];
    if (!exercise || !exercise.sets) return;
    if (setIndex < 0 || setIndex >= exercise.sets.length) {
        alert('Could not locate the set — please close and reopen the editor.');
        getRecordEditorModal().hide();
        return;
    }
    
    exercise.sets.splice(setIndex, 1);
    saveWorkoutHistory(history);
    
    getRecordEditorModal().hide();
    renderDataBrowserContent();
}

// ===== EXPORT / IMPORT =====

function exportAllData() {
    const data = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        currentWorkout: MyGymStorage.loadCurrentWorkout(),
        workoutHistory: loadWorkoutHistory(),
        exerciseLibrary: loadExerciseLibrary(),
        categoryConfig: loadCategoryConfig()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const date = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `mygym-backup-${date}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function triggerImport() {
    document.getElementById('importFileInput').click();
}

function formatHistoryRepairSummary(result) {
    return [
        `Updated workouts: ${result.workoutsUpdated}/${result.workoutsScanned}`,
        `Updated history exercises: ${result.exercisesUpdated}/${result.exercisesScanned}`,
        `Matched by library ID: ${result.linkedById}`,
        `Matched by exact name: ${result.linkedByName}`,
        `Skipped unmatched: ${result.skippedUnmatched}`,
        `Current workout updates: ${result.currentWorkoutUpdated}/${result.currentWorkoutScanned}`
    ].join('\n');
}

function runHistoryRepairFlow() {
    const history = loadWorkoutHistory();
    if (!history.length) {
        alert('No workout history found to repair.');
        return;
    }

    const confirmMessage = [
        'Repair workout history using the current exercise library?',
        '',
        'This will conservatively update stored exercise snapshots by:',
        '• exerciseLibraryId match first',
        '• exact case-insensitive name match second',
        '',
        'Unmatched records will be left untouched.'
    ].join('\n');

    if (!confirm(confirmMessage)) return;

    const result = MyGymExerciseIdentity.reconcileStoredExerciseHistory({ includeCurrentWorkout: true });

    loadCurrentWorkout();
    if (!document.getElementById('workoutScreen').classList.contains('d-none')) {
        renderExercises();
    }
    renderHistory();
    renderExerciseLibrary();

    alert(`History repair complete.\n\n${formatHistoryRepairSummary(result)}`);
    console.info('Manual history repair result:', result);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate structure
            if (!data.workoutHistory && !data.exerciseLibrary && !data.currentWorkout && !data.categoryConfig) {
                alert('Invalid backup file: missing data keys');
                return;
            }
            
            if (!confirm('This will replace all your current data. Continue?')) return;
            
            if (data.workoutHistory) {
                // Sanitise: assign IDs to any workouts missing them, and deduplicate IDs
                const seenIds = new Set();
                let idOffset = 0;
                const sanitised = data.workoutHistory.map(w => {
                    let id = w.id;
                    if (id == null || seenIds.has(id)) {
                        // Generate a unique ID that won't collide
                        do { id = Date.now() + (++idOffset); } while (seenIds.has(id));
                    }
                    seenIds.add(id);
                    return { ...w, id };
                });
                saveWorkoutHistory(sanitised);
            }
            if (data.exerciseLibrary) {
                saveExerciseLibrary(data.exerciseLibrary);
            }
            if (data.categoryConfig) {
                saveCategoryConfig(data.categoryConfig);
            }
            if (data.currentWorkout !== undefined) {
                if (data.currentWorkout === null) {
                    clearCurrentWorkout();
                    currentWorkout = null;
                } else {
                    currentWorkout = data.currentWorkout;
                    saveCurrentWorkout();
                }
            }
            
            alert('Data imported successfully!');
            renderExerciseLibrary();
            
        } catch (err) {
            alert('Failed to import: Invalid JSON file');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset for re-import
}

// ===== CATEGORY CONFIGURATION =====

const DEFAULT_CATEGORIES = [
    { id: 1, name: 'Push', color: '#22c55e', protected: false },
    { id: 2, name: 'Pull', color: '#3b82f6', protected: false },
    { id: 3, name: 'Legs', color: '#f59e0b', protected: false },
    { id: 4, name: 'Core', color: '#a855f7', protected: false },
    { id: 5, name: 'Cardio', color: '#ef4444', protected: false },
    { id: 6, name: 'Other', color: '#6b7280', protected: true },
    { id: 7, name: 'Uncategorized', color: '#374151', protected: true }
];

const COLOR_PRESETS = [
    // Greens
    '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
    // Blues
    '#3b82f6', '#2563eb', '#1d4ed8', '#06b6d4', '#0891b2',
    // Oranges/Yellows
    '#f59e0b', '#d97706', '#b45309', '#eab308', '#ca8a04',
    // Reds/Pinks
    '#ef4444', '#dc2626', '#b91c1c', '#ec4899', '#db2777',
    // Purples
    '#a855f7', '#8b5cf6', '#7c3aed', '#6366f1', '#4f46e5',
    // Neutrals/Others
    '#f97316', '#14b8a6', '#0d9488', '#6b7280', '#374151'
];

function loadCategoryConfig() {
    return MyGymStorage.loadCategoryConfig(DEFAULT_CATEGORIES);
}

function saveCategoryConfig(categories) {
    return MyGymStorage.saveCategoryConfig(categories, DEFAULT_CATEGORIES);
}

function getCategoryColor(categoryName) {
    const categories = loadCategoryConfig();
    const cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    return cat?.color || '#374151';
}

function getCategories() {
    const categories = loadCategoryConfig();
    return categories.filter(c => c.name !== 'Uncategorized').map(c => c.name);
}

function populateCategoryDropdowns() {
    const categories = getCategories();
    const dropdowns = [
        document.getElementById('quickCategorySelect'),
        document.getElementById('exerciseLibraryCategoryInput')
    ];
    
    dropdowns.forEach(dropdown => {
        if (!dropdown) return;
        const currentValue = dropdown.value;
        dropdown.innerHTML = '<option value="">No category</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        dropdown.value = currentValue;
    });
}

function getCategoryOptionsHtml(selectedCategory) {
    const categories = getCategories();
    return '<option value="">No category</option>' +
        categories.map(cat => 
            `<option value="${cat}" ${selectedCategory === cat ? 'selected' : ''}>${cat}</option>`
        ).join('');
}

// Category Management UI
let categoryModal = null;

function getCategoryModal() {
    if (!categoryModal) {
        categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));
    }
    return categoryModal;
}

function renderCategoryList() {
    const categories = loadCategoryConfig();
    const list = document.getElementById('categoryList');
    const count = document.getElementById('categoryCount');
    
    if (count) count.textContent = `${categories.filter(c => c.name !== 'Uncategorized').length} categories`;
    
    if (!list) return;
    
    list.innerHTML = categories.filter(c => c.name !== 'Uncategorized').map(cat => `
        <div class="category-card">
            <span class="category-swatch" style="background: ${cat.color}"></span>
            <span class="category-name">${cat.name}</span>
            <div class="category-actions">
                <button class="btn-icon-action" onclick="showEditCategoryModal(${cat.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                ${cat.protected ? '' : `
                <button class="btn-icon-action btn-delete" onclick="deleteCategory(${cat.id})">
                    <i class="bi bi-trash"></i>
                </button>`}
            </div>
        </div>
    `).join('');
}

function showAddCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryNameInput').value = '';
    renderColorSwatches('');
    getCategoryModal().show();
}

function showEditCategoryModal(categoryId) {
    const categories = loadCategoryConfig();
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    
    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    document.getElementById('categoryId').value = categoryId;
    document.getElementById('categoryNameInput').value = cat.name;
    renderColorSwatches(cat.color);
    getCategoryModal().show();
}

function renderColorSwatches(selectedColor) {
    const container = document.getElementById('colorSwatchGrid');
    container.innerHTML = COLOR_PRESETS.map(color => `
        <button type="button" 
                class="color-swatch ${color === selectedColor ? 'selected' : ''}" 
                style="background: ${color}"
                onclick="selectColorSwatch('${color}')">
        </button>
    `).join('');
    document.getElementById('selectedColor').value = selectedColor || COLOR_PRESETS[0];
}

function selectColorSwatch(color) {
    document.getElementById('selectedColor').value = color;
    document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
    event.target.classList.add('selected');
}

function saveCategoryChanges() {
    const categoryId = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryNameInput').value.trim();
    const color = document.getElementById('selectedColor').value;
    
    if (!name) {
        alert('Please enter a category name');
        return;
    }
    
    let categories = loadCategoryConfig();
    
    // Check for duplicate name
    const duplicate = categories.find(c => 
        c.name.toLowerCase() === name.toLowerCase() && 
        c.id !== parseInt(categoryId)
    );
    if (duplicate) {
        alert('A category with this name already exists');
        return;
    }
    
    if (categoryId) {
        // Edit existing
        const idx = categories.findIndex(c => c.id === parseInt(categoryId));
        if (idx !== -1) {
            categories[idx].name = name;
            categories[idx].color = color;
        }
    } else {
        // Add new
        const maxId = Math.max(...categories.map(c => c.id), 0);
        categories.push({
            id: maxId + 1,
            name: name,
            color: color,
            protected: false
        });
    }
    
    saveCategoryConfig(categories);
    getCategoryModal().hide();
    renderCategoryList();
    populateCategoryDropdowns();
}

function deleteCategory(categoryId) {
    const categories = loadCategoryConfig();
    const cat = categories.find(c => c.id === categoryId);
    
    if (!cat || cat.protected) {
        alert('This category cannot be deleted');
        return;
    }
    
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    
    const updated = categories.filter(c => c.id !== categoryId);
    saveCategoryConfig(updated);
    renderCategoryList();
    populateCategoryDropdowns();
}

// ===== CATEGORY BREAKDOWN =====

function getCategoryBreakdownModal() { return MyGymHistoryReporting.getCategoryBreakdownModal(); }

function getCategoryForExercise(exerciseName) { return MyGymHistoryReporting.getCategoryForExercise(exerciseName); }

function calculateCategoryBreakdown(startDate, endDate) { return MyGymHistoryReporting.calculateCategoryBreakdown(startDate, endDate); }

function renderCategoryChart(breakdownData) { return MyGymHistoryReporting.renderCategoryChart(breakdownData); }

function renderCategoryLegend(breakdownData) { return MyGymHistoryReporting.renderCategoryLegend(breakdownData); }

function renderBreakdownSummary(breakdownData) { return MyGymHistoryReporting.renderBreakdownSummary(breakdownData); }

function formatVolume(volume) { return MyGymHistoryReporting.formatVolume(volume); }

function showCategoryBreakdown() { return MyGymHistoryReporting.showCategoryBreakdown(); }

function setDateRange(days) { return MyGymHistoryReporting.setDateRange(days); }

function toggleCustomDateRange() { return MyGymHistoryReporting.toggleCustomDateRange(); }

function applyCustomDateRange() { return MyGymHistoryReporting.applyCustomDateRange(); }

function refreshBreakdown() { return MyGymHistoryReporting.refreshBreakdown(); }

// ─── PWA Install Prompt ───────────────────────────────────────────────────────

function initializeInstallPrompt() {
    // Skip if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) return;

    // Skip if user dismissed within the last 7 days
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed && (Date.now() - parseInt(dismissed)) < 7 * 24 * 60 * 60 * 1000) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isIOSSafari = isIOS && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);

    if (isIOSSafari) {
        const addBtn = document.getElementById('installAddBtn');
        if (addBtn) addBtn.textContent = 'Show Me How';
        showInstallBanner();
    } else if (deferredInstallPrompt) {
        showInstallBanner();
    }
}

function showInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (!banner) return;
    banner.style.display = 'block';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => banner.classList.add('install-banner-visible'));
    });
}

function hideInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (!banner) return;
    banner.classList.remove('install-banner-visible');
    setTimeout(() => { banner.style.display = 'none'; }, 350);
}

function dismissInstallBanner() {
    localStorage.setItem('installPromptDismissed', Date.now().toString());
    hideInstallBanner();
}

function triggerInstall() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
        const instructions = document.getElementById('iosInstallInstructions');
        const addBtn = document.getElementById('installAddBtn');
        if (!instructions) return;
        const showing = instructions.style.display !== 'none';
        instructions.style.display = showing ? 'none' : 'block';
        if (addBtn) addBtn.textContent = showing ? 'Show Me How' : 'Got it ✓';
    } else if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((result) => {
            if (result.outcome === 'accepted') hideInstallBanner();
            deferredInstallPrompt = null;
        });
    }
}
