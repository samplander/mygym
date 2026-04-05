(function () {
    let categoryBreakdownModal = null;
    let breakdownDateRange = { start: null, end: null };

    function getCurrentWorkoutState() {
        return window.MyGymAppState?.getCurrentWorkout?.() || null;
    }

    function setCurrentWorkoutState(workout) {
        return window.MyGymAppState?.setCurrentWorkout?.(workout);
    }

    function saveCurrentWorkoutState() {
        return window.MyGymAppState?.saveCurrentWorkout?.();
    }

    function renderQuickStats() {
        const history = loadWorkoutHistory();
        const statsContainer = document.getElementById('quickStats');

        if (!statsContainer) return;

        if (history.length === 0) {
            statsContainer.innerHTML = '';
            return;
        }

        const totalWorkouts = history.length;
        const lastWorkout = history[0];
        const daysSinceLastWorkout = Math.floor((Date.now() - new Date(lastWorkout.completedAt).getTime()) / (1000 * 60 * 60 * 24));
        const totalSets = history.reduce((sum, workout) => sum + (workout.totalSets || 0), 0);
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

    function generateHeatmapData() {
        const history = loadWorkoutHistory();
        const heatmapData = [];
        const today = new Date();

        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const dateStr = date.toISOString().split('T')[0];
            const dayWorkouts = history.filter(workout => {
                if (!workout.completedAt) return false;
                const workoutDate = new Date(workout.completedAt);
                workoutDate.setHours(0, 0, 0, 0);
                return workoutDate.toISOString().split('T')[0] === dateStr;
            });

            let totalVolume = 0;
            const categoryBreakdown = {};

            dayWorkouts.forEach(workout => {
                workout.exercises.forEach(exercise => {
                    const category = getCategoryForExercise(exercise);
                    exercise.sets.forEach(set => {
                        const volume = (set.actual?.weight || 0) * (set.actual?.reps || 0);
                        totalVolume += volume;
                        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + volume;
                    });
                });
            });

            heatmapData.push({
                date,
                dateStr,
                volume: totalVolume,
                workoutCount: dayWorkouts.length,
                categoryBreakdown
            });
        }

        return heatmapData;
    }

    function getVolumeIntensity(volume, maxVolume) {
        if (volume === 0) return 0;
        if (maxVolume === 0) return 1;

        const percentage = (volume / maxVolume) * 100;
        if (percentage >= 75) return 4;
        if (percentage >= 50) return 3;
        if (percentage >= 25) return 2;
        return 1;
    }

    function buildCategoryGradient(categoryBreakdown, totalVolume) {
        if (totalVolume === 0 || Object.keys(categoryBreakdown).length === 0) {
            return null;
        }

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
        const totalWorkouts = heatmapData.reduce((sum, d) => sum + d.workoutCount, 0);
        const totalVolume = heatmapData.reduce((sum, d) => sum + d.volume, 0);
        const usedCategories = new Set();

        heatmapData.forEach(day => {
            Object.keys(day.categoryBreakdown).forEach(cat => usedCategories.add(cat));
        });

        let gridHTML = '<div class="heatmap-grid">';

        heatmapData.forEach(day => {
            const isToday = day.dateStr === new Date().toISOString().split('T')[0];
            let tooltipText = `${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n${formatVolume(day.volume)}`;

            if (day.workoutCount > 0) {
                tooltipText += ` (${day.workoutCount} workout${day.workoutCount > 1 ? 's' : ''})`;
                const catBreakdown = buildCategoryTooltip(day.categoryBreakdown, day.volume);
                if (catBreakdown) tooltipText += `\n${catBreakdown}`;
            } else {
                tooltipText += ' (No workout)';
            }

            const gradient = buildCategoryGradient(day.categoryBreakdown, day.volume);
            const cellStyle = gradient ? `style="background: ${gradient}"` : '';
            const cellClass = gradient ? '' : `heatmap-level-${getVolumeIntensity(day.volume, maxVolume)}`;

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

        let legendHTML = '';
        if (usedCategories.size > 0) {
            const legendItems = Array.from(usedCategories).map(cat => {
                const color = getCategoryColor(cat);
                return `<span class="heatmap-legend-item"><span class="heatmap-legend-swatch" style="background:${color}"></span>${cat}</span>`;
            }).join('');
            legendHTML = `<div class="heatmap-legend">${legendItems}</div>`;
        }

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

    function renderHistory() {
        const container = document.getElementById('historyContent');
        const history = loadWorkoutHistory();

        if (!container) return;

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

        container.innerHTML = history.map(workout => {
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
        const history = loadWorkoutHistory();
        const workout = history.find(w => w.id === workoutId);
        if (!workout) return;

        const modal = new bootstrap.Modal(document.getElementById('workoutDetailModal'));
        const date = new Date(workout.startTime);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
        document.getElementById('workoutDetailTitle').textContent = dateStr;

        const stats = calculateWorkoutStats(workout);
        const detailsHtml = `
            <div class="detail-stats-header">
                <div class="detail-stat-card">
                    <i class="bi bi-stopwatch"></i>
                    <div class="detail-stat-value">${formatDuration(workout.duration || 0)}</div>
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

        return { totalSets, completedSets, completionRate, totalVolume, highlights };
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
        const avgWeight = exercise.sets.length > 0 ? Math.round(exercise.sets.reduce((sum, s) => sum + s.actual.weight, 0) / exercise.sets.length) : 0;
        const avgReps = exercise.sets.length > 0 ? Math.round(exercise.sets.reduce((sum, s) => sum + s.actual.reps, 0) / exercise.sets.length) : 0;

        return {
            allCompleted,
            summary: `${completedSets}/${exercise.sets.length} sets • ${avgWeight}lbs × ${avgReps} avg • ${formatVolume(totalVolume)}`
        };
    }

    function getExerciseHistory(exerciseName) {
        const history = loadWorkoutHistory();
        const exerciseHistory = [];
        const reference = typeof exerciseName === 'string' ? { name: exerciseName } : exerciseName;
        const library = loadExerciseLibrary();
        const resolvedName = MyGymExerciseIdentity.resolveExerciseDisplayName(reference, library, reference?.name || 'Exercise');

        history.forEach(workout => {
            const exercise = workout.exercises.find(ex => MyGymExerciseIdentity.matchesExerciseReference(ex, reference));
            if (exercise && exercise.sets.length > 0) {
                exerciseHistory.push({
                    workoutDate: new Date(workout.completedAt),
                    completedAt: workout.completedAt,
                    duration: workout.duration,
                    exerciseName: MyGymExerciseIdentity.resolveExerciseDisplayName(exercise, library, resolvedName),
                    sets: exercise.sets.map(set => ({ actual: { ...set.actual } })),
                    timeMode: exercise.timeMode || false
                });
            }
        });

        exerciseHistory.sort((a, b) => a.workoutDate - b.workoutDate);
        return exerciseHistory;
    }

    function showExerciseHistory(exerciseName) {
        const history = getExerciseHistory(exerciseName);
        const modal = new bootstrap.Modal(document.getElementById('exerciseHistoryModal'));
        const titleEl = document.getElementById('exerciseHistoryTitle');
        const bodyEl = document.getElementById('exerciseHistoryBody');
        const library = loadExerciseLibrary();

        titleEl.textContent = MyGymExerciseIdentity.resolveExerciseDisplayName(
            typeof exerciseName === 'string' ? { name: exerciseName } : exerciseName,
            library,
            typeof exerciseName === 'string' ? exerciseName : exerciseName?.name || 'Exercise History'
        );

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

        let html = '<div class="exercise-history-list">';

        history.forEach(session => {
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
                    const minutes = Math.floor(set.actual.time / 60);
                    const seconds = set.actual.time % 60;
                    setDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                } else if (set.actual.weight > 0 || set.actual.reps > 0) {
                    setDisplay = `${set.actual.weight}kg × ${set.actual.reps}`;
                } else {
                    setDisplay = '<span class="text-muted">Not completed</span>';
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

    function showCurrentWorkoutExerciseHistory(exerciseId) {
        const exercise = getCurrentWorkoutState()?.exercises?.find(ex => ex.id === exerciseId);
        if (!exercise) return;
        showExerciseHistory(exercise);
    }

    function getSetStatus(set) {
        const actualVol = set.actual.weight * set.actual.reps;
        const completed = actualVol > 0 || set.actual.time > 0;

        return {
            class: completed ? 'set-completed' : 'set-missed',
            icon: completed ? 'check-circle-fill' : 'x-circle-fill',
            arrow: '',
            title: completed ? 'Completed' : 'Not completed',
            completed,
            percentage: completed ? 100 : 0
        };
    }

    function formatVolume(volume) {
        if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'k';
        }
        return Math.round(volume).toLocaleString();
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

        let history = loadWorkoutHistory();
        history = history.filter(w => w.id !== workoutId);
        saveWorkoutHistory(history);
        renderHistory();
    }

    function clearAllHistory() {
        if (!confirm('Delete ALL workout history? This cannot be undone!')) return;
        clearWorkoutHistory();
        renderHistory();
    }

    function useAsTemplate(workoutId) {
        const history = loadWorkoutHistory();
        const workout = history.find(w => w.id === workoutId);
        if (!workout) return;

        setCurrentWorkoutState({
            id: Date.now(),
            startTime: new Date().toISOString(),
            exercises: workout.exercises.map(exercise => ({
                id: Date.now() + Math.random(),
                name: exercise.name,
                category: exercise.category || '',
                exerciseLibraryId: exercise.exerciseLibraryId ?? null,
                collapsed: false,
                detailsHidden: false,
                selectedSetIndex: 0,
                sets: exercise.sets.map(set => ({
                    collapsed: false,
                    planned: { ...set.actual },
                    actual: { ...set.actual }
                }))
            }))
        });

        saveCurrentWorkoutState();
        showWorkoutScreen();
        alert('Template loaded! Adjust values as needed.');
    }

    function getCategoryBreakdownModal() {
        if (!categoryBreakdownModal) {
            categoryBreakdownModal = new bootstrap.Modal(document.getElementById('categoryBreakdownModal'));
        }
        return categoryBreakdownModal;
    }

    function getCategoryForExercise(exerciseName) {
        const library = loadExerciseLibrary();
        const record = exerciseName && typeof exerciseName === 'object' ? exerciseName : { name: exerciseName };
        return MyGymExerciseIdentity.resolveExerciseCategory(record, library, 'Uncategorized');
    }

    function calculateCategoryBreakdown(startDate, endDate) {
        const history = loadWorkoutHistory();
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
                const category = getCategoryForExercise(exercise);
                exercise.sets?.forEach(set => {
                    const isCompleted = set.completed !== undefined ? set.completed : (set.actual?.weight > 0 || set.actual?.reps > 0 || set.actual?.time > 0);
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
        if (!donut) return;

        if (totalVolume === 0) {
            donut.style.background = '#374151';
            document.getElementById('donutTotalVolume').textContent = '0';
            return;
        }

        const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
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
        if (!legend) return;

        if (totalVolume === 0) {
            legend.innerHTML = '<p class="text-muted text-center">No data for this period</p>';
            return;
        }

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
        if (!summary) return;

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

    function showCategoryBreakdown() {
        setDateRange(7);
        getCategoryBreakdownModal().show();
    }

    function setDateRange(days) {
        document.querySelectorAll('.date-range-btn').forEach(btn => btn.classList.remove('active'));
        event?.target?.classList.add('active');
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

    window.MyGymHistoryReporting = {
        renderQuickStats,
        generateHeatmapData,
        getVolumeIntensity,
        buildCategoryGradient,
        buildCategoryTooltip,
        renderVolumeHeatmap,
        renderHistory,
        formatDuration,
        viewWorkoutDetail,
        calculateWorkoutStats,
        calculateExerciseStats,
        getExerciseHistory,
        showExerciseHistory,
        showCurrentWorkoutExerciseHistory,
        getSetStatus,
        formatVolume,
        getPerformanceBadgeClass,
        toggleDetailExercise,
        deleteWorkout,
        clearAllHistory,
        useAsTemplate,
        getCategoryBreakdownModal,
        getCategoryForExercise,
        calculateCategoryBreakdown,
        renderCategoryChart,
        renderCategoryLegend,
        renderBreakdownSummary,
        showCategoryBreakdown,
        setDateRange,
        toggleCustomDateRange,
        applyCustomDateRange,
        refreshBreakdown
    };
})();
