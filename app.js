// State Management
let currentWorkout = null;
let timerInterval = null;

// Coach API Configuration
const COACH_API_URL = 'https://mygym-b733e99f8879.herokuapp.com';
const COACH_API_KEY = '0616851c50ff903bd26b9f57f61f100131337b7ad415f777e695a8c45e4e172f'; // Change this to match your server's API_KEY

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
    document.getElementById('coachWorkoutBtn').addEventListener('click', () => generateCoachWorkout());
    document.getElementById('startWorkoutBtn').addEventListener('click', startWorkout);
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
    
    // Initialize autocomplete
    initializeAutocomplete();
    
    // Initialize category dropdowns
    populateCategoryDropdowns();
    
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

// Volume Heatmap Rendering
function generateHeatmapData() {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const heatmapData = [];
    const today = new Date();
    
    // Generate last 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Find workouts for this date
        const dayWorkouts = history.filter(workout => {
            if (!workout.completedAt) return false;
            const workoutDate = new Date(workout.completedAt);
            workoutDate.setHours(0, 0, 0, 0);
            return workoutDate.toISOString().split('T')[0] === dateStr;
        });
        
        // Calculate total volume and category breakdown for the day
        let totalVolume = 0;
        const categoryBreakdown = {};
        
        dayWorkouts.forEach(workout => {
            workout.exercises.forEach(exercise => {
                const category = getCategoryForExercise(exercise.name);
                exercise.sets.forEach(set => {
                    const volume = (set.actual?.weight || 0) * (set.actual?.reps || 0);
                    totalVolume += volume;
                    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + volume;
                });
            });
        });
        
        heatmapData.push({
            date: date,
            dateStr: dateStr,
            volume: totalVolume,
            workoutCount: dayWorkouts.length,
            categoryBreakdown: categoryBreakdown
        });
    }
    
    return heatmapData;
}

function getVolumeIntensity(volume, maxVolume) {
    if (volume === 0) return 0;
    if (maxVolume === 0) return 1;
    
    const percentage = (volume / maxVolume) * 100;
    
    if (percentage >= 75) return 4; // Highest intensity
    if (percentage >= 50) return 3;
    if (percentage >= 25) return 2;
    return 1; // Lowest intensity (but not zero)
}

function buildCategoryGradient(categoryBreakdown, totalVolume) {
    if (totalVolume === 0 || Object.keys(categoryBreakdown).length === 0) {
        return null;
    }
    
    // Sort categories by volume descending
    const sorted = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
    
    let gradientParts = [];
    let currentPercent = 0;
    
    sorted.forEach(([category, volume]) => {
        const percent = (volume / totalVolume) * 100;
        const color = getCategoryColor(category);
        const endPercent = currentPercent + percent;
        
        gradientParts.push(`${color} ${currentPercent.toFixed(1)}% ${endPercent.toFixed(1)}%`);
        currentPercent = endPercent;
    });
    
    return `linear-gradient(to right, ${gradientParts.join(', ')})`;
}

function buildCategoryTooltip(categoryBreakdown, totalVolume) {
    if (totalVolume === 0) return '';
    
    const sorted = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
    return sorted.map(([cat, vol]) => {
        const pct = ((vol / totalVolume) * 100).toFixed(0);
        return `${cat} ${pct}%`;
    }).join(', ');
}

