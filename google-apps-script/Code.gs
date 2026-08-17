function onOpen(e) {
  var menu = SpreadsheetApp.getUi().createAddonMenu();
  menu.addItem('Open timeline', 'showTimelineDialog');
  menu.addToUi();
}

function showTimelineDialog() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Timeline')
    .setWidth(1200)
    .setHeight(760);

  const content = html.getContent().replace('</head>', '<script>window.__TIMELINE_MODE__ = "settings";</script></head>');
  html.setContent(content);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Timeline');
}

function getSheetState() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const values = sheet.getDataRange().getValues();

  if (!values.length) {
    return JSON.stringify({
      rows: [],
      headers: [],
      config: {
        title: sheet.getName(),
        sheetName: sheet.getName(),
        sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
        fieldMap: { name: '', start: '', end: '', due: '' },
        popupFields: [],
        filterFields: []
      }
    });
  }

  const headers = values[0]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  const rows = values.slice(1).map(row => {
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = row[index] !== undefined ? row[index] : '';
    });
    return rowObject;
  });

  const config = {
    title: sheet.getName(),
    sheetName: sheet.getName(),
    sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
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

  return JSON.stringify({ rows, headers, config });
}

function getSheetRows() {
  const values = SpreadsheetApp.getActiveSheet().getDataRange().getValues();

  if (!values.length) {
    return JSON.stringify([]);
  }

  const headers = values[0]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  return JSON.stringify(values.slice(1).map(row => {
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = row[index] !== undefined ? row[index] : '';
    });
    return rowObject;
  }));
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Sidebar');
}
