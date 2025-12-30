// State Management
let currentWorkout = null;
let timerInterval = null;

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
            <span class="stat-value">${daysSinceLastWorkout}</span>
            <span class="stat-label">${daysSinceLastWorkout === 1 ? 'Day Ago' : 'Days Ago'}</span>
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
            <div class="exercise-header" onclick="event.target.closest('.exercise-header').querySelector('.delete-exercise-btn').contains(event.target) ? null : toggleExercise(${exercise.id})">
                <div class="exercise-header-left">
                    <i class="bi bi-chevron-down chevron ${exercise.collapsed ? 'collapsed' : ''}"></i>
                    <h6>${exercise.name}</h6>
                </div>
                <button class="delete-exercise-btn" onclick="event.stopPropagation(); deleteExercise(${exercise.id})">
                    <i class="bi bi-trash"></i>
                </button>
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
    
    const selectedIndex = exercise.selectedSetIndex ?? 0;
    const selectedSet = exercise.sets[selectedIndex];
    
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
        <div class="current-set-details">
            <div class="current-set-header">
                <span class="current-set-title">Set ${selectedIndex + 1} Details</span>
                <button class="delete-set-btn" onclick="deleteSet(${exerciseId}, ${selectedIndex})">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            
            <div class="set-values-compact">
                ${renderCompactValueRow(exerciseId, selectedIndex, 'weight', 'Weight (lbs)', selectedSet, 5)}
                ${renderCompactValueRow(exerciseId, selectedIndex, 'reps', 'Reps', selectedSet, 1)}
                ${renderCompactValueRow(exerciseId, selectedIndex, 'time', 'Time (sec)', selectedSet, 5)}
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
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    document.getElementById('workoutDetailTitle').textContent = dateStr;
    
    const startTime = new Date(workout.startTime);
    const endTime = workout.endTime ? new Date(workout.endTime) : null;
    const durationStr = formatDuration(workout.duration || 0);
    
    const detailsHtml = `
        <div class="workout-detail-meta">
            <div class="detail-item">
                <i class="bi bi-stopwatch"></i>
                <strong>Duration:</strong> ${durationStr}
            </div>
            <div class="detail-item">
                <i class="bi bi-clock"></i>
                <strong>Started:</strong> ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
            ${endTime ? `
                <div class="detail-item">
                    <i class="bi bi-check-circle"></i>
                    <strong>Completed:</strong> ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
            ` : ''}
        </div>
        
        <div class="workout-detail-exercises">
            ${workout.exercises.map(exercise => `
                <div class="detail-exercise-card">
                    <div class="detail-exercise-header">
                        <strong>${exercise.name}</strong>
                        <span class="badge bg-primary">${exercise.sets.length} sets</span>
                    </div>
                    <div class="detail-sets">
                        ${exercise.sets.map((set, index) => `
                            <div class="detail-set-row">
                                <span class="detail-set-number">Set ${index + 1}</span>
                                <div class="detail-set-values">
                                    <span class="detail-planned">P: ${set.planned.weight}lbs × ${set.planned.reps}${set.planned.time > 0 ? ` (${set.planned.time}s)` : ''}</span>
                                    <span class="detail-actual">A: ${set.actual.weight}lbs × ${set.actual.reps}${set.actual.time > 0 ? ` (${set.actual.time}s)` : ''}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
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
