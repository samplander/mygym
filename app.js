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
}

function showWorkoutScreen() {
    document.getElementById('homeScreen').classList.add('d-none');
    document.getElementById('workoutScreen').classList.remove('d-none');
    document.getElementById('historyScreen').classList.add('d-none');
    renderExercises();
    startTimer();
}

function showHistoryScreen() {
    document.getElementById('homeScreen').classList.add('d-none');
    document.getElementById('workoutScreen').classList.add('d-none');
    document.getElementById('historyScreen').classList.remove('d-none');
    renderHistory();
}

// Workout Management
function startWorkout() {
    currentWorkout = {
        id: Date.now(),
        startTime: new Date().toISOString(),
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
    
    const exercise = {
        id: Date.now(),
        name: name,
        collapsed: false,
        detailsHidden: false,
        viewMode: 'planned',
        selectedSetIndex: null,
        sets: []
    };
    
    currentWorkout.exercises.push(exercise);
    saveCurrentWorkout();
    renderExercises();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addExerciseModal'));
    modal.hide();
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
    
    // Get previous set values or use defaults
    const previousSet = exercise.sets[exercise.sets.length - 1];
    const defaultValues = previousSet ? { ...previousSet.planned } : { weight: 0, reps: 0, time: 0 };
    
    const newSet = {
        collapsed: false,
        planned: { ...defaultValues },
        actual: { weight: 0, reps: 0, time: 0 }
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

function selectSet(exerciseId, setIndex) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    exercise.selectedSetIndex = setIndex;
    saveCurrentWorkout();
    renderExercises();
}

function updateValue(exerciseId, setIndex, type, field, change) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise || !exercise.sets[setIndex]) return;
    
    const currentValue = exercise.sets[setIndex][type][field];
    let newValue = currentValue + change;
    
    // Prevent negative values
    if (newValue < 0) newValue = 0;
    
    exercise.sets[setIndex][type][field] = newValue;
    saveCurrentWorkout();
    
    // Update only this specific input
    const inputId = `${type}-${field}-${exerciseId}-${setIndex}`;
    const input = document.getElementById(inputId);
    if (input) input.value = newValue;
}

function handleDirectInput(exerciseId, setIndex, type, field, value) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise || !exercise.sets[setIndex]) return;
    
    let numValue = parseInt(value) || 0;
    if (numValue < 0) numValue = 0;
    
    exercise.sets[setIndex][type][field] = numValue;
    saveCurrentWorkout();
}

// Collapse Management
function toggleExercise(exerciseId) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    exercise.collapsed = !exercise.collapsed;
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

