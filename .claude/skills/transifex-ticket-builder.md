# Transifex Ticket Builder — Full Flow Skill

Use this skill whenever asked to modify, debug, extend, or understand the Transifex Ticket Builder app.

## Architecture at a Glance

Three files, no build step:
- `index.html` — all UI (steps 1–9, modals, navigation)
- `script.js` — all logic (~2600 lines)
- `styles.css` — minimal overrides (Tailwind CDN handles most styling)

Run locally with: `python -m http.server 8000`, then open `http://localhost:8000`.

## Step Flow

### Full Bug Report (steps 1 → 7)
1. **Report Type** — Bug / Story / Quick Calculator
2. **Ticket Type** — New / Update (skipped for Quick Calc)
3. **Due Diligence** — checklist for new tickets only
4. **Customer Details** — name, ARR, plan, Intercom/Slack URLs, comment
5. **Impact Assessment** — 4 scored questions (impact, urgency, scope, workaround)
6. **Documentation** — bug summary, steps to reproduce, expected vs actual (EasyMDE)
7. **Final Report** — calculated priority + JIRA template

### Story Report
Same as bug but step 5 collects story description / current vs expected / timeline, and step 6 is skipped.

### Quick Calculator (steps 8–9)
Streamlined: customer details → score questions → result. No documentation step.

## State: `appData` object (`script.js:98`)

Key fields:
```
reportType        'bug' | 'story'
isQuickCalc       boolean
ticketType        'new' | 'update'
reportSource      'external' | 'prospect' | 'internal'
customerName, monthlyARR, planType, customPlanScore
intercomURLs[], slackURLs[]   (dynamic, multi-value)
questionsAnswered {}          (keyed by question id)
bugSummary, stepsToReproduce, expectedVsActual
storyDescription, currentVsExpected, timelineContext
calculatedScore, priority
images {}                     (base64, keyed by unique id)
```

## Scoring System

### Plan scores (`PLAN_SCORES`, `script.js:64`)
| Plan | Score |
|------|-------|
| Enterprise+ | 10 |
| Growth | 7 |
| Starter | 5 |
| Open Source / Prospect | 3–5 |
| Internal | 1 |
| Custom | 1–5 (slider) |

### Impact questions (`questions`, `script.js:6`)
Four questions, each with lettered options and a point value:
- **impact** — A=50, B=35, C=20, D=10, E=5
- **urgency** — A=40, B=25, C=20, D=5
- **scope** — A=30, B=20, C=10, D=5
- **workaround** — A=20, B=15, C=8, D=3

### Priority calculation
`calculateBugScore()` at `script.js:189`, `getPriority()` at `script.js:223`.

Thresholds (`PRIORITY_THRESHOLDS`, `script.js:74`):
- Score ≥ 100 OR "blocker" selected → **Severe**
- 50–99 → **High** (Medium threshold)
- 20–49 → **Medium** (Low threshold)
- 1–19 → **Low / Trivial**

Display scores are multiplied by `PRIORITY_DISPLAY_MULTIPLIERS` (per level), capped at `MAX_SCORE_FOR_DISPLAY = 500`.

## Key Functions

| Task | Function | Location |
|------|----------|----------|
| Show/hide steps | `showStep()` | `script.js:702` |
| Validate before Next | `validateCurrentStep()` | `script.js:258` |
| Persist form data | `saveCurrentStepData()` | `script.js:1079` |
| Render impact questions | `initQuestions()` | dynamic, step 5 |
| Generate JIRA template (full) | `generateFinalOutput()` | `script.js:1344` |
| Generate JIRA template (quick) | `generateQuickCalculatorOutput()` | `script.js:2683` |
| Reset entire form | "Start Fresh" button | top-right corner |
| Dark mode toggle | `initDarkMode()` | localStorage-backed |

## Common Modifications

### Add a new impact question
1. Append an entry to `questions` array (`script.js:6`).  
   Fields: `id` (unique string), `text`, `options[]` with `value`, `label`, `score`.
2. Questions are rendered dynamically — no HTML change needed.

### Change priority thresholds
Edit `PRIORITY_THRESHOLDS` at `script.js:74`.

### Update JIRA template output
- Full report: `generateFinalOutput()` at `script.js:1344`
- Quick calc: `generateQuickCalculatorOutput()` at `script.js:2683`

### Add a new wizard step
1. Add step HTML in `index.html` (follow existing step pattern).
2. Increment `TOTAL_STEPS` and add a title to `STEP_TITLES` (`script.js:50`).
3. Update `showStep()` (`script.js:702`) for visibility logic.
4. Update `validateCurrentStep()` (`script.js:258`) for validation.
5. Update `saveCurrentStepData()` (`script.js:1079`) to persist new fields.

### Add a new plan type
Add an entry to `PLAN_SCORES` (`script.js:64`) and add the matching `<option>` in the plan-type `<select>` in `index.html`.

## Security Notes

All user inputs go through `sanitizeInput()` / `sanitizeAppData()` before template generation to prevent XSS. Always route new inputs through these functions.

## Image Handling

- Paste or drag-drop into EasyMDE editors.
- Max 2 MB per image, stored as base64 in `appData.images` with a unique ID.
- IDs are embedded in markdown as `![img](image-id)` and resolved at output time.

## Accessibility

- Skip links, ARIA labels, screen-reader announcements, keyboard navigation already implemented.
- Preserve these when adding new UI elements.
