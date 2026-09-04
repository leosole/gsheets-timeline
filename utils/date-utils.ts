import dayjs from 'dayjs'
import minMax from 'dayjs/plugin/minMax'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/pt-br'

dayjs.extend(minMax)
dayjs.extend(weekOfYear)
dayjs.extend(customParseFormat)
dayjs.locale('pt-br')

export type Granularity = 'day' | 'week' | 'month'

export interface TimelineData {
  days: Array<{ date: string; dayLabel: string; weekLabel?: string; monthLabel?: string }>
  startDate: dayjs.Dayjs
  endDate: dayjs.Dayjs
  daySize: number
  totalDays: number
  /** Precomputed index for O(1) date→dayIndex lookups */
  dayIndex: Map<string, number>
}

export const getDaySize = (granularity: Granularity): number => {
  switch (granularity) {
    case 'day': return 24
    case 'week': return 10
    case 'month': return 3
  }
}

export const calculateDateRange = (tasks: any[]) => {
  const now = dayjs()
  let minDate: dayjs.Dayjs | null = null
  let maxDate: dayjs.Dayjs | null = null

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const rawDates = [t.start, t.end, t.due]
    for (let j = 0; j < 3; j++) {
      if (!rawDates[j]) continue
      const d = parseDate(rawDates[j])
      if (!d || !d.isValid()) continue
      if (!minDate || d.isBefore(minDate)) minDate = d
      if (!maxDate || d.isAfter(maxDate)) maxDate = d
    }
  }

  if (!minDate || !maxDate) {
    return { start: now.subtract(30, 'day'), end: now.add(30, 'day') }
  }

  return { start: minDate.subtract(5, 'days'), end: maxDate.add(5, 'days') }
}

export const generateTimelineData = (
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs },
  granularity: Granularity
): TimelineData => {
  const daySize = getDaySize(granularity)
  const days: TimelineData['days'] = []
  let current = dateRange.start.startOf('day')

  while (current.isBefore(dateRange.end) || current.isSame(dateRange.end, 'day')) {
    const date = current.format('YYYY-MM-DD')
    const dayLabel = current.format('DD')
    days.push({
      date,
      dayLabel,
      weekLabel: granularity === 'week' ? current.format('ddd DD/MM') : undefined,
      monthLabel: granularity === 'month' ? current.format('MMMM') : undefined,
    })
    current = current.add(1, 'day')
  }

  const dayIndex = new Map<string, number>();
  for (let i = 0; i < days.length; i++) {
    dayIndex.set(days[i].date, i);
  }

  return { days, startDate: dateRange.start, endDate: dateRange.end, daySize, totalDays: days.length, dayIndex }
}

export const getCurrentDatePosition = (timelineData: TimelineData): number => {
  const today = dayjs().format('YYYY-MM-DD')
  const index = timelineData.dayIndex.get(today)
  if (index === undefined) return -1
  return index * timelineData.daySize + timelineData.daySize / 2
}

const BR_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/

// Matches Google Sheets formatted dates using Portuguese abbreviated months,
// e.g. "3-jul.-25", "03-jul-2025", "15/dez./24"
const PT_MONTH_ABBR: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
}
const PT_ABBR_RE = /^(\d{1,2})[-/](\w{3})\.?[-/](\d{2,4})$/

export const parseDate = (date: string | null | undefined): dayjs.Dayjs | null => {
  if (!date) return null
  const trimmed = date.trim()

  // 1. BR slash format: DD/MM/YYYY
  const brMatch = trimmed.match(BR_DATE_RE)
  if (brMatch) {
    let year = brMatch[3]
    if (year.length === 2) year = '20' + year
    return dayjs(`${year}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`, 'YYYY-MM-DD')
  }

  // 2. Portuguese abbreviated month: D-MMM.-YY  (e.g. 3-jul.-25)
  const ptMatch = trimmed.match(PT_ABBR_RE)
  if (ptMatch) {
    const month = PT_MONTH_ABBR[ptMatch[2].toLowerCase()]
    if (month !== undefined) {
      const day = parseInt(ptMatch[1], 10)
      let year = parseInt(ptMatch[3], 10)
      if (year < 100) year += 2000
      return dayjs(new Date(year, month, day))
    }
  }

  // 3. Fallback: let dayjs try its default parsing (ISO 8601, etc.)
  return dayjs(trimmed)
}

export const formatDateToISO = (date: string | null | undefined): string | null => {
  if (!date) return null
  const parsed = parseDate(date)
  return parsed?.isValid() ? parsed.format('YYYY-MM-DD') : null
}

export const calculateDatePosition = (date: string, timelineData: TimelineData): number => {
  const index = timelineData.dayIndex.get(date)
  if (index === undefined) return -1
  return index * timelineData.daySize + timelineData.daySize / 2
}
