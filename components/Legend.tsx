import React, { useMemo, useRef } from 'react'

interface LegendProps {
  statusOptions?: string[]
  statusColors?: Record<string, string>
  hasCustomStatusField?: boolean
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  'Fazendo': '#facc15',
  'Concluído': '#22c55e',
  'Atrasado': '#ef4444',
  'Não iniciado': '#9ca3af'
}

const BASE_LEGEND_ITEMS = [
  { label: 'Previsto (atrasado)', kind: 'line', color: '#ef4444' },
  { label: 'Concluído antes do previsto', kind: 'swatch', color: 'oklch(0.84 0 0)' },
  { label: 'Hoje', kind: 'line', color: 'var(--timeline-today, #4a90d9)' }
]

const DEFAULT_STATUS_LABELS = ['Fazendo', 'Concluído', 'Atrasado', 'Não iniciado']

export const Legend: React.FC<LegendProps> = ({ statusOptions = [], statusColors = {}, hasCustomStatusField = false }) => {
  const colorInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const dynamicItems = useMemo(() => {
    if (!hasCustomStatusField) {
      return DEFAULT_STATUS_LABELS.map(label => ({
        label,
        kind: 'swatch',
        color: statusColors[label] || DEFAULT_STATUS_COLORS[label]
      }))
    }
    return statusOptions.map((label, index) => ({
      label,
      kind: 'swatch',
      color: statusColors[label] || `hsl(${(index * 63) % 360} 70% 60%)`
    }))
  }, [statusOptions, statusColors, hasCustomStatusField])

  const handleColorChange = (label: string, nextColor: string) => {
    const safeColor = nextColor || '#808080'
    const nextColors = { ...statusColors, [label]: safeColor }
    window.dispatchEvent(new CustomEvent('timeline:status-color-change', { detail: { label, color: safeColor } }))
    Object.assign(statusColors, nextColors)
  }

  return (
    <div className="sticky bottom-0 z-40 border-t border-border bg-muted/50 px-4 py-3 shadow-[0_-1px_0_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
        {dynamicItems.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className={hasCustomStatusField ? "h-3 w-3 rounded cursor-pointer hover:opacity-80 transition-opacity" : "h-3 w-3 rounded"}
              style={{ backgroundColor: item.color, border: `1px solid ${item.color}` }}
              onClick={() => {
                if (hasCustomStatusField) {
                  colorInputRefs.current[item.label]?.click()
                }
              }}
              title={hasCustomStatusField ? "Click to change color" : undefined}
            />
            {hasCustomStatusField && (
              <input
                ref={node => {
                  if (node) colorInputRefs.current[item.label] = node
                }}
                type="color"
                aria-label={`Choose color for ${item.label}`}
                value={item.color}
                className="hidden"
                onChange={event => handleColorChange(item.label, event.target.value)}
              />
            )}
            <span>{item.label}</span>
          </div>
        ))}
        {BASE_LEGEND_ITEMS.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            {item.kind === 'line' ? (
              <div className="h-4 w-0.5" style={{ backgroundColor: item.color }} />
            ) : (
              <div className="h-3 w-3 rounded" style={{ backgroundColor: item.color, border: `1px solid ${item.color}` }} />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
