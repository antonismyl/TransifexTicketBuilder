# Changelog

All notable changes to the Transifex Ticket Builder will be documented in this file.

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
