import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParticipant } from '../context/ParticipantContext'
import { t } from '../locales'
import debriefMd from '../content/debrief.md?raw'

export default function ThanksPage() {
  const { state } = useParticipant()
  const completionCode = import.meta.env.VITE_PROLIFIC_CODE || 'DEVTYPE25'
  const shortId = state.participantId?.replace(/-/g, '').slice(0, 8).toUpperCase() ?? '--------'
  const fromProlific = !!state.prolificPid

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-emerald-600 px-8 py-6">
          <div className="text-3xl mb-2" aria-hidden>🎉</div>
          <h2 className="text-xl font-bold text-white">{t('thanks.heading')}</h2>
          <p className="text-emerald-100 text-sm mt-1">{t('thanks.subheading')}</p>
        </div>

        <div className="p-8 space-y-6">
          {fromProlific && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
                {t('thanks.code_label')}
              </p>
              <p
                className="text-3xl font-mono font-bold text-indigo-900 tracking-widest select-all"
                aria-label={`Completion code: ${completionCode}`}
              >
                {completionCode}
              </p>
              <p className="text-xs text-indigo-500 mt-1.5">{t('thanks.code_instruction')}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Study Debrief</p>
            <div
              className="bg-slate-50 border border-slate-200 rounded-xl p-5 h-64 overflow-y-auto text-sm text-slate-600 leading-relaxed prose prose-sm max-w-none"
              role="region"
              aria-label="Study debrief"
              tabIndex={0}
            >
              <Markdown remarkPlugins={[remarkGfm]}>{debriefMd}</Markdown>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">
            Responses submitted anonymously · Participant{' '}
            <span className="font-mono">{shortId}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