function toggleAllExercises() {
    if (!currentWorkout || currentWorkout.exercises.length === 0) return;
    
    // Check if any exercise is expanded
    const anyExpanded = currentWorkout.exercises.some(ex => !ex.collapsed);
    
    // If any expanded, collapse all. If all collapsed, expand all
    const newState = anyExpanded;
    
    currentWorkout.exercises.forEach(exercise => {
        exercise.collapsed = newState;
    });
    
    saveCurrentWorkout();
    renderExercises();
    
    // Update button text
    const btnText = document.getElementById('toggleAllText');
    const btnIcon = document.querySelector('#toggleAllBtn i');
    if (newState) {
        btnText.textContent = 'Expand All';
        btnIcon.className = 'bi bi-arrows-expand';
    } else {
        btnText.textContent = 'Collapse All';
        btnIcon.className = 'bi bi-arrows-collapse';
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
            <div class="exercise-header" onclick="event.target.closest('.exercise-header').querySelector('.delete-exercise-btn').contains(event.target) || event.target.closest('.exercise-header').querySelector('.toggle-details-btn').contains(event.target) ? null : toggleExercise(${exercise.id})">
                <div class="exercise-header-left">
                    <i class="bi bi-chevron-down chevron ${exercise.collapsed ? 'collapsed' : ''}"></i>
                    <h6>${exercise.name}</h6>
                </div>
                <div class="exercise-header-right">
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
    
    // Initialize swipe detection after rendering
    setTimeout(() => initializeSwipeDetection(), 100);
}

function renderSet(exerciseId, exercise) {
    if (!exercise.sets || exercise.sets.length === 0) {
        return '';
    }
    
    const selectedIndex = exercise.selectedSetIndex ?? 0;
    const selectedSet = exercise.sets[selectedIndex];
    const viewMode = exercise.viewMode || 'planned';
    
    return `
        <!-- Horizontal Set Overview -->
        <div class="sets-overview-container">
            <div class="sets-overview">
                ${exercise.sets.map((set, index) => `
                    <div class="set-card ${index === selectedIndex ? 'selected' : ''}" 
                         onclick="selectSet(${exerciseId}, ${index})">
                        <div class="set-card-number">Set ${index + 1}</div>
                        <div class="set-card-value">${set.planned.weight || 0} × ${set.planned.reps || 0}</div>
                        ${set.actual.weight > 0 || set.actual.reps > 0 ? 
                            `<div class="set-card-actual">✓ ${set.actual.weight} × ${set.actual.reps}</div>` : 
                            '<div class="set-card-pending">—</div>'
                        }
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Current Set Details -->
        <div class="current-set-details ${exercise.detailsHidden ? 'hidden' : ''}" 
             id="set-details-${exerciseId}"
             data-exercise-id="${exerciseId}">
            <div class="current-set-header">
                <span class="current-set-title">Set ${selectedIndex + 1} Details</span>
                <button class="delete-set-btn" onclick="deleteSet(${exerciseId}, ${selectedIndex})">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            
            <!-- View Mode Tabs -->
            <div class="view-mode-tabs">
                <button class="view-tab ${viewMode === 'planned' ? 'active' : ''}" 
                        onclick="toggleViewMode(${exerciseId}, 'planned')">
                    <i class="bi bi-clipboard-check"></i> Planned
                </button>
                <button class="view-tab ${viewMode === 'actual' ? 'active' : ''}" 
                        onclick="toggleViewMode(${exerciseId}, 'actual')">
                    <i class="bi bi-check-circle"></i> Actual
                </button>
            </div>
            
            <!-- View Indicators -->
            <div class="view-indicators">
                <span class="view-dot ${viewMode === 'planned' ? 'active' : ''}"></span>
                <span class="view-dot ${viewMode === 'actual' ? 'active' : ''}"></span>
            </div>
            
            <!-- Copy Button (shown in actual view) -->
            ${viewMode === 'actual' ? `
                <button class="copy-planned-btn" onclick="copyPlannedToActual(${exerciseId}, ${selectedIndex})">
                    <i class="bi bi-arrow-left-right"></i> Copy Planned → Actual
                </button>
            ` : ''}
            
            <!-- Mobile Single Column View -->
            <div class="set-values-mobile" data-view-mode="${viewMode}">
                ${renderMobileValueColumn(exerciseId, selectedIndex, viewMode, selectedSet)}
            </div>
            
            <!-- Desktop Two Column View -->
            <div class="set-values-compact set-values-desktop">
                ${renderCompactValueRow(exerciseId, selectedIndex, 'weight', 'Weight (lbs)', selectedSet, 5)}
                ${renderCompactValueRow(exerciseId, selectedIndex, 'reps', 'Reps', selectedSet, 1)}
                ${renderCompactValueRow(exerciseId, selectedIndex, 'time', 'Time (sec)', selectedSet, 5)}
            </div>
        </div>
    `;
}

function renderMobileValueColumn(exerciseId, setIndex, viewMode, set) {
    const type = viewMode; // 'planned' or 'actual'
    return `
        <div class="mobile-value-row">
            <div class="mobile-value-label">Weight (lbs)</div>
            <div class="mobile-value-controls">
                <button class="btn-control-mobile" onclick="updateValue(${exerciseId}, ${setIndex}, '${type}', 'weight', -5)">−</button>
                <input type="number" 
                       id="${type}-weight-${exerciseId}-${setIndex}"
                       class="value-input-mobile" 
                       value="${set[type].weight}"
                       onchange="handleDirectInput(${exerciseId}, ${setIndex}, '${type}', 'weight', this.value)"
                       inputmode="numeric">
                <button class="btn-control-mobile" onclick="updateValue(${exerciseId}, ${setIndex}, '${type}', 'weight', 5)">+</button>
            </div>
        </div>
        <div class="mobile-value-row">
            <div class="mobile-value-label">Reps</div>
            <div class="mobile-value-controls">
                <button class="btn-control-mobile" onclick="updateValue(${exerciseId}, ${setIndex}, '${type}', 'reps', -1)">−</button>
                <input type="number" 
                       id="${type}-reps-${exerciseId}-${setIndex}"
                       class="value-input-mobile" 
                       value="${set[type].reps}"
                       onchange="handleDirectInput(${exerciseId}, ${setIndex}, '${type}', 'reps', this.value)"
                       inputmode="numeric">
                <button class="btn-control-mobile" onclick="updateValue(${exerciseId}, ${setIndex}, '${type}', 'reps', 1)">+</button>
            </div>
        </div>
        <div class="mobile-value-row">
            <div class="mobile-value-label">Time (sec)</div>
            <div class="mobile-value-controls">
                <button class="btn-control-mobile" onclick="updateValue(${exerciseId}, ${setIndex}, '${type}', 'time', -5)">−</button>
                <input type="number" 
                       id="${type}-time-${exerciseId}-${setIndex}"
                       class="value-input-mobile" 
                       value="${set[type].time}"
                       onchange="handleDirectInput(${exerciseId}, ${setIndex}, '${type}', 'time', this.value)"
                       inputmode="numeric">
                <button class="btn-control-mobile" onclick="updateValue(${exerciseId}, ${setIndex}, '${type}', 'time', 5)">+</button>
            </div>
        </div>
    `;
}

function renderCompactValueRow(exerciseId, setIndex, field, label, set, increment) {
    return `
        <div class="value-row-compact">
            <div class="value-label-compact">${label}</div>
            <div class="value-group-horizontal">
                <div class="value-section-compact">
                    <span class="value-type-compact">P:</span>
                    <div class="value-controls-compact">
                        <button class="btn-control-compact" onclick="updateValue(${exerciseId}, ${setIndex}, 'planned', '${field}', -${increment})">−</button>
                        <input type="number" 
                               id="planned-${field}-${exerciseId}-${setIndex}"
                               class="value-input-compact" 
                               value="${set.planned[field]}"
                               onchange="handleDirectInput(${exerciseId}, ${setIndex}, 'planned', '${field}', this.value)"
                               inputmode="numeric">
                        <button class="btn-control-compact" onclick="updateValue(${exerciseId}, ${setIndex}, 'planned', '${field}', ${increment})">+</button>
                    </div>
                </div>
                <div class="value-section-compact">
                    <span class="value-type-compact">A:</span>
                    <div class="value-controls-compact">
                        <button class="btn-control-compact" onclick="updateValue(${exerciseId}, ${setIndex}, 'actual', '${field}', -${increment})">−</button>
                        <input type="number" 
                               id="actual-${field}-${exerciseId}-${setIndex}"
                               class="value-input-compact" 
                               value="${set.actual[field]}"
                               onchange="handleDirectInput(${exerciseId}, ${setIndex}, 'actual', '${field}', this.value)"
                               inputmode="numeric">
                        <button class="btn-control-compact" onclick="updateValue(${exerciseId}, ${setIndex}, 'actual', '${field}', ${increment})">+</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderValueRow(exerciseId, setIndex, field, label, set, increment) {
    return `
        <div class="value-row">
            <div class="value-label">${label}</div>
            <div class="value-group">
                <div class="value-section">
                    <span class="value-type">Planned</span>
                    <div class="value-controls">
                        <button class="btn-control" onclick="updateValue(${exerciseId}, ${setIndex}, 'planned', '${field}', -${increment})">−</button>
                        <input type="number" 
                               id="planned-${field}-${exerciseId}-${setIndex}"
                               class="value-input" 
                               value="${set.planned[field]}"
                               onchange="handleDirectInput(${exerciseId}, ${setIndex}, 'planned', '${field}', this.value)"
                               inputmode="numeric">
                        <button class="btn-control" onclick="updateValue(${exerciseId}, ${setIndex}, 'planned', '${field}', ${increment})">+</button>
                    </div>
                </div>
                <div class="value-section">
                    <span class="value-type">Actual</span>
                    <div class="value-controls">
                        <button class="btn-control" onclick="updateValue(${exerciseId}, ${setIndex}, 'actual', '${field}', -${increment})">−</button>
                        <input type="number" 
                               id="actual-${field}-${exerciseId}-${setIndex}"
                               class="value-input" 
                               value="${set.actual[field]}"
                               onchange="handleDirectInput(${exerciseId}, ${setIndex}, 'actual', '${field}', this.value)"
                               inputmode="numeric">
                        <button class="btn-control" onclick="updateValue(${exerciseId}, ${setIndex}, 'actual', '${field}', ${increment})">+</button>
                    </div>
                </div>
            </div>
        </div>
    `;
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

// View Mode Toggle & Swipe Detection
function toggleViewMode(exerciseId, mode) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    exercise.viewMode = mode || (exercise.viewMode === 'planned' ? 'actual' : 'planned');
    saveCurrentWorkout();
    renderExercises();
}

function copyPlannedToActual(exerciseId, setIndex) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise || !exercise.sets[setIndex]) return;
    
    const set = exercise.sets[setIndex];
    set.actual.weight = set.planned.weight;
    set.actual.reps = set.planned.reps;
    set.actual.time = set.planned.time;
    
    saveCurrentWorkout();
    renderExercises();
}

