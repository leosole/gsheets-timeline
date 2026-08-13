function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Timeline')
    .addItem('Open timeline', 'showTimelineDialog')
    .addToUi();
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
    popupFields: headers.filter(header => !/^(name|start|end|due|status|estado|situacao|state|prazo)$/i.test(header)).slice(0, 6),
    filterFields: []
  };

  return JSON.stringify({ rows, headers, config });
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Sidebar');
}
