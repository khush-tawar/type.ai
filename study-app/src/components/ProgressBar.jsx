export default function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round(((current - 1) / total) * 100) : 0

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <span className="hidden sm:inline text-sm font-semibold text-slate-700 whitespace-nowrap">
          Stimulus {current} of {total}
        </span>
        <span className="text-xs font-semibold text-slate-500 tabular-nums whitespace-nowrap">
          {current} / {total}
        </span>
        <div
          className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Stimulus ${current} of ${total}`}
        >
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">{pct}%</span>
      </div>
    </header>
  )
}
