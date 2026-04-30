export default function LikertScale({ scaleKey, label, description, low, high, value, onChange }) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2" role="radiogroup" aria-label={label}>
        <span className="text-xs text-slate-400 w-16 text-right leading-tight hidden sm:block">{low}</span>

        <div className="flex gap-1 sm:gap-1.5 flex-1 justify-between sm:justify-center">
          {[1, 2, 3, 4, 5, 6, 7].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(scaleKey, n)}
              role="radio"
              aria-checked={value === n}
              aria-label={`${label}: ${n} of 7`}
              className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg text-sm font-semibold border-2 transition-all duration-100 ${
                value === n
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-105'
                  : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 bg-white'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 w-16 leading-tight hidden sm:block">{high}</span>
      </div>

      {/* Mobile anchor labels */}
      <div className="flex justify-between text-xs text-slate-400 mt-1 sm:hidden px-0.5">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}
