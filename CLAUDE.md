# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Transifex Ticket Builder is a static web application that helps create standardized JIRA tickets with automatic priority scoring. It's a pure client-side tool with no backend - all processing happens in the browser.

**Live URL:** https://antonismyl.github.io/TransifexTicketBuilder/

## Architecture

### Single-Page Application Structure

The app uses a multi-step wizard pattern with three main files:
- `index.html` - All UI structure (steps 1-9, modals, navigation)
- `script.js` - All application logic (~2600 lines)
- `styles.css` - Minimal custom styles (Tailwind CDN handles most styling)

### Core Components

**Step Flow:**
1. Report Type Selection (Bug/Story/Quick Calculator)
2. Ticket Type (New/Update) - only for full reports
3. Due Diligence Checklist - only for new tickets
4. Customer Details (name, ARR, plan type, URLs)
5. Impact Assessment (bugs) or Story Documentation
6. Bug Documentation (summary, reproduction steps, expected vs actual)
7. Final Output (calculated priority + JIRA template)

**Quick Calculator Flow:** Steps 8-9 provide a streamlined scoring workflow without documentation.

### State Management

All application state lives in the global `appData` object (script.js:89-121):
- Report configuration (type, internal/external)
- Customer information
- Question responses
- Documentation text
- Image data (base64 encoded)
- Calculated scores and priority

### Key Architecture Patterns

**Markdown Editing:** Uses EasyMDE library for rich text with image paste/drag-drop support. Images are converted to base64 and stored in `appData.images` object with unique IDs.

**Scoring System:**
- Plan type scores: Enterprise+ (5), Growth (4), Starter (3), Open Source (2), Internal (1), Custom (1-5)
- Impact questions contribute points based on severity
- "Blocker" selection auto-assigns "Severe" priority
- Priority thresholds: Trivial (1-19), Low (20-49), Medium (50-99), High (≥100)

**Navigation:** Step-based system with validation before proceeding. Steps 1-2 use button-driven navigation, steps 3+ use Previous/Next buttons. The "Start Fresh" button (top-right) resets the form.

**Security:** All user inputs are sanitized via `sanitizeInput()` and `sanitizeAppData()` functions before template generation to prevent XSS attacks.

## Development

### No Build Process

This is a static site with no build step. Changes to HTML/JS/CSS are immediately effective. Just open `index.html` in a browser or use a simple HTTP server.

### Testing Locally

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Any static file server
# Then visit http://localhost:8000
```

### External Dependencies

All loaded via CDN:
- Tailwind CSS (styling framework)
- EasyMDE (markdown editor)
- Inter font (Google Fonts)

### Dark Mode

Implemented via Tailwind's class-based dark mode. Theme preference stored in localStorage and applied on page load via `initDarkMode()`.

## Common Tasks

### Modifying Priority Scoring

Priority thresholds are in `PRIORITY_THRESHOLDS` constant (script.js:76-81). The scoring logic is in `calculateBugScore()` (script.js:189) and `getPriority()` (script.js:223).

### Adding New Questions

Add to `questions` array (script.js:6-47). Each question needs:
- `id` (unique identifier)
- `text` (question prompt)
- `options` array with `value`, `label`, and `score`

Questions are dynamically rendered in step 5 by `initQuestions()`.

### Updating Templates

Template generation happens in `generateFinalOutput()` (script.js:1344) for full reports and `generateQuickCalculatorOutput()` (script.js:2683) for quick calculator. Templates use markdown formatting for JIRA compatibility.

### Modifying Step Flow

- Update `TOTAL_STEPS` and `STEP_TITLES` constants (script.js:50-59)
- Add/modify step HTML in `index.html`
- Update `showStep()` logic (script.js:702) for step visibility
- Update `validateCurrentStep()` (script.js:258) for step-specific validation
- Update `saveCurrentStepData()` (script.js:1079) to persist form data

## Important Notes

- Image handling: Max 2MB per image, converted to base64, stored in `appData.images`
- Dynamic URL fields: Intercom and Slack URLs can be added/removed dynamically
- Accessibility: Includes skip links, ARIA labels, screen reader announcements, keyboard navigation
- Form validation: Each step validates before allowing progression
- Data persistence: No server-side storage - all data in memory during session