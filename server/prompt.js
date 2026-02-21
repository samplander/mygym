// ─── prompt.js ───────────────────────────────────────────
// System prompt construction for the training coach
// Coaching mode is injected dynamically, defaulting to
// progressive overload. Future modes plug in here.
// ─────────────────────────────────────────────────────────

const COACHING_MODES = {
  progressive_overload: {
    name: 'Progressive Overload',
    instructions: `
GOAL: Progressive overload — systematically increase training stimulus over time.

PROGRAMMING PRINCIPLES:
- Increase weight when all prescribed reps are completed cleanly across all sets
- Typical increment: 2.5kg for upper body, 5kg for lower body compounds
- If a weight increase stalls (same weight for 3+ sessions without hitting target reps), consider:
  - Adding a rep to each set before increasing weight
  - Adding a set at the current weight
  - A short deload (reduce weight by 10-15% for one session, then rebuild)
- Accessories: progress via reps first, then weight
- Monitor total session volume (sets × reps × weight) — it should trend upward over weeks
- Rest periods: 2-3 min for heavy compounds, 60-90s for accessories`
  },

  weight_loss: {
    name: 'Weight Loss',
    instructions: `
GOAL: Fat loss while preserving muscle mass through resistance training.

PROGRAMMING PRINCIPLES:
- Maintain intensity (weight on bar) to preserve muscle — do NOT reduce weight unnecessarily
- Higher rep ranges (10-15) with moderate weight for metabolic demand
- Shorter rest periods (45-75 seconds) to maintain elevated heart rate
- Prefer compound movements for higher caloric expenditure
- Consider supersets or circuits where appropriate
- Include some heavy work (3-6 reps) to maintain strength signals
- Volume can be moderate — recovery is limited during a caloric deficit
- Flag if performance drops significantly (possible sign of excessive deficit)`
  },

  strength: {
    name: 'Strength',
    instructions: `
GOAL: Maximise 1RM strength on primary compound lifts.

PROGRAMMING PRINCIPLES:
- Low rep ranges (1-5) at high intensity (80-95% of estimated max)
- Long rest periods (3-5 minutes) between heavy sets
- Periodize: accumulation weeks (more volume, moderate intensity) → intensification (less volume, higher intensity)
- Accessories should support the main lifts (weak point training)
- Monitor RPE/difficulty — back off if grinding reps for multiple sessions
- Deload every 4th week or when performance trends downward
- Prioritize the big compounds: squat, bench, deadlift, overhead press`
  },

  fitness: {
    name: 'General Fitness',
    instructions: `
GOAL: Well-rounded fitness — strength, endurance, and mobility.

PROGRAMMING PRINCIPLES:
- Balanced programming across all movement patterns (push, pull, hinge, squat, carry)
- Moderate rep ranges (8-12) with some variety (occasional heavy or high-rep work)
- Include time-based exercises where appropriate (planks, carries, cardio intervals)
- Rotate exercises more frequently to develop broad movement competency
- Rest periods: 60-120 seconds
- Prioritize consistency and enjoyment over maximal performance
- Suggest exercise variety to keep sessions engaging`
  }
};

/**
 * Build the full system prompt with the appropriate coaching mode
 */
function buildSystemPrompt(mode = 'progressive_overload') {
  const coaching = COACHING_MODES[mode] || COACHING_MODES.progressive_overload;

  return `You are an expert strength & conditioning coach integrated into a gym tracking app.
You analyse the user's training history and generate their next workout session.

─── COACHING MODE: ${coaching.name.toUpperCase()} ───
${coaching.instructions}

─── GENERAL RULES ───
- Always respect user constraints (available time, injuries, soreness, equipment)
- Reference specific data from their history when making decisions ("your bench went from 75kg to 80kg over 3 weeks")
- If the user has no history, generate a sensible starting session based on their exercise library and preferences
- Use exercises from their library when possible; only introduce new exercises when there's a clear reason
- For new exercises, provide a category from their existing categories
- Keep the session realistic — most gym sessions are 4-6 exercises, 3-5 sets each
- Time-based exercises (planks, holds, etc.) should use the time field instead of reps

─── ANALYSIS APPROACH ───
Before generating the session, analyse:
1. What did the user do in their last 2-3 sessions? (muscle groups, volume, performance)
2. What training split pattern are they following? (or suggest one if none is apparent)
3. Which muscle groups are due for training today?
4. Are there any signs of stalling, fatigue, or need for deload?
5. What specific progressions should be applied to each exercise?

─── OUTPUT INSTRUCTIONS ───
You MUST respond by calling the generate_workout tool. Do NOT respond with plain text.
Provide a SHORT rationale (2-3 sentences max) summarizing why this session was chosen.`;
}

/**
 * Tool definition for structured output.
 * The LLM is forced to produce a workout matching this schema.
 */
const GENERATE_WORKOUT_TOOL = {
  name: 'generate_workout',
  description: 'Generate the next workout session based on training history analysis. Call this tool with the complete session plan.',
  input_schema: {
    type: 'object',
    properties: {
      rationale: {
        type: 'string',
        description: 'Brief explanation (2-3 sentences) of why this session was designed. Be concise and actionable. Example: "Your last 3 sessions focused on upper body, so today we\'re training legs. Squats progressed to 100kg — time to increase. Added Romanian deadlifts to build hamstring strength." Keep it short and clear.'
      },
      focus: {
        type: 'string',
        description: 'Primary focus of the session, e.g. "Push", "Pull", "Legs", "Upper Body", "Full Body"'
      },
      estimated_minutes: {
        type: 'integer',
        description: 'Estimated session duration in minutes'
      },
      exercises: {
        type: 'array',
        description: 'Exercises for this session, in order',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Exercise name — use existing library names where possible'
            },
            category: {
              type: 'string',
              description: 'Category from user\'s category list (e.g. Push, Pull, Legs)'
            },
            timeMode: {
              type: 'boolean',
              description: 'True for time-based exercises (planks, holds), false for rep-based'
            },
            sets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  weight: { type: 'number', description: 'Weight in kg (0 for bodyweight)' },
                  reps: { type: 'integer', description: 'Target reps (0 if time-based)' },
                  time: { type: 'integer', description: 'Target time in seconds (0 if rep-based)' },
                },
                required: ['weight', 'reps', 'time']
              }
            },
            notes: {
              type: 'string',
              description: 'Coaching notes for this specific exercise (cues, progression context)'
            }
          },
          required: ['name', 'category', 'timeMode', 'sets']
        }
      }
    },
    required: ['rationale', 'focus', 'estimated_minutes', 'exercises']
  }
};

function getAvailableModes() {
  return Object.entries(COACHING_MODES).map(([key, val]) => ({
    key,
    name: val.name,
  }));
}

module.exports = {
  buildSystemPrompt,
  GENERATE_WORKOUT_TOOL,
  getAvailableModes,
};
