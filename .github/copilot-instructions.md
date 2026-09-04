# Project Instructions

## Project

`gsheets-timeline` is a React 18 + TypeScript single-page timeline for Google Sheets data. Vite bundles the client into one HTML file for Google Apps Script. The repository supports three deployment targets:

- **Vercel web app** — standalone SPA with Google OAuth sign-in, the Google Picker for choosing spreadsheets, and workspace persistence in Google Drive.
- **Apps Script web app** — deployed from Apps Script, with a tab bar so you can keep several timelines open at once.
- **Apps Script Sheets addon** — a modal bound to the spreadsheet you are currently in; no picker or tab bar.

The timeline is read-only. Do not add spreadsheet row writes unless the feature explicitly changes that product contract.

## Stack and Commands

- Use TypeScript and React for client changes. Use the existing Tailwind CSS v4 setup and `react-icons` where an icon is needed.
- Use `cn()` from `utils/cn.ts` (clsx + tailwind-merge) for conditional class merging.
- Install dependencies with `npm install`.
- Run local development with `npm run dev`.
- Run unit tests with `npm test` (`vitest run`).
- Build and typecheck with `npm run build` (standard SPA, same as `build:vercel`).
- Build for Vercel with `npm run build:vercel` (standard dist/ with separate assets).
- Build for Apps Script with `npm run build:appsscript` (single inlined HTML file).
- Generate the Apps Script HTML artifact with `npm run create`; this runs the Apps Script build and copies `dist/index.html` to `google-apps-script/Sidebar.html`.
- Push the generated Apps Script project with `npm run update` (`clasp push --force`). Deploy with `npm run deploy` only when deployment is requested.
- Use `npm run preview` to inspect a production build.

After changing behavior, run the narrowest relevant test first, then `npm test` or `npm run build` as appropriate. For changes that affect the Apps Script bundle, run `npm run create` and verify the generated artifact is intentional.

## Runtime Modes

The app auto-detects its runtime environment at startup in `main.tsx`:

| Mode | Detection | Data source | Workspace storage |
| --- | --- | --- | --- |
| **Vercel** | Non-localhost, no `google.script` | Google Sheets API (user token) | Google Drive |
| **Apps Script web app** | `google.script.run` exists | `google.script.run` | `UserProperties` |
| **Local dev** | `localhost` | Mock data / `__TIMELINE_DATA__` | `localStorage` |

`isVercelMode()` in `utils/vercel-auth.ts` and `utils/sheet-host.ts` checks `window.__TIMELINE_VERCEL__`. `getBootstrap()` in `utils/sheet-host.ts` provides the host mode (`addon` vs `webapp`) and any bound spreadsheet selection.

## Source Layout

