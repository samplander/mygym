# ─── Coach API ─────────────────────────────────────────────
# Personal training assistant powered by Claude
# ───────────────────────────────────────────────────────────

## Setup

```bash
npm install
export ANTHROPIC_API_KEY=your-key-here
node server.js
```

## Endpoint

### `POST /api/coach`

Send your full localStorage data, get back a populated workout.

**Request:**
```json
{
  "workoutHistory": [...],
  "exerciseLibrary": [...],
  "categoryConfig": [...],
  "preferences": {
    "mode": "progressive_overload",
    "timeAvailable": 60,
    "injuries": "left shoulder sore",
    "notes": "want to focus on back today"
  }
}
```

**Response:**
```json
{
  "currentWorkout": { ... },
  "exerciseLibrary": [...] | null,
  "rationale": "Based on your last 3 sessions...",
  "focus": "Pull",
  "estimatedMinutes": 55
}
```

**App integration:**
```javascript
// In your gym app
async function getCoachWorkout() {
  const response = await fetch('http://localhost:3001/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workoutHistory: JSON.parse(localStorage.getItem('workoutHistory') || '[]'),
      exerciseLibrary: JSON.parse(localStorage.getItem('exerciseLibrary') || '[]'),
      categoryConfig: JSON.parse(localStorage.getItem('categoryConfig') || '[]'),
      preferences: {
        mode: 'progressive_overload',
        timeAvailable: 60,
      }
    })
  });

  const data = await response.json();

  // Write the populated workout
  localStorage.setItem('currentWorkout', JSON.stringify(data.currentWorkout));

  // Update exercise library if coach added new exercises
  if (data.exerciseLibrary) {
    localStorage.setItem('exerciseLibrary', JSON.stringify(data.exerciseLibrary));
  }

  // Display the rationale to the user
  showRationale(data.rationale);
}
```

### `GET /api/health`

Returns available coaching modes.

## Coaching Modes

| Mode | Key | Description |
|------|-----|-------------|
| Progressive Overload | `progressive_overload` | Systematically increase stimulus over time (default) |
| Weight Loss | `weight_loss` | Fat loss while preserving muscle |
| Strength | `strength` | Maximise 1RM on compound lifts |
| General Fitness | `fitness` | Balanced strength, endurance, mobility |

## Architecture

```
App (localStorage) ──POST──► Server (transform.js) ──► Claude API
                                                            │
App (localStorage) ◄──JSON──── Server (transform.js) ◄─────┘
```

1. App sends full localStorage dump + preferences
2. `transform.js` strips UI state, reduces to training data only
3. `prompt.js` builds system prompt with selected coaching mode
4. Claude returns structured workout via tool use
5. `transform.js` maps response back to app-compatible `CurrentWorkout`
6. Exercise library patched with any new exercises
7. App writes to localStorage and renders
