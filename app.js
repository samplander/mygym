// State Management
let currentWorkout = null;
let timerInterval = null;

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(registration => console.log('Service Worker registered:', registration.scope))
        .catch(error => console.log('Service Worker registration failed:', error));
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Check if there's an active workout
    loadCurrentWorkout();
    
    // Event listeners
    document.getElementById('startWorkoutBtn').addEventListener('click', startWorkout);
    document.getElementById('addExerciseBtn').addEventListener('click', () => showAddExerciseModal());
    document.getElementById('saveExerciseBtn').addEventListener('click', saveExercise);
    document.getElementById('completeWorkoutBtn').addEventListener('click', completeWorkout);
    
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
    
    // Initialize autocomplete
    initializeAutocomplete();
    
    // Render quick stats
    renderQuickStats();
    
    // Show appropriate screen
    if (currentWorkout) {
        showWorkoutScreen();
    } else {
        showHomeScreen();
    }
}

// Quick Stats Rendering
function renderQuickStats() {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const statsContainer = document.getElementById('quickStats');
    
    if (history.length === 0) {
        statsContainer.innerHTML = '';
        return;
    }
    
    // Calculate stats
    const totalWorkouts = history.length;
    const lastWorkout = history[0];
    const daysSinceLastWorkout = Math.floor((Date.now() - new Date(lastWorkout.completedAt).getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate total sets from all workouts
    const totalSets = history.reduce((sum, workout) => sum + (workout.totalSets || 0), 0);
    
    // Handle days display with fallback
    const daysValue = isNaN(daysSinceLastWorkout) ? 0 : daysSinceLastWorkout;
    const daysLabel = daysValue === 0 ? 'Today' : (daysValue === 1 ? 'Day Ago' : 'Days Ago');
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <span class="stat-value">${totalWorkouts}</span>
            <span class="stat-label">Workouts</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${totalSets}</span>
            <span class="stat-label">Total Sets</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${daysValue === 0 ? '0' : daysValue}</span>
            <span class="stat-label">${daysLabel}</span>
        </div>
    `;
}

// Screen Management
function showHomeScreen() {
    renderQuickStats(); // Refresh stats when returning to home
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
        localStorage.removeItem('currentWorkout');
        
        // Stop timer
        stopTimer();
        
        // Show home screen
        showHomeScreen();
        
        alert('Workout completed and saved!');
    }
}

function saveToHistory() {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    history.unshift(currentWorkout);
    
    // Keep only last 100 workouts to manage storage
    if (history.length > 100) {
        history.splice(100);
    }
    
    localStorage.setItem('workoutHistory', JSON.stringify(history));
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
        const existingExercise = library.find(ex => ex.name.toLowerCase() === name.toLowerCase());
        
        if (!existingExercise) {
            addExerciseToLibrary(name, categorySelect.value);
        }
    }
    
    // Update usage stats if selecting from library
    updateExerciseUsage(name);
    
    const exercise = {
        id: Date.now(),
        name: name,
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
    
    container.innerHTML = currentWorkout.exercises.map(exercise => `
        <div class="exercise-card">
            <div class="exercise-header" onclick="event.target.closest('.exercise-header').querySelector('.delete-exercise-btn').contains(event.target) || event.target.closest('.exercise-header').querySelector('.toggle-details-btn').contains(event.target) || event.target.closest('.exercise-header').querySelector('.toggle-time-btn').contains(event.target) || event.target.closest('.exercise-header').querySelector('.toggle-previous-btn').contains(event.target) ? null : toggleExercise(${exercise.id})">
                <div class="exercise-header-left">
                    <i class="bi bi-chevron-down chevron ${exercise.collapsed ? 'collapsed' : ''}"></i>
                    <h6>${exercise.name}</h6>
                </div>
                <div class="exercise-header-right">
                    <button class="toggle-previous-btn" onclick="event.stopPropagation(); toggleShowPrevious(${exercise.id})" title="${exercise.showPrevious ? 'Hide' : 'Show'} previous values">
                        <i class="bi bi-activity" style="opacity: ${exercise.showPrevious ? '1' : '0.5'}"></i>
                    </button>
                    <button class="toggle-time-btn" onclick="event.stopPropagation(); toggleTimeMode(${exercise.id})" title="${exercise.timeMode ? 'Switch to Reps' : 'Switch to Time'}">
                        <i class="bi bi-${exercise.timeMode ? '123' : 'stopwatch'}"></i>
                    </button>
                    <button class="exercise-history-btn" onclick="event.stopPropagation(); showExerciseHistory('${exercise.name.replace(/'/g, "\\'")}')", title="View exercise history">
                        <i class="bi bi-graph-up"></i>
                    </button>
                    <button class="toggle-details-btn" onclick="event.stopPropagation(); toggleExerciseDetails(${exercise.id})" title="${exercise.detailsHidden ? 'Show' : 'Hide'} details">
                        <i class="bi bi-${exercise.detailsHidden ? 'eye-slash' : 'eye'}"></i>
                    </button>
                    <button class="delete-exercise-btn" onclick="event.stopPropagation(); deleteExercise(${exercise.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="exercise-body ${exercise.collapsed ? 'collapsed' : ''}">
                ${renderSet(exercise.id, exercise)}
                <button class="add-set-btn" onclick="addSet(${exercise.id})">
                    <i class="bi bi-plus-lg"></i> Add Set
                </button>
            </div>
        </div>
    `).join('');
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

function pad(num) {
    return num.toString().padStart(2, '0');
}

// LocalStorage
function saveCurrentWorkout() {
    localStorage.setItem('currentWorkout', JSON.stringify(currentWorkout));
}

function loadCurrentWorkout() {
    const saved = localStorage.getItem('currentWorkout');
    if (saved) {
        currentWorkout = JSON.parse(saved);
        // Default to accordion mode if property doesn't exist (backwards compatibility)
        if (currentWorkout.accordionMode === undefined) {
            currentWorkout.accordionMode = true;
        }
    }
}

// History Management
function renderHistory() {
    const container = document.getElementById('historyContent');
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-graph-up"></i>
                <p>No Workouts Yet</p>
                <p class="text-muted">Complete your first workout<br>to see it here!</p>
                <button class="btn btn-primary mt-3" onclick="showHomeScreen()">
                    <i class="bi bi-play-circle"></i> Start Workout
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = history.map((workout, index) => {
        const date = new Date(workout.startTime);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const durationStr = formatDuration(workout.duration || 0);
        const exerciseNames = workout.exercises.map(ex => ex.name).join(', ');
        const exercisePreview = exerciseNames.length > 40 ? exerciseNames.substring(0, 37) + '...' : exerciseNames;
        
        return `
            <div class="history-card" onclick="viewWorkoutDetail(${workout.id})">
                <div class="history-card-header">
                    <div class="history-date">${dateStr}</div>
                    <div class="history-duration">
                        <i class="bi bi-stopwatch"></i> ${durationStr}
                    </div>
                </div>
                <div class="history-stats">
                    ${workout.totalExercises || workout.exercises.length} exercises • ${workout.totalSets || 0} sets
                </div>
                <div class="history-exercises">${exercisePreview}</div>
                <div class="history-time">${timeStr}</div>
            </div>
        `;
    }).join('');
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${minutes}:${pad(secs)}`;
}

function viewWorkoutDetail(workoutId) {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const workout = history.find(w => w.id === workoutId);
    
    if (!workout) return;
    
    const modal = new bootstrap.Modal(document.getElementById('workoutDetailModal'));
    const date = new Date(workout.startTime);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    
    document.getElementById('workoutDetailTitle').textContent = dateStr;
    
    const startTime = new Date(workout.startTime);
    const endTime = workout.endTime ? new Date(workout.endTime) : null;
    const durationStr = formatDuration(workout.duration || 0);
    
    // Calculate workout statistics
    const stats = calculateWorkoutStats(workout);
    
    const detailsHtml = `
        <!-- Enhanced Stats Header -->
        <div class="detail-stats-header">
            <div class="detail-stat-card">
                <i class="bi bi-stopwatch"></i>
                <div class="detail-stat-value">${durationStr}</div>
                <div class="detail-stat-label">Duration</div>
            </div>
            <div class="detail-stat-card">
                <i class="bi bi-stack"></i>
                <div class="detail-stat-value">${stats.totalSets}</div>
                <div class="detail-stat-label">Total Sets</div>
            </div>
            <div class="detail-stat-card">
                <i class="bi bi-lightning-charge"></i>
                <div class="detail-stat-value">${formatVolume(stats.totalVolume)}</div>
                <div class="detail-stat-label">Volume</div>
            </div>
        </div>
        
        <!-- Performance Summary -->
        <div class="detail-performance">
            <div class="performance-header">
                <span class="performance-title">Performance</span>
                <span class="performance-badge ${getPerformanceBadgeClass(stats.completionRate)}">
                    ${stats.completionRate}% <i class="bi bi-${stats.completionRate >= 90 ? 'check-circle-fill' : stats.completionRate >= 70 ? 'exclamation-circle-fill' : 'x-circle-fill'}"></i>
                </span>
            </div>
            <div class="performance-bar">
                <div class="performance-bar-fill" style="width: ${stats.completionRate}%"></div>
            </div>
            <div class="performance-text">
                ${stats.completedSets} of ${stats.totalSets} sets completed
            </div>
        </div>
        
        <!-- Workout Highlights -->
        ${stats.highlights.length > 0 ? `
            <div class="detail-highlights">
                <div class="highlights-title"><i class="bi bi-stars"></i> Workout Highlights</div>
                ${stats.highlights.map(h => `
                    <div class="highlight-item">
                        <span class="highlight-icon">${h.icon}</span>
                        <span class="highlight-text">${h.text}</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        <!-- Exercise Details -->
        <div class="detail-exercises-section">
            <div class="exercises-section-title">Exercises</div>
            ${workout.exercises.map((exercise, exIndex) => {
                const exStats = calculateExerciseStats(exercise);
                return `
                <div class="detail-exercise-card-new ${exStats.allCompleted ? 'all-completed' : ''}" data-exercise-id="${exIndex}">
                    <div class="detail-exercise-header-new" onclick="toggleDetailExercise(${exIndex})">
                        <div class="exercise-header-left-new">
                            ${exStats.allCompleted ? '<i class="bi bi-check-circle-fill exercise-check"></i>' : '<i class="bi bi-circle exercise-check-empty"></i>'}
                            <div>
                                <div class="exercise-name-new">${exercise.name}</div>
                                <div class="exercise-summary-new">${exStats.summary}</div>
                            </div>
                        </div>
                        <div class="exercise-header-right-new">
                            <span class="exercise-sets-badge">${exercise.sets.length} sets</span>
                            <i class="bi bi-chevron-down exercise-chevron"></i>
                        </div>
                    </div>
                    <div class="detail-exercise-body-new" style="display: none;">
                        <div class="detail-sets-table">
                            <div class="sets-table-header">
                                <div class="set-col-number">Set</div>
                                <div class="set-col-actual">Values</div>
                                <div class="set-col-status">Status</div>
                            </div>
                            ${exercise.sets.map((set, index) => {
                                // Backward compatibility: check completed property first, fallback to value-based check
                                const completed = set.completed !== undefined ? set.completed : (set.actual.weight > 0 || set.actual.reps > 0 || set.actual.time > 0);
                                return `
                                <div class="sets-table-row ${completed ? 'set-completed' : 'set-missed'}">
                                    <div class="set-col-number">${index + 1}</div>
                                    <div class="set-col-actual">
                                        ${set.actual.weight}lbs × ${set.actual.reps}
                                        ${set.actual.time > 0 ? `<span class="set-time">${set.actual.time}s</span>` : ''}
                                    </div>
                                    <div class="set-col-status">
                                        <span class="status-icon" title="${completed ? 'Completed' : 'Not completed'}">
                                            <i class="bi bi-${completed ? 'check-circle-fill' : 'x-circle-fill'}"></i>
                                        </span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('workoutDetailBody').innerHTML = detailsHtml;
    
    // Set up button handlers
    document.getElementById('deleteWorkoutBtn').onclick = () => {
        deleteWorkout(workoutId);
        modal.hide();
    };
    
    document.getElementById('useTemplateBtn').onclick = () => {
        useAsTemplate(workoutId);
        modal.hide();
    };
    
    modal.show();
}

function calculateWorkoutStats(workout) {
    let totalSets = 0;
    let completedSets = 0;
    let totalVolume = 0;
    let heaviestSet = { weight: 0, exercise: '', reps: 0 };
    let mostVolumeExercise = { name: '', volume: 0 };
    let perfectExercises = [];
    
    workout.exercises.forEach(exercise => {
        let exerciseVolume = 0;
        let exercisePerfect = true;
        
        exercise.sets.forEach(set => {
            totalSets++;
            const actualVol = set.actual.weight * set.actual.reps;
            
            totalVolume += actualVol;
            exerciseVolume += actualVol;
            
            // Backward compatibility: check completed property first, fallback to value-based check
            const isCompleted = set.completed !== undefined ? set.completed : (set.actual.weight > 0 || set.actual.reps > 0);
            if (isCompleted) {
                completedSets++;
            } else {
                exercisePerfect = false;
            }
            
            if (set.actual.weight > heaviestSet.weight) {
                heaviestSet = { weight: set.actual.weight, exercise: exercise.name, reps: set.actual.reps };
            }
        });
        
        if (exerciseVolume > mostVolumeExercise.volume) {
            mostVolumeExercise = { name: exercise.name, volume: exerciseVolume };
        }
        
        if (exercisePerfect && exercise.sets.length > 0) {
            perfectExercises.push(exercise.name);
        }
    });
    
    const completionRate = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    
    // Generate highlights
    const highlights = [];
    if (heaviestSet.weight > 0) {
        highlights.push({
            icon: '💪',
            text: `Heaviest Set: ${heaviestSet.exercise} - ${heaviestSet.weight}lbs × ${heaviestSet.reps}`
        });
    }
    if (mostVolumeExercise.volume > 0) {
        highlights.push({
            icon: '🔥',
            text: `Most Volume: ${mostVolumeExercise.name} - ${formatVolume(mostVolumeExercise.volume)}`
        });
    }
    if (perfectExercises.length > 0) {
        highlights.push({
            icon: '⭐',
            text: `All Sets Completed: ${perfectExercises[0]}${perfectExercises.length > 1 ? ` +${perfectExercises.length - 1} more` : ''}`
        });
    }
    
    return {
        totalSets,
        completedSets,
        completionRate,
        totalVolume,
        highlights
    };
}

function calculateExerciseStats(exercise) {
    let totalVolume = 0;
    let completedSets = 0;
    
    exercise.sets.forEach(set => {
        totalVolume += set.actual.weight * set.actual.reps;
        if (set.actual.weight > 0 || set.actual.reps > 0) {
            completedSets++;
        }
    });
    
    const allCompleted = completedSets === exercise.sets.length && exercise.sets.length > 0;
    const avgWeight = exercise.sets.length > 0 ? 
        Math.round(exercise.sets.reduce((sum, s) => sum + s.actual.weight, 0) / exercise.sets.length) : 0;
    const avgReps = exercise.sets.length > 0 ? 
        Math.round(exercise.sets.reduce((sum, s) => sum + s.actual.reps, 0) / exercise.sets.length) : 0;
    
    return {
        allCompleted,
        summary: `${completedSets}/${exercise.sets.length} sets • ${avgWeight}lbs × ${avgReps} avg • ${formatVolume(totalVolume)}`
    };
}

// Exercise History Functions
function getExerciseHistory(exerciseName) {
    const history = JSON.parse(localStorage.getItem('workoutHistory')) || [];
    const exerciseHistory = [];
    
    // Filter workouts that contain this exercise and extract sets
    history.forEach(workout => {
        const exercise = workout.exercises.find(ex => ex.name === exerciseName);
        if (exercise && exercise.sets.length > 0) {
            exerciseHistory.push({
                workoutDate: new Date(workout.completedAt),
                completedAt: workout.completedAt,
                duration: workout.duration,
                sets: exercise.sets.map(set => ({
                    actual: { ...set.actual }
                })),
                timeMode: exercise.timeMode || false
            });
        }
    });
    
    // Sort chronologically (oldest to newest)
    exerciseHistory.sort((a, b) => a.workoutDate - b.workoutDate);
    
    return exerciseHistory;
}

function showExerciseHistory(exerciseName) {
    const history = getExerciseHistory(exerciseName);
    const modal = new bootstrap.Modal(document.getElementById('exerciseHistoryModal'));
    const titleEl = document.getElementById('exerciseHistoryTitle');
    const bodyEl = document.getElementById('exerciseHistoryBody');
    
    titleEl.textContent = exerciseName;
    
    if (history.length === 0) {
        bodyEl.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-graph-up"></i>
                <p>No history for this exercise yet.<br>Complete a workout to see your progress!</p>
            </div>
        `;
        modal.show();
        return;
    }
    
    // Render history grouped by workout session
    let html = '<div class="exercise-history-list">';
    
    history.forEach((session, index) => {
        const date = new Date(session.completedAt);
        const isToday = date.toDateString() === new Date().toDateString();
        const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString();
        
        let dateLabel;
        if (isToday) {
            dateLabel = 'Today';
        } else if (isYesterday) {
            dateLabel = 'Yesterday';
        } else {
            dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        
        html += `
            <div class="history-session">
                <div class="history-session-header">
                    <span class="history-date">${dateLabel}</span>
                    <span class="history-meta">${session.sets.length} set${session.sets.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="history-sets">
        `;
        
        session.sets.forEach((set, setIndex) => {
            let setDisplay;
            if (session.timeMode) {
                // Time-based exercise
                const minutes = Math.floor(set.actual.time / 60);
                const seconds = set.actual.time % 60;
                setDisplay = minutes > 0 
                    ? `${minutes}m ${seconds}s`
                    : `${seconds}s`;
            } else {
                // Weight/reps exercise
                if (set.actual.weight > 0 || set.actual.reps > 0) {
                    setDisplay = `${set.actual.weight}kg × ${set.actual.reps}`;
                } else {
                    setDisplay = '<span class="text-muted">Not completed</span>';
                }
            }
            
            html += `
                <div class="history-set">
                    <span class="history-set-number">#${setIndex + 1}</span>
                    <span class="history-set-value">${setDisplay}</span>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    bodyEl.innerHTML = html;
    modal.show();
}

function getSetStatus(set) {
    // Simplified: just check if completed (removed planned comparison)
    const actualVol = set.actual.weight * set.actual.reps;
    const completed = actualVol > 0 || set.actual.time > 0;
    
    return { 
        class: completed ? 'set-completed' : 'set-missed', 
        icon: completed ? 'check-circle-fill' : 'x-circle-fill',
        arrow: '', 
        title: completed ? 'Completed' : 'Not completed',
        completed: completed,
        percentage: completed ? 100 : 0
    };
}

function formatVolume(volume) {
    if (volume >= 1000) {
        return (volume / 1000).toFixed(1) + 'k lbs';
    }
    return volume + ' lbs';
}

function getPerformanceBadgeClass(rate) {
    if (rate >= 90) return 'badge-excellent';
    if (rate >= 70) return 'badge-good';
    return 'badge-needs-work';
}

function toggleDetailExercise(exerciseId) {
    const card = document.querySelector(`[data-exercise-id="${exerciseId}"]`);
    if (!card) return;
    
    const body = card.querySelector('.detail-exercise-body-new');
    const chevron = card.querySelector('.exercise-chevron');
    
    if (body.style.display === 'none') {
        body.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        body.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

function deleteWorkout(workoutId) {
    if (!confirm('Delete this workout from history?')) return;
    
    let history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    history = history.filter(w => w.id !== workoutId);
    localStorage.setItem('workoutHistory', JSON.stringify(history));
    renderHistory();
}

function clearAllHistory() {
    if (!confirm('Delete ALL workout history? This cannot be undone!')) return;
    
    localStorage.removeItem('workoutHistory');
    renderHistory();
}

function useAsTemplate(workoutId) {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const workout = history.find(w => w.id === workoutId);
    
    if (!workout) return;
    
    // Create new workout with template data
    currentWorkout = {
        id: Date.now(),
        startTime: new Date().toISOString(),
        exercises: workout.exercises.map(exercise => ({
            id: Date.now() + Math.random(),
            name: exercise.name,
            collapsed: false,
            detailsHidden: false,
            selectedSetIndex: 0,
            sets: exercise.sets.map(set => ({
                collapsed: false,
                planned: { ...set.actual },
                actual: { ...set.actual }
            }))
        }))
    };
    
    saveCurrentWorkout();
    showWorkoutScreen();
    
    alert('Template loaded! Adjust values as needed.');
}

// ===== EXERCISE LIBRARY MANAGEMENT =====

function loadExerciseLibrary() {
    const library = localStorage.getItem('exerciseLibrary');
    return library ? JSON.parse(library) : getDefaultExercises();
}

function saveExerciseLibrary(library) {
    localStorage.setItem('exerciseLibrary', JSON.stringify(library));
}

function getDefaultExercises() {
    return [
        { id: Date.now(), name: "Bench Press", category: "Push", createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
        { id: Date.now() + 1, name: "Squats", category: "Legs", createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
        { id: Date.now() + 2, name: "Deadlift", category: "Pull", createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
        { id: Date.now() + 3, name: "Overhead Press", category: "Push", createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
        { id: Date.now() + 4, name: "Pull-ups", category: "Pull", createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 }
    ];
}

function renderExerciseLibrary(searchQuery = '') {
    const library = loadExerciseLibrary();
    const container = document.getElementById('exerciseLibraryList');
    
    if (!container) return;
    
    // Filter by search
    const filtered = searchQuery 
        ? library.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : library;
    
    // Sort by usage count (most used first), then alphabetically
    const sorted = filtered.sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
            return b.usageCount - a.usageCount;
        }
        return a.name.localeCompare(b.name);
    });
    
    // Update count
    const countEl = document.getElementById('exerciseCount');
    if (countEl) {
        countEl.textContent = `${library.length} exercise${library.length !== 1 ? 's' : ''}`;
    }
    
    if (sorted.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-search"></i>
                <p>No exercises found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sorted.map(exercise => `
        <div class="exercise-library-card">
            <div class="exercise-library-info">
                <div class="exercise-library-name">
                    ${exercise.category ? `<span class="category-badge">${exercise.category}</span>` : ''}
                    ${exercise.name}
                </div>
                <div class="exercise-library-meta">
                    ${exercise.usageCount > 0 
                        ? `Used ${exercise.usageCount} time${exercise.usageCount !== 1 ? 's' : ''}`
                        : 'Never used'}
                </div>
            </div>
            <div class="exercise-library-actions">
                <button class="btn-icon-action" onclick="editExerciseLibrary(${exercise.id})" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-icon-action btn-delete" onclick="deleteExerciseLibrary(${exercise.id})" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function showAddExerciseLibraryModal() {
    const modal = new bootstrap.Modal(document.getElementById('exerciseLibraryModal'));
    document.getElementById('exerciseLibraryModalTitle').textContent = 'Add Exercise';
    document.getElementById('exerciseLibraryId').value = '';
    document.getElementById('exerciseLibraryNameInput').value = '';
    document.getElementById('exerciseLibraryCategoryInput').value = '';
    modal.show();
    setTimeout(() => document.getElementById('exerciseLibraryNameInput').focus(), 300);
}

function editExerciseLibrary(exerciseId) {
    const library = loadExerciseLibrary();
    const exercise = library.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    const modal = new bootstrap.Modal(document.getElementById('exerciseLibraryModal'));
    document.getElementById('exerciseLibraryModalTitle').textContent = 'Edit Exercise';
    document.getElementById('exerciseLibraryId').value = exercise.id;
    document.getElementById('exerciseLibraryNameInput').value = exercise.name;
    document.getElementById('exerciseLibraryCategoryInput').value = exercise.category || '';
    modal.show();
    setTimeout(() => document.getElementById('exerciseLibraryNameInput').focus(), 300);
}

function saveExerciseLibraryItem() {
    const id = document.getElementById('exerciseLibraryId').value;
    const name = document.getElementById('exerciseLibraryNameInput').value.trim();
    const category = document.getElementById('exerciseLibraryCategoryInput').value;
    
    if (!name) {
        alert('Please enter an exercise name');
        return;
    }
    
    let library = loadExerciseLibrary();
    
    if (id) {
        // Update existing
        const index = library.findIndex(ex => ex.id == id);
        if (index !== -1) {
            library[index].name = name;
            library[index].category = category;
        }
    } else {
        // Create new
        library.push({
            id: Date.now(),
            name: name,
            category: category,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0
        });
    }
    
    saveExerciseLibrary(library);
    renderExerciseLibrary();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('exerciseLibraryModal'));
    modal.hide();
}

// ============================================
// AUTOCOMPLETE FUNCTIONALITY
// ============================================

let selectedAutocompleteIndex = -1;

function initializeAutocomplete() {
    const input = document.getElementById('exerciseNameInput');
    const addToLibraryCheckbox = document.getElementById('addToLibraryCheckbox');
    const addToLibraryContainer = document.getElementById('addToLibraryContainer');
    const categorySelectContainer = document.getElementById('categorySelectContainer');
    
    if (!input) return;
    
    // Input event - show suggestions as user types
    input.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        
        if (value.length === 0) {
            hideAutocomplete();
            addToLibraryContainer.style.display = 'none';
            return;
        }
        
        showAutocompleteSuggestions(value);
    });
    
    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const dropdown = document.getElementById('autocompleteDropdown');
        const items = dropdown.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
            updateAutocompleteSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
            updateAutocompleteSelection(items);
        } else if (e.key === 'Enter') {
            if (selectedAutocompleteIndex >= 0 && items[selectedAutocompleteIndex]) {
                e.preventDefault();
                items[selectedAutocompleteIndex].click();
            }
            // If no suggestion selected, default Enter behavior saves exercise
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    });
    
    // Toggle category selector based on checkbox
    if (addToLibraryCheckbox) {
        addToLibraryCheckbox.addEventListener('change', (e) => {
            categorySelectContainer.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            hideAutocomplete();
        }
    });
    
    // Reset when modal closes
    const addExerciseModal = document.getElementById('addExerciseModal');
    if (addExerciseModal) {
        addExerciseModal.addEventListener('hidden.bs.modal', () => {
            input.value = '';
            hideAutocomplete();
            addToLibraryContainer.style.display = 'none';
        });
    }
}

function showAutocompleteSuggestions(searchText) {
    const library = loadExerciseLibrary();
    const dropdown = document.getElementById('autocompleteDropdown');
    const addToLibraryContainer = document.getElementById('addToLibraryContainer');
    const autocompleteHint = document.getElementById('autocompleteHint');
    
    if (!dropdown) return;
    
    // Filter and sort exercises
    const filtered = library
        .filter(ex => ex.name.toLowerCase().includes(searchText.toLowerCase()))
        .sort((a, b) => {
            // Smart sorting: usage count, then last used, then alphabetical
            if (a.usageCount !== b.usageCount) {
                return b.usageCount - a.usageCount; // Higher usage first
            }
            if (a.lastUsed && b.lastUsed) {
                return new Date(b.lastUsed) - new Date(a.lastUsed); // More recent first
            }
            if (a.lastUsed && !b.lastUsed) return -1;
            if (!a.lastUsed && b.lastUsed) return 1;
            return a.name.localeCompare(b.name); // Alphabetical
        });
    
    selectedAutocompleteIndex = -1;
    
    if (filtered.length === 0) {
        // No matches - show "Add to Library" checkbox
        dropdown.style.display = 'none';
        addToLibraryContainer.style.display = 'block';
        autocompleteHint.style.display = 'block';
    } else {
        // Show suggestions
        dropdown.style.display = 'block';
        addToLibraryContainer.style.display = 'none';
        autocompleteHint.style.display = 'none';
        
        dropdown.innerHTML = filtered.map(ex => {
            const categoryBadge = ex.category 
                ? `<span class="category-badge-small">${ex.category}</span>` 
                : '';
            const usageInfo = ex.usageCount > 0 
                ? `<span class="usage-stats-small">${ex.usageCount}x • ${formatLastUsed(ex.lastUsed)}</span>`
                : '<span class="usage-stats-small">Never used</span>';
            
            return `
                <div class="autocomplete-item" data-name="${ex.name}">
                    <div class="autocomplete-item-main">
                        <span class="autocomplete-item-name">${highlightMatch(ex.name, searchText)}</span>
                        ${categoryBadge}
                    </div>
                    <div class="autocomplete-item-stats">${usageInfo}</div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                selectSuggestion(item.dataset.name);
            });
        });
    }
}

function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedAutocompleteIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function selectSuggestion(name) {
    const input = document.getElementById('exerciseNameInput');
    input.value = name;
    hideAutocomplete();
    
    // Trigger saveExercise directly when selecting from library
    saveExercise();
}

function hideAutocomplete() {
    const dropdown = document.getElementById('autocompleteDropdown');
    const autocompleteHint = document.getElementById('autocompleteHint');
    
    if (dropdown) dropdown.style.display = 'none';
    if (autocompleteHint) autocompleteHint.style.display = 'none';
    
    selectedAutocompleteIndex = -1;
}

function highlightMatch(text, search) {
    const regex = new RegExp(`(${search})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

function formatLastUsed(lastUsedDate) {
    if (!lastUsedDate) return 'Never';
    
    const date = new Date(lastUsedDate);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

// Update exercise usage when adding to workout
function updateExerciseUsage(exerciseName) {
    const library = loadExerciseLibrary();
    const exercise = library.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
    
    if (exercise) {
        exercise.usageCount = (exercise.usageCount || 0) + 1;
        exercise.lastUsed = new Date().toISOString();
        saveExerciseLibrary(library);
    }
}

// Add new exercise to library
function addExerciseToLibrary(name, category = '') {
    const library = loadExerciseLibrary();
    
    // Check if already exists
    const exists = library.find(ex => ex.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    
    library.push({
        id: Date.now(),
        name: name,
        category: category,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0
    });
    
    saveExerciseLibrary(library);
}

function deleteExerciseLibrary(exerciseId) {
    if (!confirm('Delete this exercise from library?')) return;
    
    let library = loadExerciseLibrary();
    library = library.filter(ex => ex.id !== exerciseId);
    saveExerciseLibrary(library);
    renderExerciseLibrary();
}

function initializeExerciseSearch() {
    const searchInput = document.getElementById('exerciseSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderExerciseLibrary(e.target.value);
        });
    }
}
