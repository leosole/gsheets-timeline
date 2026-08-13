import { describe, expect, it } from 'vitest'
import { DEFAULT_FIELD_MAP, sanitizeSpreadsheetData } from './sheetConfig'

describe('sanitizeSpreadsheetData', () => {
  it('maps spreadsheet rows into timeline task objects', () => {
    const rows = [
      {
        Name: 'Design review',
        Start: '01/09/2026',
        End: '05/09/2026',
        Due: '04/09/2026',
        Owner: 'Ana',
        Status: 'In progress'
      },
      {
        Name: '',
        Start: '02/09/2026',
        End: '',
        Due: ''
      }
    ]

    const tasks = sanitizeSpreadsheetData(rows, DEFAULT_FIELD_MAP)

    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      name: 'Design review',
      start: '01/09/2026',
      end: '05/09/2026',
      due: '04/09/2026',
      Owner: 'Ana',
      Status: 'In progress'
    })
  })

  it('keeps extra metadata fields in the task object', () => {
    const tasks = sanitizeSpreadsheetData([
      { Name: 'Task 1', Start: '10/09/2026', End: '', Due: '', Notes: 'Follow up' }
    ], DEFAULT_FIELD_MAP)

    expect(tasks[0].Notes).toBe('Follow up')
  })
})
