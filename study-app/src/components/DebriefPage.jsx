const DEBRIEF_TEXT = `THANK YOU FOR PARTICIPATING

WHAT THIS STUDY MEASURED
This study evaluated how participants perceive typeface quality across multiple scripts. You reviewed rendered text samples and provided ratings that help compare visual authenticity, readability, and structural consistency.

WHY THIS RESEARCH MATTERS
Your judgments help identify where current AI and digital typography systems perform well and where they need improvement, especially for multilingual and non-Latin scripts.

ABOUT STIMULUS SOURCES
During the task, the source category of each sample was not shown in order to reduce bias in ratings. This is a standard research design choice for perception studies.

HOW YOUR DATA WILL BE USED
Submitted responses are analyzed in aggregate for research and model evaluation. Findings may be used in technical reports, publications, and future improvements to typography generation systems.

PRIVACY
No direct personal identifiers are required for analysis. Your session is associated with a random participant ID.

QUESTIONS
If you have questions about this study, please contact the study team through the same recruitment channel used to access this task.`

export default function DebriefPage({ participantId, submitError }) {
  const completionCode = import.meta.env.VITE_PROLIFIC_CODE || 'DEVTYPE25'
  const shortId = participantId?.replace(/-/g, '').slice(0, 8).toUpperCase() ?? '--------'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-emerald-600 px-8 py-6">
          <div className="text-3xl mb-2" aria-hidden>🎉</div>
          <h2 className="text-xl font-bold text-white">Study Complete!</h2>
          <p className="text-emerald-200 text-sm mt-1">Thank you for your valuable contribution to this research.</p>
        </div>

        <div className="p-8 space-y-6">
          {submitError && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-800">
              <strong>Note:</strong> There was an issue submitting your responses to our server. Your data has
              been preserved locally. Please contact the researcher with your participant code below so we can
              manually retrieve your data.
            </div>
          )}

          {/* Prolific completion code */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
              Prolific Completion Code
            </p>
            <p
              className="text-3xl font-mono font-bold text-indigo-900 tracking-widest select-all"
              aria-label={`Completion code: ${completionCode}`}
            >
              {completionCode}
            </p>
            <p className="text-xs text-indigo-500 mt-2">
              Copy this code and enter it in Prolific to receive your compensation.
            </p>
          </div>

          {/* Debrief text */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Study Debrief</p>
            <div
              className="bg-slate-50 border border-slate-200 rounded-xl p-5 h-60 overflow-y-auto text-sm text-slate-600 leading-relaxed"
              role="region"
              aria-label="Study debrief text"
              tabIndex={0}
            >
              <pre className="whitespace-pre-wrap font-sans">{DEBRIEF_TEXT}</pre>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">
            Your responses have been submitted anonymously.{' '}
            <span className="font-mono">Participant {shortId}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
