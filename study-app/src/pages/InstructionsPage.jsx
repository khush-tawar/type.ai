import { useNavigate } from 'react-router-dom'
import { useParticipant } from '../context/ParticipantContext'
import { t } from '../locales'

const STEPS = [
  {
    n: 1,
    title: 'View a letterform',
    body: 'You will see a script sample displayed on screen. Take a moment to look at it carefully.',
  },
  {
    n: 2,
    title: 'Accept or reject',
    body: 'Decide whether it looks like authentic, natural script. Trust your first impression.',
  },
  {
    n: 3,
    title: 'Rate three qualities',
    body: 'Use 1–7 scales to rate structural correctness, cultural authenticity, and readability.',
  },
  {
    n: 4,
    title: 'Classify the style',
    body: 'Choose the typographic style that best describes this letterform (e.g., Serif, Handwriting, Pixel).',
  },
  {
    n: 5,
    title: 'Optional: note issues and draw corrections',
    body: 'On some items you can describe problems in text and draw annotations directly on the image.',
  },
]

const EXAMPLE_RATING = {
  stimulus: null,
  verdict: 'Reject',
  likert: [4, 3, 5],
}

export default function InstructionsPage() {
  const navigate = useNavigate()
  const { state } = useParticipant()
  const total = state.sessionStimuli.length

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-700 px-8 py-5">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">
            {t('instructions.step')}
          </p>
          <h2 className="text-xl font-bold text-white">{t('instructions.heading')}</h2>
        </div>

        <div className="p-8 space-y-5">
          <p className="text-sm text-slate-600">
            You will evaluate{' '}
            <strong className="text-slate-800">{total} script samples</strong>, one at a time.
            For each one:
          </p>

          <ol className="space-y-4" role="list">
            {STEPS.map(step => (
              <li key={step.n} className="flex gap-4">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold"
                  aria-hidden
                >
                  {step.n}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Demo item (inert) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Example — responses not recorded
            </p>
            <div className="bg-white border border-slate-200 rounded-lg h-28 flex items-center justify-center mb-3">
              <span className="text-slate-300 text-sm">Sample letterform would appear here</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="py-2 rounded-lg text-center text-xs font-medium bg-slate-200 text-slate-500">Looks authentic</div>
              <div className="py-2 rounded-lg text-center text-xs font-medium bg-red-100 text-red-600 border border-red-200">Doesn't look authentic ✓</div>
            </div>
            <div className="flex gap-1 justify-center">
              {[1,2,3,4,5,6,7].map(n => (
                <div
                  key={n}
                  className={`w-7 h-7 rounded text-xs flex items-center justify-center font-medium ${
                    n === 4 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                  aria-hidden
                >
                  {n}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Good to know</p>
            <ul className="space-y-1 text-xs text-amber-700">
              <li>• You may skip any item — nothing is mandatory</li>
              <li>• The source of each sample is hidden to avoid bias</li>
              <li>• Progress saves automatically — refresh is safe</li>
              <li>• Estimated time: 15–20 minutes</li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/study')}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            {t('instructions.start')}
          </button>
        </div>
      </div>
    </div>
  )
}
