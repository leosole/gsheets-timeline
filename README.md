# gsheets-timeline

A Google Sheets modal extension for rendering project timelines from spreadsheet data.

## What this project includes

- React timeline view built on top of the existing task rendering components
- configuration panel for selecting the columns used for task names and dates
- popup fields for extra metadata on task click
- refresh/update button to sync with the active sheet
- Google Apps Script modal host for use directly inside Google Sheets

## Google Sheets installation

1. Open a Google Sheet.
2. In the Apps Script editor, create a new project for this spreadsheet.
3. Copy the files from the `google-apps-script/` folder into the Apps Script project:
   - `Code.gs`
   - `modal.html`
   - `appsscript.json`
4. Save the project.
5. Reload the spreadsheet and open the custom menu called `Timeline`.
6. Select `Open timeline` to show the modal.

## Spreadsheet layout

Use a header row like this:

| Name | Start | End | Due | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Design review | 01/09/2026 | 05/09/2026 | 04/09/2026 | Ana | Building | Needs review |

The app automatically reads the active sheet, identifies the common task fields, and lets you configure which columns are used for:

- task name
- start date
- end date
- due date
- popup metadata
- filter metadata

## Local development

This repo also has a local React app for previewing the timeline outside of Google Sheets:

```bash
npm install
npm run dev
```

## Notes

The modal loads the active sheet into the existing React timeline without changing the spreadsheet itself. The user can configure the field selection in the modal and click Update to refresh the timeline from the latest data.
