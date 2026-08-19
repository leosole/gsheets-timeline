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

function findHeaderRowIndex_(values) {
  for (let index = 0; index < values.length; index += 1) {
    const hasAnyValue = values[index].some(value => String(value == null ? '' : value).trim());
    if (hasAnyValue) return index;
  }

  return -1;
}

function readHeaders_(values, headerRowIndex) {
  if (headerRowIndex < 0 || headerRowIndex >= values.length) return [];
  return values[headerRowIndex].map(value => String(value == null ? '' : value).trim()).filter(Boolean);
}

function readSheetHeadersFast_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  if (lastColumn <= 0 || lastRow <= 0) {
    return [];
  }

  const scanRows = Math.min(lastRow, 50);
  const sampled = sheet.getRange(1, 1, scanRows, lastColumn).getValues();
  const headerRowIndex = findHeaderRowIndex_(sampled);
  if (headerRowIndex < 0) return [];

  return readHeaders_(sampled, headerRowIndex);
}

/** Header row index without reading the full sheet; samples only the first rows. */
function findHeaderRowIndexFast_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastColumn <= 0 || lastRow <= 0) return -1;

  const scanRows = Math.min(lastRow, 50);
  const sampled = sheet.getRange(1, 1, scanRows, lastColumn).getValues();
  return findHeaderRowIndex_(sampled);
}

function buildRowGroupMetaFromSheetsApi_(spreadsheetId, sheet, dataStartRow, dataEndRow) {
  if (typeof Sheets === 'undefined' || !Sheets.Spreadsheets) return null;

  try {
    const sheetId = sheet.getSheetId();
    const response = Sheets.Spreadsheets.get(spreadsheetId, {
      ranges: [sheet.getName()],
      fields: 'sheets(properties(sheetId),rowGroups(range(startIndex,endIndex),depth))'
    });
    const apiSheet = (response.sheets || []).find(item => item.properties && item.properties.sheetId === sheetId);
    const rowGroups = (apiSheet && apiSheet.rowGroups ? apiSheet.rowGroups : [])
      .filter(group => Number(group.depth || 0) <= 1);

    const rowMeta = {};
    rowGroups.forEach(group => {
      const range = group.range || {};
      if (typeof range.startIndex !== 'number' || typeof range.endIndex !== 'number') return;

      const firstChildRow = Math.max(range.startIndex + 1, dataStartRow);
      const lastChildRow = Math.min(range.endIndex, dataEndRow);
      if (lastChildRow < firstChildRow) return;

      let parentRow = firstChildRow - 1;
      if (parentRow < dataStartRow) parentRow = firstChildRow;

      if (!rowMeta[parentRow]) rowMeta[parentRow] = {};
      rowMeta[parentRow].__sheetRow = parentRow;
      rowMeta[parentRow].__isGroupParent = true;
      rowMeta[parentRow].__groupCollapsed = false;
      rowMeta[parentRow].__groupChildCount = Number(rowMeta[parentRow].__groupChildCount || 0);

      for (let rowNum = firstChildRow; rowNum <= lastChildRow; rowNum += 1) {
        if (rowNum === parentRow) continue;

        if (!rowMeta[rowNum]) rowMeta[rowNum] = {};
        rowMeta[rowNum].__sheetRow = rowNum;
        rowMeta[rowNum].__groupParentRow = parentRow;
        rowMeta[parentRow].__groupChildCount += 1;
      }
    });

    return rowMeta;
  } catch (error) {
    console.warn('Sheets API row group metadata unavailable; falling back to Spreadsheet service.', error);
    return null;
  }
}