function renderVolumeHeatmap() {
    const container = document.getElementById('volumeHeatmap');
    if (!container) return;
    
    const heatmapData = generateHeatmapData();
    const maxVolume = Math.max(...heatmapData.map(d => d.volume));
    
    // Calculate total stats
    const totalWorkouts = heatmapData.reduce((sum, d) => sum + d.workoutCount, 0);
    const totalVolume = heatmapData.reduce((sum, d) => sum + d.volume, 0);
    
    // Collect unique categories used in the 30-day period
    const usedCategories = new Set();
    heatmapData.forEach(day => {
        Object.keys(day.categoryBreakdown).forEach(cat => usedCategories.add(cat));
    });
    
    // Day labels (M, W, F for compact view)
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    // Build grid HTML
    let gridHTML = '<div class="heatmap-grid">';
    
    heatmapData.forEach((day, index) => {
        const dayOfWeek = day.date.getDay();
        const dayLabel = dayLabels[dayOfWeek];
        const monthDay = day.date.getDate();
        const isToday = day.dateStr === new Date().toISOString().split('T')[0];
        
        // Build tooltip with category breakdown
        let tooltipText = `${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n${formatVolume(day.volume)}`;
        if (day.workoutCount > 0) {
            tooltipText += ` (${day.workoutCount} workout${day.workoutCount > 1 ? 's' : ''})`;
            const catBreakdown = buildCategoryTooltip(day.categoryBreakdown, day.volume);
            if (catBreakdown) tooltipText += `\n${catBreakdown}`;
        } else {
            tooltipText += ' (No workout)';
        }
        
        // Build gradient for workout days
        const gradient = buildCategoryGradient(day.categoryBreakdown, day.volume);
        const cellStyle = gradient ? `style="background: ${gradient}"` : '';
        const cellClass = gradient ? '' : 'heatmap-level-0';
        
        gridHTML += `
            <div class="heatmap-cell ${cellClass} ${isToday ? 'heatmap-today' : ''}"
                 ${cellStyle}
                 title="${tooltipText}"
                 data-volume="${day.volume}"
                 data-date="${day.dateStr}">
            </div>
        `;
    });
    
    gridHTML += '</div>';
    
    // Build compact legend for categories used
    let legendHTML = '';
    if (usedCategories.size > 0) {
        const legendItems = Array.from(usedCategories).map(cat => {
            const color = getCategoryColor(cat);
            return `<span class="heatmap-legend-item"><span class="heatmap-legend-swatch" style="background:${color}"></span>${cat}</span>`;
        }).join('');
        legendHTML = `<div class="heatmap-legend">${legendItems}</div>`;
    }
    
    // Summary stats
    const summaryHTML = `
        <div class="heatmap-summary">
            ${totalWorkouts} workout${totalWorkouts !== 1 ? 's' : ''} • ${formatVolume(totalVolume)}
        </div>
    `;
    
    container.innerHTML = `
        <div class="heatmap-header">
            <h6 class="heatmap-title">Last 30 Days</h6>
        </div>
        ${gridHTML}
        ${legendHTML}
        ${summaryHTML}
    `;
}

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
        const originalText = coachBtnText.textContent;
        coachBtn.disabled = true;
        coachBtnText.textContent = 'Generating...';
        
        // Gather localStorage data
        const workoutHistory = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
        const exerciseLibrary = JSON.parse(localStorage.getItem('exerciseLibrary') || '[]');
        const categoryConfig = JSON.parse(localStorage.getItem('categoryConfig') || '[]');
        
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
        coachBtnText.textContent = originalText;
        
    } catch (error) {
        // Reset button state
        const coachBtn = document.getElementById('coachWorkoutBtn');
        const coachBtnText = document.getElementById('coachBtnText');
        coachBtn.disabled = false;
        coachBtnText.textContent = 'AI Coach Workout';
        
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
                'X-API-Key': COACH_API_KEY
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
        localStorage.setItem('exerciseLibrary', JSON.stringify(exerciseLibrary));
    }
    
    // Show rationale modal before entering workout
    showCoachRationaleModal(rationale, focus, estimatedMinutes);
}

function showCoachRationaleModal(rationale, focus, estimatedMinutes) {
    // Populate modal content
    document.getElementById('rationaleFocus').textContent = focus;
    document.getElementById('rationaleDuration').textContent = `~${estimatedMinutes} min`;
    document.getElementById('rationaleText').textContent = rationale;
    
    // Show modal
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
                    <button class="exercise-history-btn" onclick="event.stopPropagation(); showExerciseHistory('${exercise.name.replace(/'/g, "\\'")}')" title="View exercise history">
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

    //get category of exercise
    const library = loadExerciseLibrary();
    const exerciseInLibrary = library.find(ex => ex.name.toLowerCase() === exercise.name.toLowerCase());
    const category = exerciseInLibrary ? exerciseInLibrary.category : null;

    // Filter library for exercises in the same category (or all if no category)
    const candidates = category ? library.filter(ex => ex.category === category && ex.name.toLowerCase() !== exercise.name.toLowerCase()) : library.filter(ex => ex.name.toLowerCase() !== exercise.name.toLowerCase());
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

        //get category of exercise
    const library = loadExerciseLibrary();
    const exerciseInLibrary = library.find(ex => ex.name.toLowerCase() === exercise.name.toLowerCase());
    const category = exerciseInLibrary ? exerciseInLibrary.category : null;
    const candidates = category ? library.filter(ex => ex.category === category && ex.name.toLowerCase() !== exercise.name.toLowerCase()) : library.filter(ex => ex.name.toLowerCase() !== exercise.name.toLowerCase());

    const container = document.getElementById('swapOptionsContainer');
    container.innerHTML = candidates.map(candidate => `
        <div class="swap-option" onclick="performSwap(${exerciseId}, '${candidate.name.replace(/'/g, "\\'")}')">
            <h6>${candidate.name}</h6>
        </div>
    `).join('');
}

