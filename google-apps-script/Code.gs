const WORKSPACE_PROPERTY_KEY = 'timeline.workspace.v1';
const SPREADSHEET_ID_PATTERN = /^[a-zA-Z0-9_-]{20,}$/;
const MAX_WORKSPACE_BYTES = 400000;

function onOpen(e) {
  var menu = SpreadsheetApp.getUi().createAddonMenu();
  menu.addItem('Open timeline', 'showTimelineDialog');
  menu.addToUi();
}

/** Addon entry point: single tab locked to the bound spreadsheet. */
function showTimelineDialog() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = SpreadsheetApp.getActiveSheet();

  const bootstrap = {
    mode: 'addon',
    bound: {
      spreadsheetId: spreadsheet.getId(),
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
      sheetName: sheet.getName()
    }
  };

  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Timeline')
    .setWidth(1200)
    .setHeight(760);

  html.setContent(injectBootstrap_(html.getContent(), bootstrap));
  SpreadsheetApp.getUi().showModelessDialog(html, 'Timeline');
}

/** Web app entry point: multi-tab workspace across any spreadsheet the user picks. */
function doGet(e) {
  const content = HtmlService.createHtmlOutputFromFile('Sidebar').getContent();

  return HtmlService.createHtmlOutput(injectBootstrap_(content, { mode: 'webapp', bound: null }))
    .setTitle('Timeline')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function injectBootstrap_(content, bootstrap) {
  const head =
    '<base target="_top">' +
    '<script>window.__TIMELINE_BOOTSTRAP__ = ' +
    JSON.stringify(bootstrap) +
    ';</script>';
  return content.replace('</head>', head + '</head>');
}

function openSpreadsheet_(spreadsheetId) {
  if (!spreadsheetId) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) {
      throw new Error('No spreadsheet selected. Choose one in the tab settings.');
    }
    return active;
  }

  if (!SPREADSHEET_ID_PATTERN.test(spreadsheetId)) {
    throw new Error('Invalid spreadsheet id.');
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function resolveSheet_(spreadsheet, sheetName) {
  const sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : null;
  if (sheet) return sheet;
  if (sheetName) {
    throw new Error('Sheet "' + sheetName + '" was not found in ' + spreadsheet.getName() + '.');
  }
  return spreadsheet.getSheets()[0];
}

function readHeaders_(values) {
  return values[0].map(value => String(value == null ? '' : value).trim()).filter(Boolean);
}

function readRows_(values, headers) {
  return values.slice(1).map(row => {
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = row[index] !== undefined ? row[index] : '';
    });
    return rowObject;
  });
}

function getSpreadsheetMeta(spreadsheetId) {
  const spreadsheet = openSpreadsheet_(spreadsheetId);

  return JSON.stringify({
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetNames: spreadsheet.getSheets().map(sheet => sheet.getName())
  });
}

/** Rows, headers and an auto-detected column mapping for a newly selected sheet. */
function getSheetState(spreadsheetId, sheetName) {
  const spreadsheet = openSpreadsheet_(spreadsheetId);
  const sheet = resolveSheet_(spreadsheet, sheetName);
  const values = sheet.getDataRange().getValues();

  const meta = {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: sheet.getName()
  };

  if (!values.length) {
    return JSON.stringify({
      rows: [],
      headers: [],
      meta: meta,
      config: {
        title: sheet.getName(),
        statusField: '',
        fieldMap: { name: '', start: '', end: '', due: '' },
        popupFields: [],
        filterFields: []
      }
    });
  }

  const headers = readHeaders_(values);
  const rows = readRows_(values, headers);

  const config = {
    title: sheet.getName(),
    statusField: headers.find(h => /^(status|estado|situacao|state)$/i.test(h)) || '',
    fieldMap: {
      name: headers.find(h => /^(name|task|title)$/i.test(h)) || headers[0] || '',
      start: headers.find(h => /^(start|start date|inicio|date inicio|início)$/i.test(h)) || '',
      end: headers.find(h => /^(end|end date|fim|date fim)$/i.test(h)) || '',
      due: headers.find(h => /^(due|due date|deadline|prazo|previsto)$/i.test(h)) || ''
    },
    popupFields: [],
    filterFields: []
  };

  return JSON.stringify({ rows: rows, headers: headers, meta: meta, config: config });
}

function getSheetRows(spreadsheetId, sheetName) {
  const spreadsheet = openSpreadsheet_(spreadsheetId);
  const values = resolveSheet_(spreadsheet, sheetName).getDataRange().getValues();

  if (!values.length) {
    return JSON.stringify({ rows: [], headers: [] });
  }

  const headers = readHeaders_(values);
  return JSON.stringify({ rows: readRows_(values, headers), headers: headers });
}

function getWorkspace() {
  return PropertiesService.getUserProperties().getProperty(WORKSPACE_PROPERTY_KEY) || '';
}

function saveWorkspace(workspaceJson) {
  if (typeof workspaceJson !== 'string' || workspaceJson.length > MAX_WORKSPACE_BYTES) {
    throw new Error('Workspace payload is missing or too large.');
  }

  const parsed = JSON.parse(workspaceJson);
  if (!parsed || !Array.isArray(parsed.tabs)) {
    throw new Error('Workspace payload is malformed.');
  }

  PropertiesService.getUserProperties().setProperty(WORKSPACE_PROPERTY_KEY, workspaceJson);
  return true;
}

/**
 * Credentials for the client-side Google Picker. The API key and Cloud project
 * number live in Script Properties so they are never committed to the repo.
 */
function getPickerConfig() {
  const properties = PropertiesService.getScriptProperties();
  const developerKey = properties.getProperty('PICKER_API_KEY');
  const appId = properties.getProperty('CLOUD_PROJECT_NUMBER');

  if (!developerKey || !appId) {
    throw new Error(
      'Picker is not configured. Set PICKER_API_KEY and CLOUD_PROJECT_NUMBER in Script Properties.'
    );
  }

  return JSON.stringify({
    token: ScriptApp.getOAuthToken(),
    developerKey: developerKey,
    appId: appId
  });
}
