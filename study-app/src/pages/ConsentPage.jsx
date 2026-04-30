import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParticipant } from '../context/ParticipantContext'
import { supabase } from '../lib/supabase'
import { t } from '../locales'
import consentMd from '../content/consent_phase1.md?raw'

const CONSENT_VERSION = 'v1.0'

export default function ConsentPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useParticipant()
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleBegin = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    const now = new Date().toISOString()

    const coarseUserAgent = [navigator.platform, navigator.language]
      .filter(Boolean)
      .join(' | ')

    try {
      // Create participant row
      await supabase.from('participants').upsert({
        id: state.participantId,
        group_code: state.group,
        prolific_pid: state.prolificPid ?? null,
        status: 'in_progress',
        session_seed: state.participantId,
        user_agent: coarseUserAgent,
      }, { onConflict: 'id', ignoreDuplicates: true })

      // Log consent event
      await supabase.from('consent_events').insert({
        participant_id: state.participantId,
        consent_version: CONSENT_VERSION,
        consented_at: now,
      })
    } catch {
      // Intentionally silent: no participant identifiers in client logs.
    }

    dispatch({ type: 'SET_CONSENT', payload: now })
    setSubmitting(false)
    navigate('/demographics')
  }

  const handleDecline = () => {
    navigate('/withdrawn?reason=declined_consent')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-700 px-8 py-5">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">
            {t('study.subtitle')}
          </p>
          <h2 className="text-xl font-bold text-white">{t('consent.heading')}</h2>
        </div>

        <div className="p-8">
          <div
            className="bg-slate-50 border border-slate-200 rounded-xl p-5 h-72 overflow-y-auto text-sm text-slate-600 leading-relaxed prose prose-sm max-w-none"
            role="region"
            aria-label="Consent form text"
            tabIndex={0}
          >
            <Markdown remarkPlugins={[remarkGfm]}>{consentMd}</Markdown>
          </div>

          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              aria-describedby="consent-label"
            />
            <span id="consent-label" className="text-sm text-slate-700 leading-relaxed select-none">
              {t('consent.checkbox')}
            </span>
          </label>

          <button
            onClick={handleBegin}
            disabled={!checked || submitting}
            className={`mt-5 w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
              checked && !submitting
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Starting…' : t('consent.begin')}
          </button>

          <div className="text-center mt-3">
            <button
              onClick={handleDecline}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
            >
              {t('consent.decline')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
