export default function LikertGroupScale({ question, value, onChange, disabled = false }) {
  const scale = Array.from({ length: 7 }, (_, i) => i + 1)

  // For group-specific questions that use binary scale
  if (question.scale === 'binary') {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">{question.prompt}</label>
        <div className="flex gap-3">
          <button
            onClick={() => onChange(true)}
            disabled={disabled}
            className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              value === true
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:bg-slate-50 disabled:cursor-not-allowed'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onChange(false)}
            disabled={disabled}
            className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
              value === false
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:bg-slate-50 disabled:cursor-not-allowed'
            }`}
          >
            No
          </button>
        </div>
      </div>
    )
  }

  // Standard 1–7 Likert scale
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">{question.prompt}</label>
      <div className="flex gap-2 items-center justify-between">
        <span className="text-xs text-slate-500">Strongly Disagree</span>
        <div className="flex gap-2 flex-1 justify-center mx-2">
          {scale.map((val) => (
            <button
              key={val}
              onClick={() => onChange(val)}
              disabled={disabled}
              className={`w-10 h-10 rounded-lg font-semibold text-xs transition-all ${
                value === val
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:bg-slate-50 disabled:cursor-not-allowed'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">Strongly Agree</span>
      </div>
    </div>
  )
}
