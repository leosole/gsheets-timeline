import React from 'react'

export const Legend: React.FC = () => {
  return (
    <div className="border-t border-border bg-muted/50 px-4 py-3">
      <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-200 dark:bg-yellow-600 border border-yellow-300 dark:border-yellow-500 rounded" />
          <span>Fazendo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-200 dark:bg-green-500 border border-green-300 dark:border-green-400 rounded" />
          <span>Concluído</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-200 dark:bg-red-500 border border-red-300 dark:border-red-400 rounded" />
          <span>Atrasado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-200 dark:bg-gray-500 border border-gray-300 dark:border-gray-400 rounded" />
          <span>Não iniciado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-red-500" />
          <span>Previsto (atrasado)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'oklch(0.84 0 0)', border: '1px solid oklch(0.84 0 0)' }} />
          <span>Concluído antes do previsto</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-timeline-today" />
          <span>Hoje</span>
        </div>
      </div>
    </div>
  )
}
