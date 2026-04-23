const STEPS = [
  {
    n: 1,
    title: 'View a letterform',
    body: 'You will see a Devanagari character or short word displayed on screen. Take a moment to look at it carefully.',
  },
  {
    n: 2,
    title: 'Accept or Reject',
    body: 'Decide whether it looks like authentic, natural Devanagari script. Trust your first impression — there are no trick questions.',
  },
  {
    n: 3,
    title: 'Rate three qualities',
    body: 'Use 1–7 scales to rate (a) structural correctness, (b) cultural authenticity, and (c) readability.',
  },
  {
    n: 4,
    title: 'Optional: note what looks wrong',
    body: 'If you spot an issue, describe it briefly in the text box. Skip this if everything looks fine.',
  },
  {
    n: 5,
    title: 'Optional: draw corrections',
    body: 'On some items a drawing canvas will appear. You can annotate directly on the image with your finger or mouse to mark problem areas.',
  },
]

export default function InstructionsPage({ onComplete, stimuliCount = 30 }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-700 px-8 py-5">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Step 2 of 3</p>
          <h2 className="text-xl font-bold text-white">Task Instructions</h2>
          <p className="text-indigo-200 text-sm mt-1">Please read before starting</p>
        </div>

        <div className="p-8">
          <p className="text-sm text-slate-600 mb-5">
            You will evaluate <strong className="text-slate-800">{stimuliCount} letterforms</strong>, one at a time.
            For each one, follow these steps:
          </p>

          <ol className="space-y-4" role="list">
            {STEPS.map(step => (
              <li key={step.n} className="flex gap-4">
                <div
                  className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold"
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

          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Good to know</p>
            <ul className="space-y-1 text-xs text-amber-700">
              <li>• You may skip any item — nothing is mandatory except the binary accept/reject and the Likert ratings</li>
              <li>• Your progress saves automatically; refresh is safe</li>
              <li>• You will not be told whether letterforms are human-made or AI-generated</li>
              <li>• Estimated time: 15–20 minutes</li>
            </ul>
          </div>

          <button
            onClick={onComplete}
            className="mt-6 w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            Start Evaluation →
          </button>
        </div>
      </div>
    </div>
  )
}
