import { useState } from 'react'

const CONSENT_TEXT = `[REPLACE WITH YOUR IRB-APPROVED CONSENT FORM TEXT]

PURPOSE OF STUDY
You are invited to participate in a research study evaluating Devanagari typography. The purpose of this study is to assess how accurately different typography systems reproduce authentic Devanagari script letterforms, as judged by fluent readers.

PROCEDURES
You will view a series of Devanagari letterforms and provide ratings on their authenticity and quality. The study takes approximately 15–20 minutes. For some stimuli, you may also draw corrections directly on the image using your finger or mouse.

ELIGIBILITY
You must be 18 years of age or older and able to read Devanagari script (Hindi, Marathi, Sanskrit, Nepali, or a related language).

RISKS AND BENEFITS
There are no known risks associated with this study beyond those encountered in everyday life. Your participation will contribute to research on typography and AI systems that serve communities using Devanagari script.

CONFIDENTIALITY
Your responses will be collected anonymously. No personally identifiable information will be collected. A randomly generated ID will be used in place of your name. Data will be stored securely on encrypted servers and used only for research purposes.

VOLUNTARY PARTICIPATION
Participation is completely voluntary. You may skip any item, take breaks, or withdraw at any time without penalty or loss of compensation.

DATA AND COMPENSATION
If you were recruited through Prolific, a completion code will be displayed at the end of the study. You must complete the study to receive compensation.

CONTACT INFORMATION
If you have questions about this study or your rights as a research participant, please contact:

Principal Investigator: [Your Name]
Institution: [Your Institution]
Email: [Your Email]
IRB Protocol: [Protocol Number]`

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
