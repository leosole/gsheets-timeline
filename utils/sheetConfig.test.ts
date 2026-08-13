import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { calculateBarMetrics } from './barMetrics'
import { generateTimelineData } from './dateUtils'
import { DEFAULT_FIELD_MAP, buildFieldOptions, resolveTimelineLayout, sanitizeSpreadsheetData } from './sheetConfig'

describe('resolveTimelineLayout', () => {
  it('keeps the sidebar in configuration mode unless the timeline view is explicitly requested', () => {
    expect(resolveTimelineLayout('timeline')).toBe('timeline')
    expect(resolveTimelineLayout('settings')).toBe('settings')
    expect(resolveTimelineLayout(undefined)).toBe('settings')
  })
})

describe('buildFieldOptions', () => {
  it('includes sheet headers even when there are no data rows', () => {
    expect(buildFieldOptions([], ['Name', 'Start', 'Due'])).toEqual(['Due', 'Name', 'Start'])
    expect(buildFieldOptions([{ Name: 'Task 1', Start: '2026-01-01' }], ['Name', 'Start', 'Due'])).toEqual(['Due', 'Name', 'Start'])
  })
})

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

describe('status color fallback', () => {
  const getTaskDates = () => {
    const now = dayjs()
    const start = now.subtract(3, 'day').format('DD/MM/YYYY')
    const due = now.add(4, 'day').format('DD/MM/YYYY')
    return { start, due }
  }

  it('keeps the legacy default status colors when no status column is selected', () => {
    const { start, due } = getTaskDates()
    const rangeStart = dayjs(start, 'DD/MM/YYYY').subtract(7, 'day')
    const rangeEnd = dayjs(due, 'DD/MM/YYYY').add(7, 'day')
    const timelineData = generateTimelineData({ start: rangeStart, end: rangeEnd }, 'week')

    const task = {
      name: 'Task 1',
      start,
      end: '',
      due
    }

    const metrics = calculateBarMetrics(task, timelineData, 'week')

    expect(metrics?.status).toBe('Fazendo')
    expect(metrics?.colors.bg).toBe('bg-yellow-200 dark:bg-yellow-600')
    expect(metrics?.customColors).toEqual({ bg: '', border: '' })
  })

  it('uses custom colors for explicit status values when a status column is selected', () => {
    const { start, due } = getTaskDates()
    const rangeStart = dayjs(start, 'DD/MM/YYYY').subtract(7, 'day')
    const rangeEnd = dayjs(due, 'DD/MM/YYYY').add(7, 'day')
    const timelineData = generateTimelineData({ start: rangeStart, end: rangeEnd }, 'week')

    const task = {
      name: 'Task 1',
      start,
      end: '',
      due,
      Status: 'Fazendo'
    }

    const metrics = calculateBarMetrics(task, timelineData, 'week', 'Status', { Fazendo: '#123456' })

    expect(metrics?.status).toBe('Fazendo')
    expect(metrics?.customColors).toEqual({ bg: '#123456', border: '#123456' })
  })
})