// Initialize swipe detection when exercises are rendered
function initializeSwipeDetection() {
    const setDetails = document.querySelectorAll('.current-set-details');
    
    setDetails.forEach(detail => {
        let touchStartX = 0;
        let touchEndX = 0;
        const exerciseId = parseInt(detail.dataset.exerciseId);
        
        detail.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        detail.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe(exerciseId, touchStartX, touchEndX);
        }, { passive: true });
    });
}

function handleSwipe(exerciseId, startX, endX) {
    const swipeThreshold = 50;
    const swipeDistance = endX - startX;
    
    if (Math.abs(swipeDistance) < swipeThreshold) return;
    
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    if (swipeDistance > 0) {
        // Swipe right - go to Planned
        if (exercise.viewMode === 'actual') {
            toggleViewMode(exerciseId, 'planned');
            vibrateDevice(10);
        }
    } else {
        // Swipe left - go to Actual
        if (exercise.viewMode === 'planned') {
            toggleViewMode(exerciseId, 'actual');
            vibrateDevice(10);
        }
    }
}

function vibrateDevice(duration) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

// LocalStorage
function saveCurrentWorkout() {
    localStorage.setItem('currentWorkout', JSON.stringify(currentWorkout));
}

function loadCurrentWorkout() {
    const saved = localStorage.getItem('currentWorkout');
    if (saved) {
        currentWorkout = JSON.parse(saved);
    }
}

