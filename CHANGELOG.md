# Changelog

All notable changes to the Transifex Ticket Builder will be documented in this file.

## [1.3.0] - 2025-09-24

### Added
- Fixed "Start Fresh" button in top-right corner for easy form reset
- Automatic "Severe" priority assignment when "This is a blocker" option is selected

### Changed
- Updated priority score ranges: Trivial (1-19), Low (20-49), Medium (50-99), High (≥100)
- Removed form reset confirmation dialogs for seamless navigation
- Users can now navigate back through steps without losing data

### Fixed
- Navigation flow no longer interrupts user workflow with unexpected confirmations

## [1.2.0] - 2025-09-22

### Added
- Rich text editing with EasyMDE markdown editor for all text fields
- Due Diligence step (Step 3) with quality control checkboxes for new tickets
- Interactive help tooltips for due diligence requirements
- Auto-expanding text areas and improved editor experience
- Enhanced dark theme support for EasyMDE components
- Image drag & drop and paste support integrated with markdown editor

### Changed
- Expanded from 6-step to 7-step workflow to accommodate Due Diligence
- Updated container widths for better content layout (max-w-2xl → max-w-4xl)
- Improved button colors from bright green to muted emerald tones
- Enhanced tooltip positioning (now appears on right side of help buttons)

### Fixed
- Dark theme EasyMDE toolbar icons now properly visible
- Prevented duplicate image pasting in text editors
- Fixed step navigation validation for new workflow
- Corrected HTML step IDs for proper page transitions

## [1.1.0] - 2025-09-17

### Added
- Custom plan score input field (1-5) for custom plan types
- Plan score reference context panel showing other plan scores
- Real-time error feedback with toast notifications
- Enhanced image processing with file size limits (2MB max) and type validation
- Input sanitization for XSS prevention

### Changed
- Removed duplicate plan type question from impact assessment
- Made Monthly ARR field mandatory for external reports
- Made Plan Type field mandatory for external reports
- Restructured final report templates to use customer info as section headers
- Steps 1-2 use button-driven navigation
- Step 2 now includes Previous button
- Consolidated scoring logic to use customer details plan type only
- Updated form labels with required field indicators (*)
- Step 3 renamed from "Customer Details" to "Customer Information"
- Template format now leads with "## Customer Name, Plan Type, $ARR" instead of separate "Customer Details" section

### Fixed
- Tab order fixed so last field on each page focuses Next button
- Image processing errors now show user-friendly messages
- Form validation prevents submission with incomplete data

## [1.0.0] - 2024-09-16

### Added
- Initial release of Transifex Ticket Builder
- Bug report workflow with impact scoring
- Story report workflow
- Customer details collection
- Image paste and drag-drop support
- JIRA template generation
- Dark/light mode support
- Progress tracking through 6-step workflow
- Impact assessment questionnaire
- Automatic priority calculation (Trivial, Low, Medium, High, Severe)
- Internal vs external report handling
- Monthly to annual ARR conversion
- One-click copy to clipboard
