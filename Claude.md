# Claude Code Instructions for ICE Analytics

## Mandatory Playwright Validation Rule

**CRITICAL REQUIREMENT:** Before completing ANY task in this project, you MUST use Playwright MCP to open the app in a real browser and visually verify that KPIs and UI reflect the latest uploaded data.

### Validation Requirements

1. **Open the app using Playwright MCP** - Navigate to the application URL in a real browser
2. **Visual verification required** - Inspect the UI to confirm:
   - All KPIs display correctly with the most recent data
   - UI components render properly
   - Data updates are reflected in the interface
3. **Screenshot documentation** - Take screenshots to document the validation

### Task Completion Policy

- If Playwright validation was NOT performed, the task MUST NOT be marked as complete
- All todo items require browser validation before marking as "completed"
- This applies to ALL tasks including:
  - Database schema changes
  - API modifications
  - UI updates
  - Data processing changes
  - Any feature additions or bug fixes

### Workflow

1. Complete the implementation work
2. Use Playwright MCP to launch browser
3. Navigate to the app and verify KPIs/UI
4. Take screenshots as proof of validation
5. Only then mark the task as complete

**No exceptions to this rule.**
