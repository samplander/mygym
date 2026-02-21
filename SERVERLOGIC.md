# Coach API — Server Logic Reference

This document describes the Coach API endpoint that integrates with the MyGym app. The server lives in the `/server` folder at the root of the project.

---

## Overview

The Coach API is a Node.js Express server that accepts the app's full localStorage data, sends it to Claude for analysis, and returns a fully populated `currentWorkout` object ready to be written back to localStorage.

**Stack:** Node.js, Express, @anthropic-ai/sdk

---

## File Structure

```
/server
├── server.js          # Express server + /api/coach endpoint
├── transform.js       # Data transformation (strip UI state, build workout, patch library)
├── prompt.js          # System prompt builder + coaching modes + tool schema
├── .env.example       # Environment variables template
├── package.json       # Dependencies
└── README.md          # Setup and usage docs
```

---

## API Contract

### `POST /api/coach`

#### Request Body

```json
{
  "workoutHistory": [],
  "exerciseLibrary": [],
  "categoryConfig": [],
  "preferences": {
    "mode": "progressive_overload",
    "timeAvailable": 60,
    "injuries": "left shoulder sore",
    "notes": "want to focus on back today"
  }
}
```

| Field | Type | Required | Source |
|-------|------|----------|--------|
| `workoutHistory` | `WorkoutHistory[]` | No | `localStorage.getItem('workoutHistory')` parsed as JSON |
| `exerciseLibrary` | `ExerciseLibraryItem[]` | **Yes** | `localStorage.getItem('exerciseLibrary')` parsed as JSON |
| `categoryConfig` | `Category[]` | No | `localStorage.getItem('categoryConfig')` parsed as JSON |
| `preferences` | `object` | No | User-provided session preferences (see below) |

**Preferences Object:**

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `string` | Coaching mode: `progressive_overload` (default), `weight_loss`, `strength`, `fitness` |
| `timeAvailable` | `number` | Available training time in minutes |
| `injuries` | `string` | Current injuries or soreness to work around |
| `notes` | `string` | Free-text notes or requests for the session |

#### Response Body

```json
{
  "currentWorkout": { ... },
  "exerciseLibrary": [...] | null,
  "rationale": "Based on your last 3 sessions...",
  "focus": "Pull",
  "estimatedMinutes": 55
}
```

| Field | Type | Description |
|-------|------|-------------|
| `currentWorkout` | `CurrentWorkout` | Fully populated workout object, ready to write to `localStorage.setItem('currentWorkout', ...)` |
| `exerciseLibrary` | `ExerciseLibraryItem[] \| null` | Updated library if coach introduced new exercises. `null` if no changes — do NOT overwrite localStorage if null. |
| `rationale` | `string` | Coach's explanation of why this session was designed this way. Display this to the user in the UI. |
| `focus` | `string` | Session focus label (e.g. "Push", "Pull", "Upper Body") |
| `estimatedMinutes` | `number` | Estimated session duration in minutes |

#### Error Responses

| Status | Body | Meaning |
|--------|------|---------|
| `400` | `{ "error": "exerciseLibrary is required" }` | Missing required field |
| `429` | `{ "error": "Rate limited — try again in a moment" }` | Anthropic API rate limit hit |
| `500` | `{ "error": "Failed to generate workout", "message": "..." }` | Server or API error |

### `GET /api/health`

Returns server status and available coaching modes.

```json
{
  "status": "ok",
  "modes": [
    { "key": "progressive_overload", "name": "Progressive Overload" },
    { "key": "weight_loss", "name": "Weight Loss" },
    { "key": "strength", "name": "Strength" },
    { "key": "fitness", "name": "General Fitness" }
  ]
}
```

---

## Frontend Integration

### What the frontend needs to do

1. **Add a "Coach" button** to the UI (e.g. on the home screen or before starting a new workout)
2. **On tap**, collect all localStorage data and POST it to the coach endpoint
3. **On success**, write the returned `currentWorkout` to localStorage, optionally update `exerciseLibrary`, and display the `rationale` to the user
4. **On error**, show an appropriate message to the user

### Client-Side Function

