# Transifex Ticket Builder
## Overview

The Transifex Ticket Builder is a comprehensive tool for creating and managing support tickets with impact assessment and prioritization. Originally designed to replace our Excel-based bug scoring system, it has evolved into a full-featured ticket management platform.

## Main Features

### **Multi-Workflow Support**
- **Bug Reports**: Complete incident documentation with impact scoring
- **Story Reports**: Feature request and enhancement tracking *(Coming Soon)*
- **New Tickets**: Full documentation workflow with all required fields
- **Update Existing**: Streamlined updates with essential information only

### **Smart Impact Assessment**
- Interactive questionnaire covering customer impact, workarounds, customer type, churn risk, and urgency
- Automatic priority calculation (Trivial, Low, Medium, High, Severe)
- Visual score progression with real-time feedback
- No more Excel juggling or manual priority lookups

### **Professional Documentation**
- Step-by-step guided workflow for comprehensive ticket creation
- Rich text support with **image paste functionality** (Ctrl+V or drag & drop)
- Clean display with compact image placeholders
- Full base64 image embedding for JIRA compatibility when copying

### **Enhanced User Experience**
- 6-step intuitive workflow with progress tracking
- Internal vs external report handling
- Real-time form validation and smart navigation
- Auto Light/Dark mode based on system preferences
- Monthly to Annual ARR conversion
- One-click copy to clipboard with formatted JIRA templates

## How It Works

1. **Select Report Type**: Choose between Bug Report or Story Report
2. **Choose Ticket Type**: Create new ticket or update existing
3. **Customer Details**: Enter customer information with internal report option
4. **Impact Assessment**: Answer guided questions about impact and urgency  
5. **Documentation**: Add summary, reproduction steps, and expected behavior (with image support)
6. **Final Output**: Review calculated priority and copy formatted template to JIRA

## Template Output

The tool generates professionally formatted JIRA templates with:
- Customer details and contact information
- Complete impact assessment with scoring breakdown
- Structured documentation sections
- Embedded images (base64) for immediate JIRA compatibility
- Priority and score summary for quick triage

## Changelog

### Latest Update
- **Markdown output format**: Output now uses proper Markdown formatting with headers and bold text for better Jira compatibility
- **Full Q&A format**: Replaced letter-based answers (ABCDE) with complete questions and selected answers for clarity
- **Improved question clarity**: Shortened and simplified question text:
  - "How important is this BUG for the customer?" → "What's the impact on the customer?"
  - "What kind of customer is affected?" → "Customer Plan?"
  - "Is this a possible churn customer? CSM will give this info." → "Churn Risk?"
  - "How long can the customer wait for the fix?" → "How urgent is this fix?"
- **Condensed answer options**: Made all answer choices more concise and actionable
- **Enhanced output structure**: Customer details now display as header, optimized spacing, removed redundant sections
