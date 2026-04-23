import { useState, useCallback } from 'react'
import DrawingCanvas from './DrawingCanvas'

const QUALITY_OPTIONS = [
  'Sans Serif',
  'Serif',
  'Handwriting',
  'Pixel',
  'Display',
  'Monospace',
  'Calligraphy',
  'Black Letter',
  'Cursive',
]

const SCALES = [
  {
    key: 'structuralCorrectness',
    label: 'Structural Correctness',
    description: 'Are the strokes, proportions, and component parts of the character correct?',
    low: 'Very incorrect',
    high: 'Very correct',
  },
  {
    key: 'culturalAuthenticity',
    label: 'Cultural Authenticity',
    description: 'Does this feel like genuine Devanagari as used in your culture/region?',
    low: 'Not authentic',
    high: 'Very authentic',
  },
  {
    key: 'readability',
    label: 'Readability',
    description: 'How easily can you recognize and read this character?',
    low: 'Unreadable',
    high: 'Very clear',
  },
]

function LikertScale({ scaleKey, label, description, low, high, value, onChange }) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2" role="group" aria-label={label}>
        <span className="text-xs text-slate-400 w-16 text-right leading-tight hidden sm:block">{low}</span>
        <div className="flex gap-1 sm:gap-1.5 flex-1 justify-between sm:justify-center">
          {[1, 2, 3, 4, 5, 6, 7].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(scaleKey, n)}
              aria-pressed={value === n}
              aria-label={`${label}: ${n}`}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm font-semibold border-2 transition-all duration-100 ${
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
      {/* Mobile labels */}
      <div className="flex justify-between text-xs text-slate-400 mt-1 sm:hidden px-0.5">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

export default function RatingPage({ stimulus, index, total, startTime, onComplete, isSubmitting }) {
  const [verdict, setVerdict] = useState(null)
  const [ratings, setRatings] = useState({ structuralCorrectness: null, culturalAuthenticity: null, readability: null })
  const [selectedQualities, setSelectedQualities] = useState([])
  const [annotation, setAnnotation] = useState('')
  const [drawingData, setDrawingData] = useState(null)
  const [showCanvas, setShowCanvas] = useState(false)
  const [imgError, setImgError] = useState(false)

  const allRated = Object.values(ratings).every(v => v !== null)
  const canSubmit = verdict !== null && allRated && !isSubmitting

  const handleRatingChange = useCallback((key, value) => {
    setRatings(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleQuality = useCallback((quality) => {
    setSelectedQualities(prev => (
      prev.includes(quality)
        ? prev.filter(item => item !== quality)
        : [...prev, quality]
    ))
  }, [])

  const buildResponse = (skipped = false) => ({
    stimulusId: stimulus.id,
    sourceType: stimulus.source_type,
    verdict: skipped ? null : verdict,
    selectedQualities: skipped ? [] : selectedQualities,
    ratings: skipped ? {} : ratings,
    annotation: skipped ? '' : annotation,
    drawingData: skipped ? null : drawingData,
    timeSpentMs: Date.now() - startTime,
    skipped,
    timestamp: new Date().toISOString(),
  })

  const handleSubmit = () => {
    if (!canSubmit) return
    onComplete(buildResponse(false))
    resetState()
  }

  const handleSkip = () => {
    onComplete(buildResponse(true))
    resetState()
  }

  const resetState = () => {
    setVerdict(null)
    setRatings({ structuralCorrectness: null, culturalAuthenticity: null, readability: null })
    setSelectedQualities([])
    setAnnotation('')
    setDrawingData(null)
    setShowCanvas(false)
    setImgError(false)
  }

  const progress = (index / total) * 100
  const isLast = index + 1 === total

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky progress bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap tabular-nums">
            {index + 1} / {total}
          </span>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={index} aria-valuemax={total}>
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">{Math.round(progress)}%</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-10">

        {/* Stimulus image */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Letterform {index + 1}
            </p>
            {stimulus.allow_drawing && (
              <button
                onClick={() => setShowCanvas(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  showCanvas
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                {showCanvas ? 'Hide canvas' : '✏️ Draw corrections'}
              </button>
            )}
          </div>

          <div className="p-6 flex items-center justify-center bg-white min-h-[280px] sm:min-h-[360px]">
            {showCanvas && stimulus.allow_drawing ? (
              <DrawingCanvas imageSrc={stimulus.image_path} onDrawingChange={setDrawingData} />
            ) : imgError ? (
              <div className="flex flex-col items-center gap-2 text-slate-300">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                  <path d="m3 9 5 5 4-4 5 5" strokeWidth="1.5" />
                </svg>
                <span className="text-sm">Image unavailable</span>
                <span className="text-xs">{stimulus.image_path}</span>
              </div>
            ) : (
              <img
                src={stimulus.image_path}
                alt="Devanagari letterform stimulus"
                className="max-w-full max-h-80 object-contain"
                onError={() => setImgError(true)}
              />
            )}
          </div>
        </section>

        {/* Reference and chip selection */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-slate-800">Which styles look correctly rendered?</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the reference labels below, then select all styles that fit this sample.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 text-center">
              Reference
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {QUALITY_OPTIONS.map(option => (
                <div
                  key={option}
                  className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-center text-center text-sm font-semibold text-slate-700 shadow-sm"
                >
                  {option}
                </div>
              ))}
            </div>
          </div>

          <div role="group" aria-label="Select all matching quality categories" className="flex flex-wrap gap-2">
            {QUALITY_OPTIONS.map(option => {
              const isSelected = selectedQualities.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleQuality(option)}
                  aria-pressed={isSelected}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border-2 transition-all duration-100 ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </section>

        {/* Accept / Reject */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-3">
            Does this look like authentic Devanagari?
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </p>
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Accept or reject verdict">
            <button
              type="button"
              onClick={() => setVerdict('accept')}
              aria-pressed={verdict === 'accept'}
              className={`py-3.5 rounded-xl font-semibold text-sm border-2 transition-all duration-100 ${
                verdict === 'accept'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 bg-white'
              }`}
            >
              ✓ Accept
            </button>
            <button
              type="button"
              onClick={() => setVerdict('reject')}
              aria-pressed={verdict === 'reject'}
              className={`py-3.5 rounded-xl font-semibold text-sm border-2 transition-all duration-100 ${
                verdict === 'reject'
                  ? 'bg-red-500 border-red-500 text-white shadow-sm'
                  : 'border-slate-300 text-slate-700 hover:border-red-400 hover:text-red-700 bg-white'
              }`}
            >
              ✗ Reject
            </button>
          </div>
        </section>

        {/* Likert scales */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6">
          <p className="text-sm font-semibold text-slate-800">
            Rate the following qualities
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </p>
          {SCALES.map(scale => (
            <LikertScale
              key={scale.key}
              scaleKey={scale.key}
              label={scale.label}
              description={scale.description}
              low={scale.low}
              high={scale.high}
              value={ratings[scale.key]}
              onChange={handleRatingChange}
            />
          ))}
        </section>

        {/* Optional annotation */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <label htmlFor="annotation" className="block text-sm font-semibold text-slate-800 mb-2">
            What looks wrong, if anything?{' '}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="annotation"
            value={annotation}
            onChange={e => setAnnotation(e.target.value)}
            placeholder="Describe any issues you notice (e.g., wrong stroke direction, missing mātrā, unnatural proportions)…"
            rows={3}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </section>

        {/* Navigation */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 py-3.5 border-2 border-slate-300 text-slate-500 rounded-xl font-semibold text-sm hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-[2] py-3.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
              canSubmit
                ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Submitting…' : isLast ? 'Submit Study ✓' : 'Next →'}
          </button>
        </div>

        {!allRated && verdict !== null && (
          <p className="text-center text-xs text-slate-400">
            Please rate all three qualities before continuing.
          </p>
        )}
      </main>
    </div>
  )
}
