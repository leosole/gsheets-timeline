import React, { useEffect, useMemo, useState } from 'react'
import { Timeline } from './components/Timeline'
import {
  DEFAULT_SPREADSHEET_CONFIG,
  buildFieldOptions,
  normalizeFieldMap,
  normalizeStatusField,
  resolveTimelineLayout,
  sanitizeSpreadsheetData,
  type SpreadsheetConfig
} from './utils/sheetConfig'

// Data injected by the Google Sheets host
declare global {
  interface Window {
    __TIMELINE_DATA__?: any[]
    __TIMELINE_HEADERS__?: string[]
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
    statusField: normalizeStatusField(hostConfig.statusField),
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

const getWindowHeaders = (): string[] => {
  return Array.isArray(window.__TIMELINE_HEADERS__) ? window.__TIMELINE_HEADERS__ : []
}

const getSheetPayload = (): Promise<{ rows: any[]; headers: string[]; config: SpreadsheetConfig }> => {
  return new Promise((resolve) => {
    const appsScriptGoogle = (globalThis as any).google

    if (!appsScriptGoogle || !appsScriptGoogle.script || !appsScriptGoogle.script.run) {
      resolve({ rows: getWindowData(), headers: getWindowHeaders(), config: getWindowConfig() })
      return
    }

    appsScriptGoogle.script.run.withSuccessHandler((payload: string | { rows?: any[]; headers?: string[]; config?: Partial<SpreadsheetConfig> }) => {
      try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload || {}
        const rows = Array.isArray(parsed.rows) ? parsed.rows : getWindowData()
        const headers = Array.isArray(parsed.headers) ? parsed.headers : getWindowHeaders()
        const config = getHostConfig(parsed.config || getWindowConfig())
        resolve({ rows, headers, config })
      } catch (error) {
        resolve({ rows: getWindowData(), headers: getWindowHeaders(), config: getWindowConfig() })
      }
    }).getSheetState();
  })
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>(() => resolveTimelineLayout((window as any).__TIMELINE_MODE__) === 'timeline' ? 'timeline' : 'settings')
  const [config, setConfig] = useState<SpreadsheetConfig>(() => getWindowConfig())
  const [rows, setRows] = useState<any[]>(() => getWindowData())
  const [headers, setHeaders] = useState<string[]>(() => getWindowHeaders())

  useEffect(() => {
    const hasInjectedState = Array.isArray(window.__TIMELINE_DATA__) || !!window.__TIMELINE_CONFIG__

    const appsScriptGoogle = (globalThis as any).google

    if (!hasInjectedState && appsScriptGoogle && appsScriptGoogle.script && appsScriptGoogle.script.run) {
      getSheetPayload().then(({ rows, headers, config }) => {
        setRows(rows)
        setHeaders(headers)
        setConfig(config)
      })
      return
    }

    setRows(getWindowData())
    setHeaders(getWindowHeaders())
    setConfig(getWindowConfig())
  }, [])

  useEffect(() => {
    window.__TIMELINE_CONFIG__ = config
  }, [config])

  useEffect(() => {
    window.__TIMELINE_HEADERS__ = headers
  }, [headers])

  useEffect(() => {
    const mode = resolveTimelineLayout((window as any).__TIMELINE_MODE__)
    if (mode === 'timeline') {
      setActiveTab('timeline')
      return
    }
    setActiveTab('settings')
  }, [])

  const fieldOptions = useMemo(() => buildFieldOptions(rows, headers), [rows, headers])

  const metadataFields = useMemo(() => {
    const coreFields = new Set<string>([
      config.fieldMap.name,
      config.fieldMap.start,
      config.fieldMap.end,
      config.fieldMap.due,
      config.statusField || ''
    ].filter(Boolean))

    return fieldOptions.filter(option => !coreFields.has(option))
  }, [fieldOptions, config.fieldMap, config.statusField])

  const tasks = useMemo(() => sanitizeSpreadsheetData(rows, config.fieldMap), [rows, config.fieldMap])

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
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status column</label>
        <select
          value={config.statusField || ''}
          onChange={event => setConfig(current => ({ ...current, statusField: event.target.value }))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">None</option>
          {fieldOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
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
          {metadataFields.map(option => (
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
          {metadataFields.map(option => (
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
    <div className="h-full min-h-0 bg-background text-foreground" style={{ resize: 'both', overflow: 'auto' }}>
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold">Timeline</div>
            <div className="flex rounded-lg border border-border bg-background p-1">
              {(['settings', 'timeline'] as const).map(tab => (
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
              statusField={config.statusField}
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