function buildRowGroupMeta_(spreadsheetId, sheet, dataStartRow, dataEndRow) {
  const rowMeta = {};
  if (dataEndRow < dataStartRow) return rowMeta;

  const apiRowMeta = buildRowGroupMetaFromSheetsApi_(spreadsheetId, sheet, dataStartRow, dataEndRow);
  if (apiRowMeta !== null) return apiRowMeta;

  let rowGroups = [];

  if (typeof sheet.getRowGroups === 'function') {
    rowGroups = sheet.getRowGroups() || [];
  } else if (
    typeof sheet.getRowGroupDepth === 'function' &&
    typeof sheet.getRowGroup === 'function'
  ) {
    const seen = {};
    let previousDepth = 0;

    for (let rowNum = dataStartRow; rowNum <= dataEndRow; rowNum += 1) {
      const depth = Number(sheet.getRowGroupDepth(rowNum) || 0);
      if (depth > previousDepth && depth >= 1) {
        let group = null;
        try {
          group = sheet.getRowGroup(rowNum, 1);
        } catch (error) {
          group = null;
        }

        if (group && typeof group.getRange === 'function') {
          const range = group.getRange();
          const key = range.getRow() + ':' + range.getNumRows();
          if (!seen[key]) {
            seen[key] = true;
            rowGroups.push(group);
          }
        }
      }
      previousDepth = depth;
    }
  } else if (typeof sheet.getRowGroup === 'function') {
    // Fallback for Sheet APIs that expose row groups by row/depth instead of bulk retrieval.
    const seen = {};
    for (let rowNum = dataStartRow; rowNum <= dataEndRow; rowNum += 1) {
      let group = null;
      try {
        group = sheet.getRowGroup(rowNum, 1);
      } catch (error) {
        // No group exists for this row/depth; continue scanning remaining rows.
        group = null;
      }
      if (!group || typeof group.getRange !== 'function') continue;

      const range = group.getRange();
      const key = range.getRow() + ':' + range.getNumRows();
      if (seen[key]) continue;

      seen[key] = true;
      rowGroups.push(group);
    }
  }

  if (!rowGroups.length) return rowMeta;

  rowGroups.forEach(group => {
    if (typeof group.getDepth === 'function' && group.getDepth() > 1) {
      return;
    }

    const range = group.getRange();
    const groupStart = range.getRow();
    const groupEnd = groupStart + range.getNumRows() - 1;
    const firstChildRow = Math.max(groupStart, dataStartRow);
    const lastChildRow = Math.min(groupEnd, dataEndRow);

    if (lastChildRow < firstChildRow) return;

    let parentRow = firstChildRow - 1;
    if (parentRow < dataStartRow) {
      // Edge case: if group starts on the first data row, fallback parent is the first grouped row.
      parentRow = firstChildRow;
    }

    if (!rowMeta[parentRow]) rowMeta[parentRow] = {};
    rowMeta[parentRow].__sheetRow = parentRow;
    rowMeta[parentRow].__isGroupParent = true;
    rowMeta[parentRow].__groupCollapsed = false;
    rowMeta[parentRow].__groupChildCount = (rowMeta[parentRow].__groupChildCount || 0);

    for (let rowNum = firstChildRow; rowNum <= lastChildRow; rowNum += 1) {
      if (rowNum === parentRow) continue;

      if (!rowMeta[rowNum]) rowMeta[rowNum] = {};
      rowMeta[rowNum].__sheetRow = rowNum;
      rowMeta[rowNum].__groupParentRow = parentRow;
      rowMeta[parentRow].__groupChildCount += 1;
    }
  });

  return rowMeta;
}

function readRowsWithoutGroupMeta_(values, headers, firstDataRow, headerRowIndex) {
  return values.slice(headerRowIndex + 1).map((row, rowIndex) => {
    const sheetRow = firstDataRow + rowIndex;
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = row[index] !== undefined ? row[index] : '';
    });

    rowObject.__sheetRow = sheetRow;
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

  const meta = {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: sheet.getName()
  };

  const headers = readSheetHeadersFast_(sheet);
  const rows = [];

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
  const sheet = resolveSheet_(spreadsheet, sheetName);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  if (!values.length) {
    return JSON.stringify({ rows: [], headers: [] });
  }

  const headerRowIndex = findHeaderRowIndex_(values);
  if (headerRowIndex < 0) {
    return JSON.stringify({ rows: [], headers: [] });
  }
  const headers = readHeaders_(values, headerRowIndex);
  const firstDataRow = dataRange.getRow() + headerRowIndex + 1;
  return JSON.stringify({
    rows: readRowsWithoutGroupMeta_(values, headers, firstDataRow, headerRowIndex),
    headers: headers
  });
}

function getSheetRowGroups(spreadsheetId, sheetName) {
  const spreadsheet = openSpreadsheet_(spreadsheetId);
  const sheet = resolveSheet_(spreadsheet, sheetName);
  const dataEndRow = sheet.getLastRow();

  if (dataEndRow <= 0) {
    return JSON.stringify({ rowMeta: {} });
  }

  // Only the header row's position is needed here, not the sheet's cell values.
  const headerRowIndex = findHeaderRowIndexFast_(sheet);
  if (headerRowIndex < 0) {
    return JSON.stringify({ rowMeta: {} });
  }

  const firstDataRow = headerRowIndex + 2;
  return JSON.stringify({
    rowMeta: buildRowGroupMeta_(spreadsheetId, sheet, firstDataRow, dataEndRow)
  });
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
