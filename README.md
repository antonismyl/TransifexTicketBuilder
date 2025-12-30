# Transifex Ticket Builder

A streamlined web application for creating standardized JIRA tickets with intelligent priority scoring.

**Live App:** https://antonismyl.github.io/TransifexTicketBuilder/

## ✨ Features

### Core Functionality
- **Three Report Types:**
  - 🐛 Bug reports with impact assessment
  - 📋 Story requests with detailed documentation
  - 🧮 Quick Score Calculator (score-only mode)

- **Intelligent Priority Scoring:**
  - Automatic calculation based on customer plan, impact, churn risk, and urgency
  - Priority ranges: Trivial (1-19), Low (20-49), Medium (50-99), High (≥100), Severe (blockers)
  - Both score and priority displayed in final output

- **Rich Text Editing:**
  - Markdown support with EasyMDE editor
  - Live preview and side-by-side view
  - Image paste & drag-drop with base64 encoding
  - Auto-expanding text areas

### User Experience
  - Dark/light mode with system preference detection
  - Keyboard navigation support

## 🚀 Quick Start

1. Visit https://antonismyl.github.io/TransifexTicketBuilder/
2. Choose your report type:
   - **Bug Report:** Full documentation with priority scoring
   - **Story Report:** Feature requests with current/expected functionality
   - **Quick Calculator:** Priority score only (no documentation)
3. Follow the step-by-step wizard
4. Copy the generated JIRA template

## 📋 Workflows

### Bug Report (New Ticket)
1. Select "Bug Report" → "Create New Ticket"
2. Complete Due Diligence checklist
3. Enter customer details (name, ARR, plan type, URLs)
4. Answer impact assessment questions
5. Document bug summary, reproduction steps, expected vs actual behavior
6. Review calculated priority and copy template

### Bug Report (Update Ticket)
1. Select "Bug Report" → "Update Existing Ticket"
2. Enter customer details and comment
3. Answer impact assessment questions
4. Add bug summary
5. Copy template to add to existing JIRA ticket

### Story Report
1. Select "Story Report" → "Create New Ticket"
2. Enter customer details and comment
3. Document description, current/expected functionality, timeline
3. Copy template

### Story Report (Update Ticket)
1. Select "Story Report" → "Update Existing Story"
2. Enter customer details and comment
4. Add Story summary
5. Copy template to add to existing JIRA ticket

### Quick Score Calculator
1. Select "Quick Score Calculator"
2. Choose internal/external and plan type
3. Answer impact questions
4. Get instant priority score