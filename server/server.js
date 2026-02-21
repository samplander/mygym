// ─── server.js ───────────────────────────────────────────
// Coach API — Personal training assistant endpoint
// POST /api/coach → returns a populated currentWorkout
// ─────────────────────────────────────────────────────────

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk').default;
const { transformForLLM, buildCurrentWorkout, patchExerciseLibrary } = require('./transform');
const { buildSystemPrompt, GENERATE_WORKOUT_TOOL, getAvailableModes } = require('./prompt');

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS — adjust origin for your app's domain
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const client = new Anthropic();  // Uses ANTHROPIC_API_KEY env var

// ─── Health check ────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', modes: getAvailableModes() });
});

// ─── Main coaching endpoint ──────────────────────────────
app.post('/api/coach', async (req, res) => {
  try {
    const {
      workoutHistory,
      exerciseLibrary,
      categoryConfig,
      preferences,          // { timeAvailable, injuries, notes, mode }
    } = req.body;

    // Validate minimum payload
    if (!exerciseLibrary || !Array.isArray(exerciseLibrary)) {
      return res.status(400).json({
        error: 'exerciseLibrary is required'
      });
    }

    const mode = preferences?.mode || 'progressive_overload';

    // ── Step 1: Transform data for the LLM ───────────────
    const llmData = transformForLLM({
      workoutHistory,
      exerciseLibrary,
      categoryConfig,
      preferences,
    });

    // ── Step 2: Build the user message ───────────────────
    const userMessage = buildUserMessage(llmData);

    // ── Step 3: Call Claude ──────────────────────────────
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: buildSystemPrompt(mode),
      tools: [GENERATE_WORKOUT_TOOL],
      tool_choice: { type: 'tool', name: 'generate_workout' },
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    // ── Step 4: Extract the tool call result ─────────────
    const toolUse = response.content.find(b => b.type === 'tool_use');

    if (!toolUse || toolUse.name !== 'generate_workout') {
      return res.status(500).json({
        error: 'Coach did not generate a workout',
        debug: response.content
      });
    }

    const coachOutput = toolUse.input;

    // ── Step 5: Build app-compatible currentWorkout ──────
    const currentWorkout = buildCurrentWorkout(coachOutput);

    // ── Step 6: Patch exercise library if needed ─────────
    const updatedLibrary = patchExerciseLibrary(
      exerciseLibrary,
      coachOutput.exercises,
      categoryConfig
    );

    // ── Step 7: Return the response ─────────────────────
    res.json({
      currentWorkout,
      exerciseLibrary: updatedLibrary,  // null if no changes
      rationale: coachOutput.rationale,
      focus: coachOutput.focus,
      estimatedMinutes: coachOutput.estimated_minutes,
    });

  } catch (err) {
    console.error('Coach error:', err);

    if (err?.status === 429) {
      return res.status(429).json({ error: 'Rate limited — try again in a moment' });
    }

    res.status(500).json({
      error: 'Failed to generate workout',
      message: err.message
    });
  }
});

// ─── Build the user message with all training data ───────
function buildUserMessage(data) {
  const parts = [];

  // Preferences / constraints
  if (data.preferences) {
    const prefs = [];
    if (data.preferences.timeAvailable) prefs.push(`Time available: ${data.preferences.timeAvailable} minutes`);
    if (data.preferences.injuries) prefs.push(`Injuries/soreness: ${data.preferences.injuries}`);
    if (data.preferences.notes) prefs.push(`Notes: ${data.preferences.notes}`);
    if (prefs.length > 0) {
      parts.push(`USER CONSTRAINTS:\n${prefs.join('\n')}`);
    }
  }

  // Categories
  parts.push(`AVAILABLE CATEGORIES:\n${data.categories.join(', ')}`);

  // Exercise library
  parts.push(`EXERCISE LIBRARY:\n${JSON.stringify(data.exercises, null, 2)}`);

  // Workout history
  if (data.history.length > 0) {
    parts.push(`WORKOUT HISTORY (most recent first, ${data.history.length} sessions):\n${JSON.stringify(data.history, null, 2)}`);
  } else {
    parts.push('WORKOUT HISTORY: No previous sessions recorded. This is a first session — design an appropriate starting workout.');
  }

  parts.push('Generate my next training session.');

  return parts.join('\n\n');
}

// ─── Start server ────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Coach API running on port ${PORT}`);
  console.log(`Available modes: ${getAvailableModes().map(m => m.key).join(', ')}`);
  console.log(`API Key loaded: ${process.env.ANTHROPIC_API_KEY ? '✓ YES' : '✗ NO'}`);
});
