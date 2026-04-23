import { useState } from 'react'

const CONSENT_TEXT = `INFORMED CONSENT

PURPOSE OF THE STUDY
You are invited to participate in a research study on multilingual typeface perception. The study examines how fluent readers evaluate script rendering quality across different writing systems.

WHAT YOU WILL DO
You will view script images and rate them on quality-related criteria. Some items may also allow optional annotation or correction marking. The study takes approximately 12-20 minutes.

ELIGIBILITY
You should be at least 18 years old and familiar with reading the script(s) shown in the study.

RISKS AND BENEFITS
This study involves minimal risk, comparable to everyday online activities. There is no direct personal benefit, but your responses will help improve AI-assisted typography research and evaluation workflows.

CONFIDENTIALITY AND DATA USE
Your responses are collected without direct personal identifiers. A random participant ID is generated for analysis. Data is stored in a secure research database and used for aggregated analysis, reporting, and research outputs.

VOLUNTARY PARTICIPATION
Participation is voluntary. You may stop at any time before final submission. You may skip specific items where allowed.

COMPENSATION
If this study was accessed via a recruitment platform, your completion code will be shown on the final page after submission.

CONTACT
For questions about this study, use the recruitment platform message channel associated with this task listing.`

export default function WelcomePage({ onComplete }) {
  const [consented, setConsented] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-700 px-8 py-6">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Human Subjects Research</p>
          <h1 className="text-2xl font-bold text-white leading-snug">
            Devanagari Typography<br />Evaluation Study
          </h1>
          <p className="text-indigo-200 text-sm mt-2">IRB Approved · Anonymous · ~15–20 minutes</p>
        </div>

        <div className="p-8">
          <p className="text-sm font-semibold text-slate-700 mb-3">Informed Consent</p>
          <div
            className="bg-slate-50 rounded-xl border border-slate-200 p-5 h-64 overflow-y-auto text-sm text-slate-600 leading-relaxed"
            role="region"
            aria-label="Consent form text"
            tabIndex={0}
          >
            <pre className="whitespace-pre-wrap font-sans">{CONSENT_TEXT}</pre>
          </div>

          <label className="flex items-start gap-3 mt-5 cursor-pointer group">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              aria-describedby="consent-label"
            />
            <span id="consent-label" className="text-sm text-slate-700 leading-relaxed select-none">
              I have read and understood the information above. I am 18 years of age or older,
              can read Devanagari script, and voluntarily agree to participate in this study.
            </span>
          </label>

          <button
            onClick={onComplete}
            disabled={!consented}
            aria-disabled={!consented}
            className={`mt-6 w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-150 ${
              consented
                ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Begin Study →
          </button>

          <p className="text-center text-xs text-slate-400 mt-4">
            Your progress is automatically saved if you need to take a break.
          </p>
        </div>
      </div>
    </div>
  )
}
