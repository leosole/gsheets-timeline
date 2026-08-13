export type TimelineFieldMap = {
  name: string
  start: string
  end: string
  due: string
}

export type TimelineRow = Record<string, string | number | boolean | null | undefined>

export interface SpreadsheetConfig {
  title: string
  sheetName?: string
  sheetUrl?: string
  fieldMap: TimelineFieldMap
  popupFields: string[]
  filterFields: string[]
}

export const DEFAULT_FIELD_MAP: TimelineFieldMap = {
  name: 'Name',
  start: 'Start',
  end: 'End',
  due: 'Due'
}

export const DEFAULT_SPREADSHEET_CONFIG: SpreadsheetConfig = {
  title: 'Timeline',
  sheetName: '',
  sheetUrl: '',
  fieldMap: DEFAULT_FIELD_MAP,
  popupFields: ['Owner', 'Status', 'Notes'],
  filterFields: ['Owner', 'Status']
}

export const normalizeFieldMap = (fieldMap?: Partial<TimelineFieldMap>): TimelineFieldMap => ({
  name: fieldMap?.name || DEFAULT_FIELD_MAP.name,
  start: fieldMap?.start || DEFAULT_FIELD_MAP.start,
  end: fieldMap?.end || DEFAULT_FIELD_MAP.end,
  due: fieldMap?.due || DEFAULT_FIELD_MAP.due
})

export const sanitizeSpreadsheetData = (rows: TimelineRow[], fieldMap: TimelineFieldMap): any[] => {
  return rows
    .map(row => {
      const nameValue = row[fieldMap.name]
      const startValue = row[fieldMap.start]
      const endValue = row[fieldMap.end]
      const dueValue = row[fieldMap.due]

      if (nameValue === undefined || nameValue === null || String(nameValue).trim() === '') return null

      return {
        name: String(nameValue),
        start: startValue == null ? '' : String(startValue),
        end: endValue == null ? '' : String(endValue),
        due: dueValue == null ? '' : String(dueValue),
        ...row
      }
    })
    .filter((row): row is any => Boolean(row))
}
