import { fetchPickerConfig } from "./sheet-host";
import type { SheetSelection } from "./workspace";

const GAPI_SRC = "https://apis.google.com/js/api.js";

let gapiPromise: Promise<any> | null = null;

const loadGapi = (): Promise<any> => {
  if (gapiPromise) return gapiPromise;

  gapiPromise = new Promise((resolve, reject) => {
    const existing = (globalThis as any).gapi;
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = GAPI_SRC;
    script.async = true;
    script.onload = () => resolve((globalThis as any).gapi);
    script.onerror = () =>
      reject(new Error("Failed to load the Google Picker library."));
    document.head.appendChild(script);
  }).then(
    (gapi: any) =>
      new Promise((resolve, reject) => {
        gapi.load("picker", {
          callback: () => resolve(gapi),
          onerror: () => reject(new Error("Failed to load the Picker module.")),
        });
      }),
  );

  return gapiPromise;
};

/**
 * Opens the Google Picker and resolves with the chosen spreadsheet, or null if
 * the user cancels. Inside the Apps Script sandbox the origin must be the
 * iframe's own origin, not the top-level one.
 */
export const pickSpreadsheet = async (): Promise<Omit<
  SheetSelection,
  "sheetName"
> | null> => {
  const [, config] = await Promise.all([loadGapi(), fetchPickerConfig()]);
  const picker = (globalThis as any).google.picker;
  const origin =
    (globalThis as any).google?.script?.host?.origin ?? window.location.origin;

  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMode(picker.DocsViewMode.LIST);

    const builder = new picker.PickerBuilder()
      .setTitle("Select a spreadsheet")
      .setOAuthToken(config.token)
      .setDeveloperKey(config.developerKey)
      .setAppId(config.appId)
      .setOrigin(origin)
      .addView(view)
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setCallback((data: any) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({
            spreadsheetId: doc.id,
            spreadsheetName: doc.name,
            spreadsheetUrl: doc.url,
          });
          return;
        }
        if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      });

    builder.build().setVisible(true);
  });
};
