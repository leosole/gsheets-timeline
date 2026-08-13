import { getTaskStatuses } from './barMetrics'

export type TaskStatus = 'normal' | 'ahead' | 'warning' | 'overdue'

export const getTaskStatusLegacy = (task: any): TaskStatus => {
  const statuses = getTaskStatuses(task)
  if (statuses.includes('Atrasado')) return 'overdue'
  if (statuses.includes('Concluído')) return 'ahead'
  if (statuses.includes('Fazendo')) return 'warning'
  return 'normal'
}