function performSwap(exerciseId, newName) {
    const exercise = currentWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    exercise.name = newName;
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
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    
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
        
        return `
            <div class="data-browser-item" onclick="selectWorkoutToEdit(${w.id})">
                <div class="data-browser-item-info">
                    <div class="data-browser-item-title">${date}</div>
                    <div class="data-browser-item-subtitle">${exerciseCount} exercises • ${duration}</div>
                </div>
                <div class="data-browser-item-actions">
                    <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteHistoryItem(${w.id})">
                        <i class="bi bi-trash"></i>
                    </button>
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
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
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
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
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
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
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
    
    let history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
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
    
    localStorage.setItem('workoutHistory', JSON.stringify(history));
    
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
    
    let history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    history = history.filter(w => w.id !== workoutId);
    localStorage.setItem('workoutHistory', JSON.stringify(history));
    
    renderDataBrowserContent();
}

function deleteHistoryExercise(exerciseIndex) {
    if (!confirm('Delete this exercise and all its sets?')) return;
    
    let history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const workoutIdx = history.findIndex(w => w.id === dataBrowserState.workoutId);
    
    if (workoutIdx === -1) return;
    
    history[workoutIdx].exercises.splice(exerciseIndex, 1);
    localStorage.setItem('workoutHistory', JSON.stringify(history));
    
    renderDataBrowserContent();
}

function deleteHistorySet(setIndex) {
    if (!confirm('Delete this set?')) return;
    
    let history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const workoutIdx = history.findIndex(w => w.id === dataBrowserState.workoutId);
    
    if (workoutIdx === -1) return;
    
    const exercise = history[workoutIdx].exercises[dataBrowserState.exerciseIndex];
    if (!exercise || !exercise.sets) return;
    
    exercise.sets.splice(setIndex, 1);
    localStorage.setItem('workoutHistory', JSON.stringify(history));
    
    getRecordEditorModal().hide();
    renderDataBrowserContent();
}

// ===== EXPORT / IMPORT =====

function exportAllData() {
    const data = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        currentWorkout: JSON.parse(localStorage.getItem('currentWorkout') || 'null'),
        workoutHistory: JSON.parse(localStorage.getItem('workoutHistory') || '[]'),
        exerciseLibrary: JSON.parse(localStorage.getItem('exerciseLibrary') || '[]')
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

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate structure
            if (!data.workoutHistory && !data.exerciseLibrary && !data.currentWorkout) {
                alert('Invalid backup file: missing data keys');
                return;
            }
            
            if (!confirm('This will replace all your current data. Continue?')) return;
            
            if (data.workoutHistory) {
                localStorage.setItem('workoutHistory', JSON.stringify(data.workoutHistory));
            }
            if (data.exerciseLibrary) {
                localStorage.setItem('exerciseLibrary', JSON.stringify(data.exerciseLibrary));
            }
            if (data.currentWorkout !== undefined) {
                if (data.currentWorkout === null) {
                    localStorage.removeItem('currentWorkout');
                    currentWorkout = null;
                } else {
                    localStorage.setItem('currentWorkout', JSON.stringify(data.currentWorkout));
                    currentWorkout = data.currentWorkout;
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
    const stored = localStorage.getItem('categoryConfig');
    if (stored) {
        return JSON.parse(stored);
    }
    return [...DEFAULT_CATEGORIES];
}

function saveCategoryConfig(categories) {
    localStorage.setItem('categoryConfig', JSON.stringify(categories));
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

let categoryBreakdownModal = null;
let breakdownDateRange = { start: null, end: null };

function getCategoryBreakdownModal() {
    if (!categoryBreakdownModal) {
        categoryBreakdownModal = new bootstrap.Modal(document.getElementById('categoryBreakdownModal'));
    }
    return categoryBreakdownModal;
}

function getCategoryForExercise(exerciseName) {
    const library = loadExerciseLibrary();
    const exercise = library.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
    return exercise?.category || 'Uncategorized';
}

function calculateCategoryBreakdown(startDate, endDate) {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const categories = {};
    let totalVolume = 0;
    let workoutCount = 0;
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    history.forEach(workout => {
        const workoutDate = new Date(workout.startTime);
        if (workoutDate < start || workoutDate > end) return;
        
        workoutCount++;
        
        workout.exercises?.forEach(exercise => {
            const category = getCategoryForExercise(exercise.name);
            
            exercise.sets?.forEach(set => {
                // Only count completed sets
                const isCompleted = set.completed !== undefined ? set.completed : 
                    (set.actual?.weight > 0 || set.actual?.reps > 0 || set.actual?.time > 0);
                
                if (!isCompleted) return;
                
                const weight = set.actual?.weight || 0;
                const reps = set.actual?.reps || 1;
                const volume = weight * reps;
                
                categories[category] = (categories[category] || 0) + volume;
                totalVolume += volume;
            });
        });
    });
    
    return { categories, totalVolume, workoutCount };
}

function renderCategoryChart(breakdownData) {
    const donut = document.getElementById('categoryDonut');
    const { categories, totalVolume } = breakdownData;
    
    if (totalVolume === 0) {
        donut.style.background = '#374151';
        document.getElementById('donutTotalVolume').textContent = '0';
        return;
    }
    
    // Sort categories by volume descending
    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    
    // Build conic-gradient
    let gradientParts = [];
    let currentDeg = 0;
    
    sorted.forEach(([category, volume]) => {
        const percentage = volume / totalVolume;
        const degrees = percentage * 360;
        const color = getCategoryColor(category);
        
        gradientParts.push(`${color} ${currentDeg}deg ${currentDeg + degrees}deg`);
        currentDeg += degrees;
    });
    
    donut.style.background = `conic-gradient(${gradientParts.join(', ')})`;
    document.getElementById('donutTotalVolume').textContent = formatVolume(totalVolume);
}

function renderCategoryLegend(breakdownData) {
    const legend = document.getElementById('categoryLegend');
    const { categories, totalVolume } = breakdownData;
    
    if (totalVolume === 0) {
        legend.innerHTML = '<p class="text-muted text-center">No data for this period</p>';
        return;
    }
    
    // Sort categories by volume descending
    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    
    legend.innerHTML = sorted.map(([category, volume]) => {
        const percentage = ((volume / totalVolume) * 100).toFixed(1);
        const color = getCategoryColor(category);
        
        return `
            <div class="legend-item">
                <span class="legend-swatch" style="background: ${color}"></span>
                <span class="legend-label">${category}</span>
                <span class="legend-value">${percentage}% (${formatVolume(volume)} kg)</span>
            </div>`;
    }).join('');
}

function renderBreakdownSummary(breakdownData) {
    const summary = document.getElementById('breakdownSummary');
    const { workoutCount, totalVolume } = breakdownData;
    
    summary.innerHTML = `
        <div class="summary-stat">
            <span class="summary-value">${workoutCount}</span>
            <span class="summary-label">Workouts</span>
        </div>
        <div class="summary-stat">
            <span class="summary-value">${formatVolume(totalVolume)}</span>
            <span class="summary-label">Total Volume (kg)</span>
        </div>`;
}

function formatVolume(volume) {
    if (volume >= 1000) {
        return (volume / 1000).toFixed(1) + 'k';
    }
    return Math.round(volume).toLocaleString();
}

function showCategoryBreakdown() {
    // Default to last 7 days
    setDateRange(7);
    getCategoryBreakdownModal().show();
}

function setDateRange(days) {
    // Update active button
    document.querySelectorAll('.date-range-btn').forEach(btn => btn.classList.remove('active'));
    event?.target?.classList.add('active');
    
    // Hide custom range
    document.getElementById('customDateRange').classList.add('d-none');
    
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    
    breakdownDateRange = { start, end };
    refreshBreakdown();
}

function toggleCustomDateRange() {
    document.querySelectorAll('.date-range-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const customRange = document.getElementById('customDateRange');
    customRange.classList.toggle('d-none');
    
    // Set default dates if empty
    const startInput = document.getElementById('breakdownStartDate');
    const endInput = document.getElementById('breakdownEndDate');
    
    if (!startInput.value) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        startInput.value = weekAgo.toISOString().split('T')[0];
    }
    if (!endInput.value) {
        endInput.value = new Date().toISOString().split('T')[0];
    }
}

function applyCustomDateRange() {
    const start = document.getElementById('breakdownStartDate').value;
    const end = document.getElementById('breakdownEndDate').value;
    
    if (!start || !end) {
        alert('Please select both start and end dates');
        return;
    }
    
    breakdownDateRange = { start: new Date(start), end: new Date(end) };
    refreshBreakdown();
}

function refreshBreakdown() {
    const { start, end } = breakdownDateRange;
    const breakdownData = calculateCategoryBreakdown(start, end);
    
    renderCategoryChart(breakdownData);
    renderCategoryLegend(breakdownData);
    renderBreakdownSummary(breakdownData);
}
