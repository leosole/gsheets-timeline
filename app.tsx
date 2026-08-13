import React, { useEffect, useMemo, useState } from 'react'
import { Timeline } from './components/Timeline'
import {
  DEFAULT_SPREADSHEET_CONFIG,
  normalizeFieldMap,
  sanitizeSpreadsheetData,
  type SpreadsheetConfig
} from './utils/sheetConfig'

// Data injected by the Google Sheets host
declare global {
  interface Window {
    __TIMELINE_DATA__?: any[]
    __TIMELINE_CONFIG__?: Partial<SpreadsheetConfig>
    __TIMELINE_REFRESH__?: () => void
  }

  const google: {
    script?: {
      run?: {
        withSuccessHandler: (handler: (payload: any) => void) => {
          getSheetState: () => void
        }
      }
    }
  } | undefined
}

type TabName = 'timeline' | 'settings'

const getHostConfig = (hostConfig: Partial<SpreadsheetConfig> = {}): SpreadsheetConfig => {
  const base = { ...DEFAULT_SPREADSHEET_CONFIG, ...hostConfig }

  return {
    ...base,
    fieldMap: normalizeFieldMap(hostConfig.fieldMap),
    popupFields: Array.isArray(hostConfig.popupFields) ? hostConfig.popupFields : DEFAULT_SPREADSHEET_CONFIG.popupFields,
    filterFields: Array.isArray(hostConfig.filterFields) ? hostConfig.filterFields : DEFAULT_SPREADSHEET_CONFIG.filterFields
  }
}

const getWindowConfig = (): SpreadsheetConfig => {
  return getHostConfig(window.__TIMELINE_CONFIG__ || {})
}

const getWindowData = (): any[] => {
  return Array.isArray(window.__TIMELINE_DATA__) ? window.__TIMELINE_DATA__ : []
}

const getSheetPayload = (): Promise<{ rows: any[]; config: SpreadsheetConfig }> => {
  return new Promise((resolve) => {
    const appsScriptGoogle = (globalThis as any).google

    if (!appsScriptGoogle || !appsScriptGoogle.script || !appsScriptGoogle.script.run) {
      resolve({ rows: getWindowData(), config: getWindowConfig() })
      return
    }

    appsScriptGoogle.script.run.withSuccessHandler((payload: string | { rows?: any[]; config?: Partial<SpreadsheetConfig> }) => {
      try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload || {}
        const rows = Array.isArray(parsed.rows) ? parsed.rows : getWindowData()
        const config = getHostConfig(parsed.config || getWindowConfig())
        resolve({ rows, config })
      } catch (error) {
        resolve({ rows: getWindowData(), config: getWindowConfig() })
      }
    }).getSheetState();
  })
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('timeline')
  const [config, setConfig] = useState<SpreadsheetConfig>(() => getWindowConfig())
  const [rows, setRows] = useState<any[]>(() => getWindowData())
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const hasInjectedState = Array.isArray(window.__TIMELINE_DATA__) || !!window.__TIMELINE_CONFIG__

    const appsScriptGoogle = (globalThis as any).google

    if (!hasInjectedState && appsScriptGoogle && appsScriptGoogle.script && appsScriptGoogle.script.run) {
      getSheetPayload().then(({ rows, config }) => {
        setRows(rows)
        setConfig(config)
      })
      return
    }

    setRows(getWindowData())
    setConfig(getWindowConfig())
  }, [])

  useEffect(() => {
    window.__TIMELINE_CONFIG__ = config
  }, [config])

  const fieldOptions = useMemo(() => {
    const options = new Set<string>()
    rows.forEach(row => {
      Object.keys(row || {}).forEach(key => options.add(key))
    })
    return Array.from(options).sort()
  }, [rows])

  const tasks = useMemo(() => sanitizeSpreadsheetData(rows, config.fieldMap), [rows, config.fieldMap])

  const syncWithSheet = () => {
    setIsRefreshing(true)
    const nextRows = getWindowData()
    setRows(nextRows)
    setConfig(getWindowConfig())

    if (typeof window.__TIMELINE_REFRESH__ === 'function') {
      try {
        window.__TIMELINE_REFRESH__()
      } catch (error) {
        console.warn('Refresh callback failed:', error)
      }
    }

    window.dispatchEvent(new CustomEvent('timeline:refresh', { detail: { rows: nextRows, config } }))
    window.setTimeout(() => setIsRefreshing(false), 150)
  }

  const updateFieldSelection = (key: 'name' | 'start' | 'end' | 'due', value: string) => {
    setConfig(current => ({
      ...current,
      fieldMap: {
        ...current.fieldMap,
        [key]: value
      }
    }))
  }

  const toggleSelectionList = (field: 'popupFields' | 'filterFields', value: string) => {
    setConfig(current => {
      const existing = current[field] || []
      const next = existing.includes(value)
        ? existing.filter(item => item !== value)
        : [...existing, value]

      return {
        ...current,
        [field]: next
      }
    })
  }

  const settingsPanel = (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timeline title</label>
        <input
          value={config.title}
          onChange={event => setConfig(current => ({ ...current, title: event.target.value }))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Project timeline"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sheet name</label>
        <input
          value={config.sheetName || ''}
          onChange={event => setConfig(current => ({ ...current, sheetName: event.target.value }))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Sheet1"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sheet URL</label>
        <input
          value={config.sheetUrl || ''}
          onChange={event => setConfig(current => ({ ...current, sheetUrl: event.target.value }))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="https://docs.google.com/spreadsheets/..."
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {([
          ['name', 'Name column'],
          ['start', 'Start date'],
          ['end', 'End date'],
          ['due', 'Due date']
        ] as const).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
            <select
              value={config.fieldMap[key]}
              onChange={event => updateFieldSelection(key, event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a column</option>
              {fieldOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Popup extra fields</label>
        <div className="flex flex-wrap gap-2">
          {fieldOptions.map(option => (
            <label key={option} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
              <input
                type="checkbox"
                checked={(config.popupFields || []).includes(option)}
                onChange={() => toggleSelectionList('popupFields', option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filter fields</label>
        <div className="flex flex-wrap gap-2">
          {fieldOptions.map(option => (
            <label key={option} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
              <input
                type="checkbox"
                checked={(config.filterFields || []).includes(option)}
                onChange={() => toggleSelectionList('filterFields', option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold">Timeline</div>
            <div className="flex rounded-lg border border-border bg-background p-1">
              {(['timeline', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    activeTab === tab
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'timeline' ? 'Timeline' : 'Configuration'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={syncWithSheet}
            disabled={isRefreshing}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? 'Updating…' : 'Update'}
          </button>
        </div>
      </div>

      {activeTab === 'timeline' ? (
        <>
          {tasks.length > 0 ? (
            <Timeline
              tasks={tasks}
              title={config.title}
              filterFields={config.filterFields}
              popupFields={config.popupFields}
              sheetUrl={config.sheetUrl}
            />
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center p-8 text-center">
              <div className="max-w-md rounded-lg border border-dashed border-border bg-card p-6">
                <h2 className="text-lg font-semibold">No spreadsheet rows loaded</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open the Configuration tab, map the date columns, and click Update to sync the spreadsheet data.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        settingsPanel
      )}
    </div>
  )
}

export default App
