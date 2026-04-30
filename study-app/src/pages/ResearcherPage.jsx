import { useState, useEffect } from 'react'
import JSZip from 'jszip'
import { supabase } from '../lib/supabase'
import { t } from '../locales'

const PASSPHRASE = import.meta.env.VITE_RESEARCHER_PASSPHRASE || ''

function jsonToCsv(rows) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = keys.join(',')
  const body = rows.map(r => keys.map(k => escape(r[k])).join(',')).join('\n')
  return `${header}\n${body}`
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function listAllDrawingPaths(bucket, basePath = '') {
  const stack = [basePath]
  const filePaths = []

  while (stack.length > 0) {
    const currentPath = stack.pop()
    const { data, error } = await bucket.list(currentPath, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error

    for (const item of data || []) {
      const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name
      if (item.id === null) {
        stack.push(fullPath)
      } else if (item.name.toLowerCase().endsWith('.png')) {
        filePaths.push(fullPath)
      }
    }
  }

  return filePaths
}

export default function ResearcherPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [wrong, setWrong] = useState(false)
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingCsv, setLoadingCsv] = useState(false)
  const [loadingZip, setLoadingZip] = useState(false)

  const unlock = () => {
    if (!PASSPHRASE || input === PASSPHRASE) {
      setUnlocked(true)
    } else {
      setWrong(true)
    }
  }

  useEffect(() => {
    if (!unlocked) return
    setLoadingStats(true)
    Promise.all([
      supabase.from('participants').select('group_code, status', { count: 'exact' }),
    ]).then(([{ data, error }]) => {
      if (error || !data) { setLoadingStats(false); return }
      const byGroup = {}
      const byStatus = {}
      for (const row of data) {
        byGroup[row.group_code] = (byGroup[row.group_code] || 0) + 1
        byStatus[row.status] = (byStatus[row.status] || 0) + 1
      }
      setStats({ total: data.length, byGroup, byStatus })
      setLoadingStats(false)
    })
  }, [unlocked])

  const handleDownloadCsv = async () => {
    setLoadingCsv(true)
    try {
      const { data: rows, error } = await supabase.rpc('export_study_dataset')
      if (error) throw error

      const csv = jsonToCsv(rows || [])
      const ts = new Date().toISOString().slice(0, 10)
      downloadCsv(csv, `study-responses-${ts}.csv`)
    } catch {
      alert('CSV export failed. Ensure schema.sql has been applied and the export function exists.')
    }
    setLoadingCsv(false)
  }

  const handleDownloadDrawingsZip = async () => {
    setLoadingZip(true)
    try {
      const bucket = supabase.storage.from('drawings')
      const paths = await listAllDrawingPaths(bucket)

      if (paths.length === 0) {
        alert('No drawing PNG files found in the drawings bucket.')
        setLoadingZip(false)
        return
      }

      const zip = new JSZip()
      for (const path of paths) {
        const { data, error } = await bucket.download(path)
        if (error || !data) continue

        const [participantId = 'participant', filename = 'drawing.png'] = path.split('/')
        const cleanStimulus = filename.replace(/\.png$/i, '')
        zip.file(`${participantId}_${cleanStimulus}.png`, data)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const ts = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `study-drawings-${ts}.zip`)
    } catch {
      alert('Drawings ZIP download failed. Check drawings bucket access policy and try again.')
    }
    setLoadingZip(false)
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 p-8">
          <h1 className="text-lg font-semibold text-slate-800 mb-6">{t('researcher.heading')}</h1>
          <label htmlFor="passphrase" className="block text-sm font-medium text-slate-700 mb-2">
            {t('researcher.passphrase_prompt')}
          </label>
          <input
            id="passphrase"
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setWrong(false) }}
            onKeyDown={e => e.key === 'Enter' && unlock()}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="current-password"
          />
          {wrong && <p className="text-xs text-red-500 mb-2">{t('researcher.wrong_passphrase')}</p>}
          {!PASSPHRASE && (
            <p className="text-xs text-amber-600 mb-2">
              VITE_RESEARCHER_PASSPHRASE is not set — any input will unlock.
            </p>
          )}
          <button
            onClick={unlock}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {t('researcher.unlock')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-slate-800">{t('researcher.heading')}</h1>

        {/* Aggregate stats */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Overview</h2>
          {loadingStats ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : stats ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total sessions</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">By group</p>
                  {Object.entries(stats.byGroup).map(([g, n]) => (
                    <div key={g} className="flex justify-between text-sm text-slate-700 py-0.5">
                      <span>Group {g}</span><span className="font-mono">{n}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">By status</p>
                  {Object.entries(stats.byStatus).map(([s, n]) => (
                    <div key={s} className="flex justify-between text-sm text-slate-700 py-0.5">
                      <span>{s}</span><span className="font-mono">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">
                  Completion rate:{' '}
                  <strong className="text-slate-700">
                    {stats.total > 0
                      ? `${Math.round(((stats.byStatus.completed || 0) / stats.total) * 100)}%`
                      : '—'}
                  </strong>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No data yet.</p>
          )}
        </div>

        {/* Export */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Export</h2>

          <div>
            <button
              onClick={handleDownloadCsv}
              disabled={loadingCsv}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loadingCsv ? 'Preparing CSV…' : t('researcher.csv_download')}
            </button>
            <p className="text-xs text-slate-400 mt-2">
              One row per stimulus response, with participant demographics inlined.
              Source types are included — do not share this file with participants.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Drawing annotations
            </p>
            <div className="space-y-2">
              <button
                onClick={handleDownloadDrawingsZip}
                disabled={loadingZip}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loadingZip ? 'Preparing ZIP…' : 'Download drawings ZIP'}
              </button>
              <p className="text-xs text-slate-500">{t('researcher.drawings_note')}</p>
            </div>
          </div>
        </div>

        {/* IRB retention reminder */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">IRB Retention</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Per IRB protocol, delete all response data 3 years post-study using:
          </p>
          <pre className="mt-2 text-xs bg-amber-100 rounded p-2 overflow-x-auto text-amber-900">
{`-- Run in Supabase SQL editor
DELETE FROM responses;
DELETE FROM consent_events;
DELETE FROM participants;
-- Also empty the drawings/ Storage bucket manually.`}
          </pre>
          <p className="text-xs text-amber-600 mt-2">
            Screenshot this action per IIT IRB primer guidance on destruction events.
          </p>
        </div>
      </div>
    </div>
  )
}
