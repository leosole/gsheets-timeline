import dayjs from 'dayjs'
import { calculateDatePosition, parseDate, formatDateToISO, type TimelineData, type Granularity } from './dateUtils'

export interface BarMetrics {
  startPx: number
  width: number
  barEndPx: number
  plannedEndPx: number | undefined
  overdueStartPx: number | undefined
  overdueWidth: number | undefined
  completedEarlyWidth: number | undefined
  delayWidth: number | undefined
  status: string
  statuses: string[]
  colors: { bg: string; border: string }
  customColors?: { bg: string; border: string }
}

export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  'Fazendo': '#facc15',
  'Concluído': '#22c55e',
  'Atrasado': '#ef4444',
  'Não iniciado': '#9ca3af'
}

export const getStatusColors = (status: string) => {
  switch (status) {
    case 'Fazendo':
      return { bg: 'bg-yellow-200 dark:bg-yellow-600', border: 'border-yellow-300 dark:border-yellow-500' }
    case 'Concluído':
      return { bg: 'bg-green-200 dark:bg-green-500', border: 'border-green-300 dark:border-green-400' }
    case 'Atrasado':
      return { bg: 'bg-red-200 dark:bg-red-500', border: 'border-red-300 dark:border-red-400' }
    default:
      return { bg: 'bg-gray-200 dark:bg-gray-500', border: 'border-gray-300 dark:border-gray-400' }
  }
}

const STATUS_SEVERITY: Record<string, number> = {
  'Atrasado': 3,
  'Concluído': 2,
  'Fazendo': 1,
  'Não iniciado': 0
}

const pickPrimaryStatus = (statuses: string[]): string =>
  statuses.sort((a, b) => (STATUS_SEVERITY[b] || 0) - (STATUS_SEVERITY[a] || 0))[0] || 'Não iniciado'

export const getTaskStatuses = (task: any, statusField?: string): string[] => {
  if (statusField && task[statusField] !== undefined && task[statusField] !== null && String(task[statusField]).trim()) {
    return [String(task[statusField]).trim()]
  }

  const now = dayjs().startOf('day')
  const start = parseDate(task.start)
  const end = parseDate(task.end)
  const due = parseDate(task.due)
  const result: string[] = []

  if (!start || start.isAfter(now)) {
    result.push('Não iniciado')
    return result
  }

  if (end) {
    result.push('Concluído')
    if (due && end.isAfter(due)) result.push('Atrasado')
    return result
  }

  result.push('Fazendo')
  if (due && due.isBefore(now)) result.push('Atrasado')
  return result
}

export const getStatusColorValue = (status: string, customColors: Record<string, string> = {}): { bg: string; border: string } => {
  const custom = customColors[status]
  if (custom) {
    return {
      bg: custom,
      border: custom
    }
  }

  const legacy = getStatusColors(status)
  return {
    bg: legacy.bg,
    border: legacy.border
  }
}

export const calculateBarMetrics = (
  task: any,
  timelineData: TimelineData,
  granularity: Granularity,
  statusField?: string,
  statusColors: Record<string, string> = {}
): BarMetrics | null => {
  if (!task.start) return null

  const start = parseDate(task.start)
  if (!start) return null

  const end = parseDate(task.end)
  const due = parseDate(task.due)
  const now = dayjs().startOf('day')
  const statuses = getTaskStatuses(task, statusField)
  const status = pickPrimaryStatus(statuses)
  const hasExplicitStatus = Boolean(statusField && task[statusField] !== undefined && task[statusField] !== null && String(task[statusField]).trim())
  const colors = !hasExplicitStatus
    ? getStatusColors(status)
    : (statuses.includes('Atrasado') && !end) ? getStatusColors('Fazendo') : getStatusColors(status)
  const customColors = hasExplicitStatus ? getStatusColorValue(status, statusColors) : { bg: '', border: '' }

  const startISO = formatDateToISO(task.start)
  if (!startISO) return null
  const startPx = calculateDatePosition(startISO, timelineData)
  if (startPx < 0) return null

  // Determine the bar's end date
  // - If end exists, use it
  // - Else if due exists, use it
  // - Else fallback to start + 1 day
  const barEnd = end || due || start.add(1, 'day')
  const endPx = calculateDatePosition(barEnd.format('YYYY-MM-DD'), timelineData)
  const endPxValue = endPx >= 0 ? endPx : timelineData.totalDays * timelineData.daySize

  // width spans from start to barEnd
  let width = Math.max(endPxValue - startPx, 4)

  let plannedEndPx: number | undefined
  let overdueStartPx: number | undefined
  let overdueWidth: number | undefined
  let completedEarlyWidth: number | undefined
  let delayWidth: number | undefined

  if (due) {
    plannedEndPx = calculateDatePosition(due.format('YYYY-MM-DD'), timelineData)

    if (end && end.isBefore(due)) {
      // Completed before due: gray extension from end date to due date
      const compPx = calculateDatePosition(end.format('YYYY-MM-DD'), timelineData)
      if (compPx >= 0 && plannedEndPx !== undefined) {
        completedEarlyWidth = Math.max(plannedEndPx - compPx, 0)
        // Extend width to include the gray part
        width = Math.max(width, plannedEndPx - startPx)
      }
    }

    // Check if task is actually overdue based on dates (not status field)
    // This applies to both default and custom statuses
    // Atrasado (overdue) if: due date is in past AND (task not completed OR completed after due date)
    const isActuallyOverdue = due.isBefore(now) && (!end || end.isAfter(due))
    if (isActuallyOverdue && plannedEndPx !== undefined) {
      // Overdue: red stripes from due date to end date (or today if no end)
      const overdueEnd = end || now
      const overdueEndPx = overdueEnd.isAfter(due)
        ? calculateDatePosition(overdueEnd.format('YYYY-MM-DD'), timelineData)
        : -1
      if (plannedEndPx > 0) {
        overdueStartPx = plannedEndPx
        overdueWidth = Math.max(
          (overdueEndPx >= 0 ? overdueEndPx : now.diff(dayjs(timelineData.days[0].date), 'day') * timelineData.daySize + timelineData.daySize / 2) - plannedEndPx,
          0
        )
        // Extend width to include overdue part if it goes past barEnd
        if (overdueEndPx > endPxValue) {
          width = Math.max(width, overdueEndPx - startPx)
        }
      }
    }
  }

  if (statuses.includes('Não iniciado') && start && start.isBefore(now)) {
    delayWidth = now.diff(start, 'day') * timelineData.daySize
  }

  return { startPx, width, barEndPx: endPxValue, plannedEndPx, overdueStartPx, overdueWidth, completedEarlyWidth, delayWidth, status, statuses, colors, customColors }
}