```javascript
async function getCoachWorkout(preferences = {}) {
  const API_URL = 'http://localhost:3001'; // Update for production

  const payload = {
    workoutHistory: JSON.parse(localStorage.getItem('workoutHistory') || '[]'),
    exerciseLibrary: JSON.parse(localStorage.getItem('exerciseLibrary') || '[]'),
    categoryConfig: JSON.parse(localStorage.getItem('categoryConfig') || '[]'),
    preferences: preferences,
  };

  const response = await fetch(`${API_URL}/api/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get coaching');
  }

  const data = await response.json();

  // 1. Write the populated workout to localStorage
  localStorage.setItem('currentWorkout', JSON.stringify(data.currentWorkout));

  // 2. Update exercise library ONLY if coach added new exercises
  if (data.exerciseLibrary) {
    localStorage.setItem('exerciseLibrary', JSON.stringify(data.exerciseLibrary));
  }

  // 3. Return rationale and metadata for UI display
  return {
    rationale: data.rationale,
    focus: data.focus,
    estimatedMinutes: data.estimatedMinutes,
  };
}
```

### Usage Example

```javascript
// Simple — no preferences
const result = await getCoachWorkout({ mode: 'progressive_overload' });
showRationale(result.rationale);
renderCurrentWorkout(); // Re-render to show the new session

// With constraints
const result = await getCoachWorkout({
  mode: 'progressive_overload',
  timeAvailable: 45,
  injuries: 'left shoulder sore',
  notes: 'focus on legs today',
});
```

---

## How the currentWorkout is Populated

The server returns a `CurrentWorkout` object that matches the existing app schema exactly:

- **`id`** — set to `Date.now()` at generation time
- **`startTime`** — set to current ISO timestamp
- **`accordionMode`** — set to `true`
- **`exercises[]`** — each exercise has all UI state fields populated with defaults:
  - `collapsed`: `true` (except first exercise which is `false`)
  - `detailsHidden`: `false`
  - `showPrevious`: `true`
  - `selectedSetIndex`: `null`
  - `timeMode`: from coach response (true for time-based exercises like planks)
- **`exercises[].sets[]`** — each set has:
  - `collapsed`: `false`
  - `completed`: `false`
  - `planned`: populated with coach's prescribed values `{ weight, reps, time }`
  - `actual`: populated with the **same values** as planned (user adjusts during session)

**Important:** Both `planned` and `actual` are populated with identical values. The user modifies `actual` during the session. When the planned/actual UI split is implemented later, `planned` will already contain the coach's original prescription for comparison.

---

## How the Exercise Library is Patched

If the coach suggests an exercise that doesn't exist in the user's library:

1. The server checks the coach's exercise list against the existing library (case-insensitive match)
2. New exercises are created with:
   - `name`: from coach response
   - `category`: from coach response (validated against existing categories, defaults to "Uncategorized")
   - `createdAt`: current timestamp
   - `lastUsed`: `null`
   - `usageCount`: `0`
3. The full updated library is returned in the response
4. If no new exercises were needed, `exerciseLibrary` in the response is `null`

**Frontend rule:** Only overwrite `exerciseLibrary` in localStorage when the response value is not `null`.

---

## Server Processing Pipeline

For reference, this is what happens inside the server on each request:

```
Request received
    │
    ▼
1. VALIDATE — check exerciseLibrary exists
    │
    ▼
2. TRANSFORM — strip UI state from all data (transform.js)
   - Remove: collapsed, detailsHidden, selectedSetIndex, showPrevious, id, accordionMode
   - Keep: exercise names, sets (planned + actual), weights, reps, times, dates, categories
    │
    ▼
3. BUILD PROMPT — construct system prompt with coaching mode (prompt.js)
   - Inject coaching mode instructions (progressive_overload, weight_loss, etc.)
   - Build user message with: constraints, categories, exercise library, workout history
    │
    ▼
4. CALL CLAUDE — single API call with forced tool use
   - Model: claude-sonnet-4-20250514
   - tool_choice forces the generate_workout tool (guaranteed structured output)
   - No agent loop needed — all data is in the single prompt
    │
    ▼
5. BUILD RESPONSE — map LLM output back to app schema (transform.js)
   - Create valid CurrentWorkout with all UI state defaults
   - Populate planned + actual with identical values
   - Patch exercise library if new exercises were introduced
    │
    ▼
6. RETURN — { currentWorkout, exerciseLibrary, rationale, focus, estimatedMinutes }
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Anthropic API key |
| `PORT` | No | `3001` | Server port |

### CORS

The server currently allows all origins (`*`). For production, update the CORS config in `server.js` to restrict to your app's domain.

---

## Running the Server

```bash
cd server
npm install
export ANTHROPIC_API_KEY=your-key-here   # or set in .env
node server.js
```

Server starts on `http://localhost:3001`.

---

## Future Considerations

- **Coaching modes** are extensible — add new modes in the `COACHING_MODES` object in `prompt.js`
- **The preferences object** is open-ended — new fields can be added without breaking existing functionality
- **If data grows beyond localStorage limits**, the architecture supports migrating to a database without changing the API contract — only the data source in the frontend integration function changes
- **The agent loop pattern** (multi-step tool calling) can be introduced later if the coach needs to do deeper analysis that requires multiple data queries