- `app.tsx`: top-level workspace loading, persistence, tab actions, host-mode branching, and Vercel auth gate (sign-in screen, email allowlist check).
- `main.tsx`: React entrypoint; sets `window.__TIMELINE_VERCEL__` for Vercel mode and seeds mock data in local dev.
- `index.css`: Tailwind v4 theme tokens (color variables, dark mode). Do not remove `@import "tailwindcss"` or the `@theme` block.
- `components/`: UI and timeline views. Keep state ownership near the feature that owns it; pass changes upward through existing callbacks.
- `components/ui/`: shared primitives (Button, TextInput, Select, Alert, Spinner, StatusPill, ToggleGroup, etc.). Reuse these before creating new inline UI markup.
- `utils/sheet-host.ts`: the only client boundary for Apps Script calls (`google.script.run`), Google Sheets API calls (Vercel mode), and local development fallbacks. Add new host calls here rather than calling `google.script.run` or the Sheets API from components.
- `utils/workspace.ts`: workspace/tab models, defaults, parsing, normalization, and immutable state transitions. Preserve the invariant that a workspace always has at least one tab.
- `utils/sheet-config.ts`: spreadsheet column mapping, status configuration, and row sanitization.
- `utils/vercel-auth.ts`: Google OAuth token management for Vercel mode. Handles GIS loading, token storage (sessionStorage), email extraction, and the email allowlist check.
- `utils/drive-workspace.ts`: Google Drive workspace persistence for Vercel mode. Stores workspace as `/Timeline/workspace.json` in the user's Drive.
- `utils/picker.ts`: Google Picker wrapper. Works in both Apps Script (server-provided token) and Vercel (user's OAuth token) modes.
- `utils/date-utils.ts`, `utils/bar-metrics.ts`, and `utils/status-utils.ts`: date parsing, timeline calculations, and status/color behavior.
- `utils/cn.ts`: `cn()` helper combining `clsx` and `tailwind-merge` for conditional class merging.
- `utils/dev-mock-data.ts`: built-in mock dataset preloaded in local dev when `__TIMELINE_DATA__` is not set.
- `google-apps-script/Code.gs`: Apps Script entry points and server functions. Return JSON strings for client calls to match the existing `callServer` behavior.
- `scripts/prepare-sidebar.js`: copies the Vite single-file build into `google-apps-script/Sidebar.html`. Treat `Sidebar.html` as generated output.
- `public/allowlist.json`: runtime email allowlist for Vercel mode. `{ "emails": ["..."] }` — empty or missing means open access.

## Implementation Rules

- Preserve the separation between web app, Vercel, and addon behavior. Use `getBootstrap()` and the existing `isAddon`/`allowPicker` flow instead of detecting hosts in individual components.
- Keep workspace updates immutable and use the helpers in `workspace.ts` (`addTab`, `updateTab`, `setActiveTab`, etc.). Do not mutate tabs or arrays in place.
- Use kebab-case for all new filenames and directories (for example `task-popover.tsx`, `sheet-host.ts`, `status-pill.tsx`).
- Keep React component symbol names in PascalCase, but keep file names in kebab-case.
- Reuse shared primitives from `components/ui/` for buttons, inputs, selects, alerts, toggles, and similar controls before creating new inline UI markup.
- Prefer importing shared primitives via `components/ui/index.ts` (`import { Button, TextInput } from "./ui"`) from component modules.
- Treat persisted workspace data as untrusted. Update `normalizeWorkspace` and related normalization logic when adding persisted fields, and bump `WORKSPACE_VERSION` only when a deliberate migration/version change is needed.
- Keep spreadsheet row data transient. Persist only tab metadata and column configuration unless the product requirement explicitly says otherwise.
- Keep local development usable outside Apps Script. New host calls need a deterministic local fallback, normally using `window.__TIMELINE_DATA__`, `window.__TIMELINE_HEADERS__`, or `localStorage` as appropriate.
- For Vercel mode, new server-side calls should go through the Google Sheets API directly with the user's own OAuth token (via `getAccessToken()` in `utils/vercel-auth.ts`). Do not add a separate backend proxy.
- Validate spreadsheet identifiers and payload sizes on the Apps Script server. Keep credentials in Script Properties or local environment configuration; never commit API keys, OAuth tokens, or other secrets.
- Preserve existing date formats and dayjs-based parsing unless a feature requires a format change. Be explicit about empty or invalid dates.
- Prefer small, behavior-focused utilities and tests over broad component rewrites. Avoid unrelated formatting changes.
- Use ASCII in source and documentation unless existing content requires another character set. Do not add comments unless they explain non-obvious behavior.

## Testing

- Unit tests live under the top-level `test/` folder and use Vitest with the Node environment.
- Test public utility behavior and edge cases: malformed persisted state, missing headers/data, empty tabs, invalid dates, and host fallbacks.
- For UI changes, verify both web-app and addon conditions when the feature touches host-specific controls. At minimum, ensure the app still builds and the relevant state transition is covered.

## Apps Script and Generated Files

- `google-apps-script/appsscript.json` controls Apps Script runtime, OAuth scopes, and web-app settings. Avoid changing scopes unless required and explain the security impact.
- `Code.gs` uses `onOpen`, `showTimelineDialog`, and `doGet` as entry points. Keep bootstrap injection compatible with `window.__TIMELINE_BOOTSTRAP__`.
- `Sidebar.html` is generated by `npm run create`; edit the React/Vite sources instead of hand-editing it. Do not manually commit unrelated generated churn.
- Web-app Picker configuration comes from Script Properties named `PICKER_API_KEY` and `CLOUD_PROJECT_NUMBER`; do not place these values in source control.

## Vercel Deployment

- `vercel.json` configures the build command (`npm run build:vercel`), output directory (`dist/`), and SPA rewrites.
- Environment variables are set in the Vercel dashboard under Settings → Environment Variables.
- Required env vars: `VITE_GOOGLE_OAUTH_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_PROJECT_NUMBER`.
- Optional: `VITE_ALLOWED_EMAILS` (comma-separated). When unset, anyone with the URL can sign in. When set, only listed emails can access the app. The allowlist is also served at `/allowlist.json` from `public/allowlist.json`.
- OAuth scopes: `openid`, `email`, `spreadsheets`, `drive.file`. The `openid` and `email` scopes are needed for email extraction from the ID token.
- Email extraction: tries ID token decode first, then falls back to the userinfo API (`/oauth2/v3/userinfo`).
- Workspace persistence: stored as `/Timeline/workspace.json` in the user's Google Drive via `utils/drive-workspace.ts`.
- No server-side proxy: all API calls are made directly from the browser using the user's own OAuth token.

## Delivery Checklist

1. Make the smallest change in the owning source module.
2. Add or update a focused Vitest test for changed utility behavior.
3. Run the relevant test and `npm run build`.
4. If the bundle or Apps Script behavior changed, run `npm run create` and inspect the generated diff.
5. Leave deployment, `clasp push`, and `clasp deploy` to the user unless explicitly requested.