// History Management
function renderHistory() {
    const container = document.getElementById('historyContent');
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-clock-history"></i>
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
                                <div class="set-col-planned">Planned</div>
                                <div class="set-col-actual">Actual</div>
                                <div class="set-col-status">Status</div>
                            </div>
                            ${exercise.sets.map((set, index) => {
                                const setStatus = getSetStatus(set);
                                return `
                                <div class="sets-table-row ${setStatus.class}">
                                    <div class="set-col-number">${index + 1}</div>
                                    <div class="set-col-planned">
                                        ${set.planned.weight}lbs × ${set.planned.reps}
                                        ${set.planned.time > 0 ? `<span class="set-time">${set.planned.time}s</span>` : ''}
                                    </div>
                                    <div class="set-col-actual">
                                        ${set.actual.weight}lbs × ${set.actual.reps}
                                        ${set.actual.time > 0 ? `<span class="set-time">${set.actual.time}s</span>` : ''}
                                    </div>
                                    <div class="set-col-status">
                                        <span class="status-icon" title="${setStatus.title}">
                                            <i class="bi bi-${setStatus.icon}"></i> ${setStatus.arrow}
                                        </span>
                                    </div>
                                </div>
                                ${setStatus.completed ? `
                                    <div class="set-progress-bar">
                                        <div class="set-progress-fill" style="width: ${setStatus.percentage}%"></div>
                                    </div>
                                ` : ''}
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
    let plannedVolume = 0;
    let heaviestSet = { weight: 0, exercise: '', reps: 0 };
    let mostVolumeExercise = { name: '', volume: 0 };
    let perfectExercises = [];
    
    workout.exercises.forEach(exercise => {
        let exerciseVolume = 0;
        let exercisePerfect = true;
        
        exercise.sets.forEach(set => {
            totalSets++;
            const actualVol = set.actual.weight * set.actual.reps;
            const plannedVol = set.planned.weight * set.planned.reps;
            
            totalVolume += actualVol;
            plannedVolume += plannedVol;
            exerciseVolume += actualVol;
            
            if (set.actual.weight > 0 || set.actual.reps > 0) {
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
            text: `All Targets Hit: ${perfectExercises[0]}${perfectExercises.length > 1 ? ` +${perfectExercises.length - 1} more` : ''}`
        });
    }
    
    return {
        totalSets,
        completedSets,
        completionRate,
        totalVolume,
        plannedVolume,
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

function getSetStatus(set) {
    const actualVol = set.actual.weight * set.actual.reps;
    const plannedVol = set.planned.weight * set.planned.reps;
    
    if (actualVol === 0) {
        return { 
            class: 'set-missed', 
            icon: 'x-circle-fill', 
            arrow: '', 
            title: 'Not completed',
            completed: false,
            percentage: 0
        };
    }
    
    const percentage = plannedVol > 0 ? Math.round((actualVol / plannedVol) * 100) : 100;
    
    if (actualVol > plannedVol) {
        return { 
            class: 'set-exceeded', 
            icon: 'check-circle-fill', 
            arrow: '↑', 
            title: 'Exceeded target',
            completed: true,
            percentage: Math.min(percentage, 150)
        };
    } else if (actualVol === plannedVol) {
        return { 
            class: 'set-matched', 
            icon: 'check-circle-fill', 
            arrow: '→', 
            title: 'Target hit',
            completed: true,
            percentage: 100
        };
    } else {
        return { 
            class: 'set-partial', 
            icon: 'exclamation-circle-fill', 
            arrow: '↓', 
            title: 'Below target',
            completed: true,
            percentage
        };
    }
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
            viewMode: 'planned',
            selectedSetIndex: 0,
            sets: exercise.sets.map(set => ({
                collapsed: false,
                planned: { ...set.actual }, // Use previous actual as new planned
                actual: { weight: 0, reps: 0, time: 0 }
            }))
        }))
    };
    
    saveCurrentWorkout();
    showWorkoutScreen();
    
    alert('Template loaded! Adjust values as needed.');
}
