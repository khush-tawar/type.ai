const DEBRIEF_TEXT = `[REPLACE WITH YOUR IRB-APPROVED DEBRIEF TEXT]

WHAT WAS THIS STUDY ABOUT?
This study investigated how fluent Devanagari readers evaluate typography produced by different systems. You viewed a mix of letterforms created by artificial intelligence, professional type designers, and historical sources — without being told which was which. Your judgments help researchers understand what makes AI-generated Devanagari look authentic or inauthentic to native readers.

WHY DOES THIS MATTER?
As AI systems increasingly generate text in Indic scripts, it is important to evaluate whether they produce typography that is culturally authentic and structurally correct. The expertise of fluent readers like you is essential to this research. Findings may directly inform improvements to AI typography tools that serve Hindi, Marathi, Nepali, and Sanskrit-speaking communities.

WERE ANY STIMULI DECEPTIVE?
You were not told the source of each letterform, but this was disclosed in the consent form and is not considered deception under IRB guidelines. No letterforms were deliberately malformed beyond what naturally occurs in different production methods.

HOW WILL YOUR DATA BE USED?
Your anonymous responses will be analyzed to identify patterns in what readers accept or reject across different source types. Results will be shared through academic publications and may inform open-source improvements to AI typography systems.

WITHDRAWING YOUR DATA
If you decide you no longer wish your data to be included after completing the study, contact the researcher with your participant code (shown above) within 14 days of participation.

QUESTIONS OR CONCERNS?
[Researcher Name] · [Institution] · [Email] · IRB Protocol [Number]`

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
