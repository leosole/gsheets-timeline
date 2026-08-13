import React from 'react'
import { calculateBarMetrics } from '../utils/barMetrics'
import type { TimelineData, Granularity } from '../utils/dateUtils'

interface TaskBarProps {
  task: any
  timelineData: TimelineData
  granularity: Granularity
  onSelect?: (task: any) => void
}

export const TaskBar: React.FC<TaskBarProps> = ({ task, timelineData, granularity, onSelect }) => {
  const metrics = calculateBarMetrics(task, timelineData, granularity)

  if (!metrics) return null

  return (
    <div
      className="relative h-6 flex items-center"
      style={{ width: `${timelineData.totalDays * timelineData.daySize}px` }}
    >
      <button
        className="absolute h-4 rounded transition-all duration-200 z-10 cursor-pointer hover:outline-1 hover:outline-foreground"
        style={{ left: `${metrics.startPx}px`, width: `${metrics.width}px` }}
        onClick={() => onSelect?.(task)}
      >
        <div className={`w-full h-full rounded border ${metrics.colors.bg} ${metrics.colors.border}`} />
      </button>

      {metrics.completedEarlyWidth !== undefined && metrics.completedEarlyWidth > 0 && (
        <div
          className="absolute h-4 rounded z-20 pointer-events-none"
          style={{
            left: `${metrics.barEndPx}px`,
            width: `${metrics.completedEarlyWidth}px`
          }}
        >
          <div className="w-full h-full rounded border" style={{ backgroundColor: 'oklch(0.84 0 0)', borderColor: 'oklch(0.84 0 0)' }} />
        </div>
      )}

      {metrics.overdueStartPx !== undefined && metrics.overdueWidth !== undefined && metrics.overdueWidth > 0 && (
        <div
          className="absolute h-4 rounded z-20 pointer-events-none"
          style={{
            left: `${metrics.overdueStartPx}px`,
            width: `${metrics.overdueWidth}px`
          }}
        >
          <div className="w-full h-full rounded border border-red-500 bg-[repeating-linear-gradient(45deg,rgba(255,120,120,1)_0,rgba(255,120,120,0.8)_4px,transparent_4px,transparent_8px)]" />
        </div>
      )}

      {metrics.delayWidth !== undefined && metrics.delayWidth > 0 && (
        <div
          className="absolute h-4 rounded z-20 pointer-events-none"
          style={{
            left: `${metrics.startPx}px`,
            width: `${metrics.delayWidth}px`
          }}
        >
          <div className="w-full h-full rounded bg-[repeating-linear-gradient(45deg,rgba(200,200,200,1)_0,rgba(200,200,200,0.8)_4px,transparent_4px,transparent_8px)]" />
        </div>
      )}

      {metrics.overdueStartPx !== undefined && metrics.plannedEndPx !== undefined && (
        <div
          className="absolute w-0.5 h-6 bg-red-500 z-30"
          style={{ left: `${metrics.plannedEndPx}px` }}
        />
      )}
    </div>
  )
}
