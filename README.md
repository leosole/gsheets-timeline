# gsheets-timeline

Renders project timelines from Google Sheets data. Ships as two targets from the
same React bundle:

- **Web app** — deployed from Apps Script, with a tab bar so you can keep several
  timelines open at once, each pointing at a different spreadsheet.
- **Sheets addon** — a modal bound to the spreadsheet you are currently in.

## What this project includes

- React timeline view built on top of the existing task rendering components
- tab bar for multiple timelines, persisted per user in Apps Script `UserProperties`
- Google Picker for choosing any spreadsheet you have access to, plus a sheet dropdown
- configuration panel for selecting the columns used for task names and dates
- popup fields for extra metadata on task click
- refresh/update button to sync with the selected sheet

## Web app setup

The Picker needs a standard Google Cloud project, so the default Apps Script
project is not enough.

1. Create or choose a Google Cloud project and note its **project number**.
2. In the Apps Script editor, go to **Project Settings → Google Cloud Platform
   project** and set that project number.
3. In the Cloud console, enable the **Google Picker API** and the **Google Drive API**.
4. Under **Credentials**, create an **API key**. Restrict it to HTTP referrers
   `*.google.com` and `*.googleusercontent.com`, and to the Picker API.
5. Configure the OAuth consent screen. `spreadsheets` is a sensitive scope, so
   publishing outside your organization requires Google verification.
6. In **Project Settings → Script Properties**, add:
   - `PICKER_API_KEY` — the API key from step 4
   - `CLOUD_PROJECT_NUMBER` — the project number from step 1
7. Push the code and deploy:

   ```bash
   npm run update
   ```

   Then **Deploy → New deployment → Web app**, executing as *user accessing the
   web app*.

## Sheets addon installation

1. Open a Google Sheet.
2. In the Apps Script editor, create a new project for this spreadsheet.
3. Copy the files from the `google-apps-script/` folder into the Apps Script project:
   - `Code.gs`
   - `Sidebar.html`
   - `appsscript.json`
4. Save the project.
5. Reload the spreadsheet and open the custom menu called `Timeline`.
6. Select `Open timeline` to show the modal.

The addon is locked to the spreadsheet it is bound to, so it shows no tab bar and
no spreadsheet picker.

## Spreadsheet layout

Use a header row like this:

| Name | Start | End | Due | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Design review | 01/09/2026 | 05/09/2026 | 04/09/2026 | Ana | Building | Needs review |

When a sheet is first selected the app reads its header row, guesses the common
task fields, and lets you configure which columns are used for:

- task name
- start date
- end date
- due date
- popup metadata
- filter metadata

## Local development

```bash
npm install
npm run dev
npm test
```

Outside Apps Script there is no `google.script.run`, so the host calls fall back
to stubs: the workspace is stored in `localStorage` and sheet data comes from
`window.__TIMELINE_DATA__` / `window.__TIMELINE_HEADERS__`.

`npm run dev` now preloads a built-in mock dataset from
`utils/dev-mock-data.ts` when those globals are not set, so the timeline is
immediately usable locally. If you want custom local data, define
`window.__TIMELINE_DATA__` and `window.__TIMELINE_HEADERS__` before the app
bootstraps and those values will be used instead.

## Notes

Timelines are read-only; the spreadsheet is never modified. Only tab metadata and
column mappings are persisted — never row data.

