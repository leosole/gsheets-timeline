# gsheets-timeline

Renders project timelines from Google Sheets data. Ships as three deployment
targets from the same React bundle:

- **Vercel web app** — standalone SPA with Google OAuth sign-in, the Google
  Picker for choosing spreadsheets, and workspace persistence in Google Drive.
- **Apps Script web app** — deployed from Apps Script, with a tab bar so you
  can keep several timelines open at once.
- **Apps Script Sheets addon** — a modal bound to the spreadsheet you are
  currently in.

## What this project includes

- React timeline view with task bars, grouping, and status colors
- Tab bar for multiple timelines (web app modes)
- Google Picker for choosing any spreadsheet you have access to, plus a sheet
  dropdown
- Configuration panel for selecting the columns used for task names and dates
- Popup fields for extra metadata on task click
- Refresh/update button to sync with the selected sheet
- Dark mode toggle
- Row caching for faster reloads

## Runtime modes

The app auto-detects its runtime environment at startup:

| Mode | Detection | Data source | Workspace storage |
| --- | --- | --- | --- |
| **Vercel** | Non-localhost, no `google.script` | Google Sheets API (user token) | Google Drive |
| **Apps Script web app** | `google.script.run` exists | `google.script.run` | `UserProperties` |
| **Local dev** | `localhost` | Mock data / `__TIMELINE_DATA__` | `localStorage` |

## Vercel deployment

The Vercel build produces a standard static SPA (separate JS/CSS/assets) and
calls the Google Sheets API directly from the browser using the user's own
OAuth token — no server-side proxy, no service account. The workspace (tabs,
column mappings) is saved as `workspace.json` in the user's Google Drive.

### Google Cloud project setup

1. Create or choose a [Google Cloud project](https://console.cloud.google.com/).
2. Enable the **Google Sheets API** and **Google Drive API**.
3. Go to **APIs & Services → Credentials**.
4. Create an **API key**. Restrict it to the **Google Picker API**.
5. Create an **OAuth 2.0 Client ID** (Web application type). Add your Vercel
   deployment URL (e.g. `https://your-app.vercel.app`) as an **Authorized
   JavaScript origin**.
6. Configure the **OAuth consent screen**. The `spreadsheets` scope is
   sensitive, so publishing outside your organization requires Google
   verification.
7. Note the **project number** (shown on the project dashboard).

### Environment variables

Add these in the Vercel dashboard under **Settings → Environment Variables**:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Yes | OAuth 2.0 client ID (from step 4) |
| `VITE_GOOGLE_API_KEY` | Yes | Google API key (from step 3) |
| `VITE_GOOGLE_PROJECT_NUMBER` | Yes | Google Cloud project number |
| `VITE_ALLOWED_EMAILS` | No | Comma-separated list of allowed Google emails |

If `VITE_ALLOWED_EMAILS` is not set, anyone with the URL can sign in and use
the app. To restrict access, set it to a comma-separated list of email
addresses:

```
VITE_ALLOWED_EMAILS=alice@company.com,bob@company.com
```

Users not in the list will see an "Access Denied" page after signing in.

### Deploy

```bash
# Preview deployment
npx vercel

# Production deployment
npx vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard for automatic deployments
on push.

## Apps Script web app setup

The Picker needs a standard Google Cloud project, so the default Apps Script
project is not enough.

1. Create or choose a Google Cloud project and note its **project number**.
2. In the Apps Script editor, go to **Project Settings → Google Cloud Platform
   project** and set that project number.
3. In the Cloud console, enable the **Google Picker API** and the **Google
   Drive API**.
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
3. Copy the files from the `google-apps-script/` folder into the Apps Script
   project:
   - `Code.gs`
   - `Sidebar.html`
   - `appsscript.json`
4. Save the project.
5. Reload the spreadsheet and open the custom menu called `Timeline`.
6. Select `Open timeline` to show the modal.

The addon is locked to the spreadsheet it is bound to, so it shows no tab bar
and no spreadsheet picker.

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

## Build commands

| Command | Description |
| --- | --- |
| `npm run dev` | Local dev server (mock data, no auth) |
| `npm run build` | Standard SPA build (same as `build:vercel`) |
| `npm run build:vercel` | Vercel build — standard dist/ with separate assets |
| `npm run build:appsscript` | Apps Script build — single inlined HTML file |
| `npm run create` | Build for Apps Script and prepare `Sidebar.html` |
| `npm run update` | Build, prepare, and push to Apps Script |
| `npm run test` | Run tests |

## Local development

```bash
npm install
npm run dev
npm test
```

Outside Apps Script there is no `google.script.run`, so the host calls fall
back to stubs: the workspace is stored in `localStorage` and sheet data comes
from `window.__TIMELINE_DATA__` / `window.__TIMELINE_HEADERS__`.

`npm run dev` now preloads a built-in mock dataset from
`utils/dev-mock-data.ts` when those globals are not set, so the timeline is
immediately usable locally. If you want custom local data, define
`window.__TIMELINE_DATA__` and `window.__TIMELINE_HEADERS__` before the app
bootstraps and those values will be used instead.

## How workspace persistence works

| Mode | Storage | Syncs across devices? |
| --- | --- | --- |
| Vercel | Google Drive (`Timeline/workspace.json`) | Yes |
| Apps Script | `UserProperties` | Yes (per Google account) |
| Local dev | `localStorage` | No |

## Notes

- Timelines are read-only; the spreadsheet is never modified.
- Only tab metadata and column mappings are persisted — never row data.
- In Vercel mode, the user's own Google OAuth token is used for all API
  calls. No data passes through external servers.
