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
}

export const getDaySize = (granularity: Granularity): number => {
  switch (granularity) {
    case 'day': return 24
    case 'week': return 10
    case 'month': return 3
  }
}

export const calculateDateRange = (tasks: any[]) => {
  const dates = tasks
    .flatMap(t => [t.start, t.end, t.due].filter(Boolean))
    .map(d => parseDate(d as string))
    .filter((d): d is dayjs.Dayjs => d !== null && d.isValid())

  const now = dayjs()

  if (dates.length === 0) {
    return { start: now.subtract(30, 'day'), end: now.add(30, 'day') }
  }

  const minDate = dayjs.min(...dates) || now
  const maxDate = dayjs.max(...dates) || now

  const start = minDate.subtract(5, 'days')
  const end = maxDate.add(5, 'days')

  return { start, end }
}

export const generateTimelineData = (
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs },
  granularity: Granularity
): TimelineData => {
  const daySize = getDaySize(granularity)
  const days = []
  let current = dateRange.start.startOf('day')

  while (current.isBefore(dateRange.end) || current.isSame(dateRange.end, 'day')) {
    days.push({
      date: current.format('YYYY-MM-DD'),
      dayLabel: current.format('DD'),
      weekLabel: current.format('ddd DD/MM'),
      monthLabel: current.format('MMMM')
    })
    current = current.add(1, 'day')
  }

  return { days, startDate: dateRange.start, endDate: dateRange.end, daySize, totalDays: days.length }
}

export const getCurrentDatePosition = (timelineData: TimelineData): number => {
  const today = dayjs().format('YYYY-MM-DD')
  const index = timelineData.days.findIndex(d => d.date === today)
  if (index < 0) return -1
  return index * timelineData.daySize + timelineData.daySize / 2
}

const BR_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/

export const parseDate = (date: string | null | undefined): dayjs.Dayjs | null => {
  if (!date) return null
  const m = date.trim().match(BR_DATE_RE)
  if (m) {
    let year = m[3]
    if (year.length === 2) year = '20' + year
    return dayjs(`${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, 'YYYY-MM-DD')
  }
  return dayjs(date)
}

export const formatDateToISO = (date: string | null | undefined): string | null => {
  if (!date) return null
  const parsed = parseDate(date)
  return parsed?.isValid() ? parsed.format('YYYY-MM-DD') : null
}

export const calculateDatePosition = (date: string, timelineData: TimelineData): number => {
  const index = timelineData.days.findIndex(d => d.date === date)
  if (index < 0) return -1
  return index * timelineData.daySize + timelineData.daySize / 2
}
