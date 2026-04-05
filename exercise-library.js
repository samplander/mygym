(function () {
    let selectedAutocompleteIndex = -1;

    function getDefaultExercises() {
        return [
            { id: Date.now(), name: 'Bench Press', category: 'Push', createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
            { id: Date.now() + 1, name: 'Squats', category: 'Legs', createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
            { id: Date.now() + 2, name: 'Deadlift', category: 'Pull', createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
            { id: Date.now() + 3, name: 'Overhead Press', category: 'Push', createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 },
            { id: Date.now() + 4, name: 'Pull-ups', category: 'Pull', createdAt: new Date().toISOString(), lastUsed: null, usageCount: 0 }
        ];
    }

    function loadExerciseLibrary() {
        return MyGymStorage.loadExerciseLibrary(getDefaultExercises());
    }

    function saveExerciseLibrary(library) {
        return MyGymStorage.saveExerciseLibrary(library, getDefaultExercises());
    }

    function renderExerciseLibrary(searchQuery = '') {
        const library = loadExerciseLibrary();
        const container = document.getElementById('exerciseLibraryList');

        if (!container) return;

        const filtered = searchQuery
            ? library.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : library;

        const sorted = filtered.sort((a, b) => {
            if (b.usageCount !== a.usageCount) {
                return b.usageCount - a.usageCount;
            }
            return a.name.localeCompare(b.name);
        });

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
        let propagationResult = null;

        if (!name) {
            alert('Please enter an exercise name');
            return { saved: false, propagationResult };
        }

        let library = loadExerciseLibrary();

        if (id) {
            const index = library.findIndex(ex => ex.id == id);
            if (index !== -1) {
                const previousExercise = { ...library[index] };
                library[index].name = name;
                library[index].category = category;
                saveExerciseLibrary(library);
                propagationResult = MyGymExerciseIdentity.propagateExerciseLibraryChange({
                    libraryExerciseId: library[index].id,
                    oldName: previousExercise.name,
                    newName: name,
                    newCategory: category
                });
                console.info('Exercise propagation result:', propagationResult);
            }
        } else {
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

        renderExerciseLibrary();

        const modal = bootstrap.Modal.getInstance(document.getElementById('exerciseLibraryModal'));
        modal.hide();

        return { saved: true, propagationResult };
    }

    function initializeAutocomplete() {
        const input = document.getElementById('exerciseNameInput');
        const addToLibraryCheckbox = document.getElementById('addToLibraryCheckbox');
        const addToLibraryContainer = document.getElementById('addToLibraryContainer');
        const categorySelectContainer = document.getElementById('categorySelectContainer');

        if (!input) return;

        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();

            if (value.length === 0) {
                hideAutocomplete();
                addToLibraryContainer.style.display = 'none';
                return;
            }

            showAutocompleteSuggestions(value);
        });

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
            } else if (e.key === 'Escape') {
                hideAutocomplete();
            }
        });

        if (addToLibraryCheckbox) {
            addToLibraryCheckbox.addEventListener('change', (e) => {
                categorySelectContainer.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container')) {
                hideAutocomplete();
            }
        });

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

        const filtered = library
            .filter(ex => ex.name.toLowerCase().includes(searchText.toLowerCase()))
            .sort((a, b) => {
                if (a.usageCount !== b.usageCount) {
                    return b.usageCount - a.usageCount;
                }
                if (a.lastUsed && b.lastUsed) {
                    return new Date(b.lastUsed) - new Date(a.lastUsed);
                }
                if (a.lastUsed && !b.lastUsed) return -1;
                if (!a.lastUsed && b.lastUsed) return 1;
                return a.name.localeCompare(b.name);
            });

        selectedAutocompleteIndex = -1;

        if (filtered.length === 0) {
            dropdown.style.display = 'none';
            addToLibraryContainer.style.display = 'block';
            autocompleteHint.style.display = 'block';
        } else {
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

        if (typeof window.saveExercise === 'function') {
            window.saveExercise();
        }
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

    function updateExerciseUsage(exerciseName, exerciseLibraryId = null) {
        const library = loadExerciseLibrary();
        const exercise = exerciseLibraryId != null
            ? MyGymExerciseIdentity.findLibraryExerciseById(library, exerciseLibraryId)
            : MyGymExerciseIdentity.findLibraryExerciseByName(library, exerciseName);

        if (exercise) {
            exercise.usageCount = (exercise.usageCount || 0) + 1;
            exercise.lastUsed = new Date().toISOString();
            saveExerciseLibrary(library);
        }
    }

    function addExerciseToLibrary(name, category = '') {
        const library = loadExerciseLibrary();
        const exists = MyGymExerciseIdentity.findLibraryExerciseByName(library, name);
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

    window.MyGymExerciseLibrary = {
        loadExerciseLibrary,
        saveExerciseLibrary,
        getDefaultExercises,
        renderExerciseLibrary,
        showAddExerciseLibraryModal,
        editExerciseLibrary,
        saveExerciseLibraryItem,
        initializeAutocomplete,
        showAutocompleteSuggestions,
        updateAutocompleteSelection,
        selectSuggestion,
        hideAutocomplete,
        highlightMatch,
        formatLastUsed,
        updateExerciseUsage,
        addExerciseToLibrary,
        deleteExerciseLibrary,
        initializeExerciseSearch
    };
})();
