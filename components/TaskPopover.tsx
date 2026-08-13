import React, { useRef, useEffect } from 'react'
import dayjs from 'dayjs'
import { getTaskStatuses } from '../utils/barMetrics'
import { parseDate } from '../utils/dateUtils'

interface TaskPopoverProps {
  task: any
  popupFields?: string[]
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  'Fazendo': 'text-yellow-600 dark:text-yellow-400',
  'Concluído': 'text-green-600 dark:text-green-400',
  'Atrasado': 'text-red-600 dark:text-red-400',
  'Não iniciado': 'text-gray-500 dark:text-gray-400'
}

const STATUS_ICON: Record<string, string> = {
  'Fazendo': '●',
  'Concluído': '✓',
  'Atrasado': '●',
  'Não iniciado': '○'
}

const STATUS_BORDER: Record<string, string> = {
  'Fazendo': 'border-yellow-400 dark:border-yellow-600',
  'Concluído': 'border-green-400 dark:border-green-600',
  'Atrasado': 'border-red-400 dark:border-red-600',
  'Não iniciado': 'border-gray-400 dark:border-gray-500'
}

const STATUS_LABEL: Record<string, string> = {
  'Fazendo': 'Em andamento',
  'Concluído': 'Concluído',
  'Atrasado': 'Atrasado',
  'Não iniciado': 'Não iniciado'
}

export const TaskPopover: React.FC<TaskPopoverProps> = ({ task, popupFields = [], onClose }) => {
  const ref = useRef<HTMLDivElement>(null)
  const statuses = getTaskStatuses(task)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—'
    const d = parseDate(date)
    return d ? d.format('DD/MM/YYYY') : date
  }

  const now = dayjs().startOf('day')
  const start = parseDate(task.start)
  const end = parseDate(task.end)
  const due = parseDate(task.due)

  const detailLines: string[] = []
  if (statuses.includes('Atrasado') && due) {
    const diff = now.diff(due, 'day')
    detailLines.push(`Atrasado em ${diff} dia(s)`)
    if (end && due) {
      const endDiff = end.diff(due, 'day')
      if (endDiff > 0) detailLines.push(`Concluído ${endDiff} dia(s) após o previsto`)
    }
  }
  if (statuses.includes('Concluído') && end && due) {
    const diff = end.diff(due, 'day')
    if (diff <= 0) {
      detailLines.push(`Concluído ${Math.abs(diff) === 0 ? 'no prazo' : `${Math.abs(diff)} dia(s) antes do previsto`}`)
    }
  } else if (statuses.includes('Concluído') && end && !due) {
    detailLines.push('Concluído (sem data prevista)')
  }
  if (statuses.includes('Fazendo') && !statuses.includes('Atrasado') && due) {
    const remaining = due.diff(now, 'day')
    if (remaining < 0) {
      detailLines.push(`Atrasado em ${Math.abs(remaining)} dia(s)`)
    } else if (remaining === 0) {
      detailLines.push('Vence hoje')
    } else if (remaining <= 3) {
      detailLines.push(`Vence em ${remaining} dia(s)`)
    } else {
      detailLines.push('No prazo')
    }
  }
  if (statuses.includes('Não iniciado')) {
    if (start && start.isBefore(now)) {
      const delay = now.diff(start, 'day')
      detailLines.push(`Atrasado para iniciar (${delay} dia(s))`)
    } else if (start) {
      const remaining = start.diff(now, 'day')
      detailLines.push(`Agendado para iniciar em ${remaining} dia(s)`)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.15)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={ref} className="bg-card border border-border rounded-lg shadow-lg w-80 max-h-[80vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-base truncate pr-2">{task.name}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none p-0 border-0 bg-transparent cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {statuses.map(s => (
              <div key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-transparent ${STATUS_BORDER[s]} ${STATUS_COLOR[s]}`}>
                <span>{STATUS_ICON[s]}</span>
                <span>{STATUS_LABEL[s] || s}</span>
              </div>
            ))}
          </div>

          {detailLines.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              {detailLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-2 space-y-1.5 text-xs">
            {task.start && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Início:</span>
                <span className="font-medium">{formatDate(task.start)}</span>
              </div>
            )}
            {task.end && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fim:</span>
                <span className="font-medium">{formatDate(task.end)}</span>
              </div>
            )}
            {task.due && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previsto:</span>
                <span className="font-medium">{formatDate(task.due)}</span>
              </div>
            )}
          </div>

          {popupFields.length > 0 && (
            <div className="border-t border-border pt-2 space-y-1.5 text-xs">
              {popupFields.map(field => {
                const val = task[field]
                if (val === undefined || val === null || val === '') return null
                return (
                  <div key={field} className="flex justify-between">
                    <span className="text-muted-foreground">{field}:</span>
                    <span className="font-medium text-right max-w-[60%] truncate">{String(val)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
