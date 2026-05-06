import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant, enqueueRetry, dequeueRetries } from '../context/ParticipantContext'
import { supabase } from '../lib/supabase'
import { uploadDrawing } from '../lib/storage'
import { t } from '../locales'
import ProgressBar from '../components/ProgressBar'
import LikertScale from '../components/LikertScale'
import DrawingCanvas from '../components/DrawingCanvas'
import ExitModal from '../components/ExitModal'
import GroupSpecificQuestion, { isGroupResponseValid } from '../components/GroupSpecificQuestion'

const CATEGORY_OPTIONS = [
  'Serif', 'Sans-serif', 'Handwriting', 'Pixel', 'Display',
  'Monospace', 'Calligraphy', 'Blackletter', 'Cursive',
  'None of these fit', "I'm not sure",
]

const LIKERT_SCALES = [
  { key: 'structuralCorrectness', label: t('study.likert.structural'), description: 'Are the strokes, proportions, and component parts correct?', low: t('study.likert.structural_low'), high: t('study.likert.structural_high') },
  { key: 'culturalAuthenticity', label: t('study.likert.authenticity'), description: 'Does this feel like genuine script from your culture/region?', low: t('study.likert.authenticity_low'), high: t('study.likert.authenticity_high') },
  { key: 'readability', label: t('study.likert.readability'), description: 'How easily can you recognize and read this?', low: t('study.likert.readability_low'), high: t('study.likert.readability_high') },
]

function useRatingState(stimulusId) {
  const [verdict, setVerdict] = useState(null)
  const [ratings, setRatings] = useState({ structuralCorrectness: null, culturalAuthenticity: null, readability: null })
  const [category, setCategory] = useState('')
  const [annotation, setAnnotation] = useState('')
  const [drawingData, setDrawingData] = useState(null)
  const [groupResponse, setGroupResponse] = useState({})
  const [imgError, setImgError] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)

  useEffect(() => {
    setVerdict(null)
    setRatings({ structuralCorrectness: null, culturalAuthenticity: null, readability: null })
    setCategory('')
    setAnnotation('')
    setDrawingData(null)
    setGroupResponse({})
    setImgError(false)
    setShowCanvas(false)
  }, [stimulusId])

  const handleRatingChange = useCallback((key, value) => {
    setRatings(prev => ({ ...prev, [key]: value }))
  }, [])

  return {
    verdict, setVerdict,
    ratings, handleRatingChange,
    category, setCategory,
    annotation, setAnnotation,
    drawingData, setDrawingData,
    groupResponse, setGroupResponse,
    imgError, setImgError,
    showCanvas, setShowCanvas,
  }
}

async function flushRetryQueue(participantId) {
  const queued = dequeueRetries(participantId)
  for (const item of queued) {
    const { drawing_data, ...rest } = item
    let drawingPath = null
    if (drawing_data) {
      drawingPath = await uploadDrawing(participantId, rest.stimulus_id, drawing_data)
    }
    const { error } = await supabase.from('responses').insert({ ...rest, drawing_storage_path: drawingPath })
    if (error) {
      enqueueRetry(participantId, item) // put back if still failing
    }
  }
}

export default function StudyPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useParticipant()
  const { sessionStimuli, currentStimulusIndex, group, participantId } = state

  const stimulus = sessionStimuli[currentStimulusIndex]
  const isLast = currentStimulusIndex + 1 >= sessionStimuli.length

  const screenStart = useRef(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [showExit, setShowExit] = useState(false)

  const rs = useRatingState(stimulus?.id)

  // Reset timer when stimulus changes
  useEffect(() => { screenStart.current = Date.now() }, [currentStimulusIndex])

  // Redirect guards
  useEffect(() => {
    if (!state.participantId) { navigate('/', { replace: true }); return }
    if (!state.consentGiven)  { navigate('/consent', { replace: true }); return }
    if (!state.demographics)  { navigate('/demographics', { replace: true }); return }
    if (sessionStimuli.length === 0) { navigate('/demographics', { replace: true }); return }
  }, [state, sessionStimuli.length, navigate])

  const allRated = Object.values(rs.ratings).every(v => v !== null)
  const groupValid = isGroupResponseValid(group, rs.groupResponse)
  const canSubmit = rs.verdict !== null && allRated && rs.category !== '' && groupValid && !submitting

  const buildPayload = (skipped) => ({
    participant_id: participantId,
    stimulus_id: stimulus.id,
    source_type: stimulus.source_type || null,
    binary_judgment: skipped ? null : rs.verdict,
    likert_structural: skipped ? null : rs.ratings.structuralCorrectness,
    likert_authenticity: skipped ? null : rs.ratings.culturalAuthenticity,
    likert_readability: skipped ? null : rs.ratings.readability,
    category_attribution: skipped ? null : rs.category,
    error_annotation_text: rs.annotation || null,
    group_specific_response: skipped ? null : rs.groupResponse,
    time_on_screen_ms: Date.now() - screenStart.current,
    skipped,
    submitted_at: new Date().toISOString(),
  })

  const submitToSupabase = async (payload, drawingData) => {
    await flushRetryQueue(participantId)
    try {
      let drawingPath = null
      if (drawingData && !payload.skipped) {
        drawingPath = await uploadDrawing(participantId, payload.stimulus_id, drawingData)
      }
      const { error } = await supabase.from('responses').insert({
        ...payload,
        drawing_storage_path: drawingPath,
      })
      if (error) throw error
    } catch {
      // Queue for retry on next submission — don't lose data
      enqueueRetry(participantId, { ...payload, drawing_data: drawingData })
    }
  }

  const advance = useCallback(async (skipped) => {
    if (submitting) return
    setSubmitting(true)
    const payload = buildPayload(skipped)
    dispatch({ type: 'ADD_RESPONSE', payload })
    await submitToSupabase(payload, rs.drawingData)

    if (isLast) {
      await supabase.from('participants')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', participantId)
      dispatch({ type: 'SET_STATUS', payload: 'completed' })
      navigate('/thanks')
    } else {
      dispatch({ type: 'ADVANCE_STIMULUS' })
    }
    setSubmitting(false)
  }, [submitting, isLast, rs.drawingData, participantId, dispatch, navigate]) // eslint-disable-line

  const handleExit = async () => {
    dispatch({ type: 'SET_STATUS', payload: 'withdrawn' })
    await supabase.from('participants')
      .update({ status: 'withdrawn', withdrawn_reason: 'mid_study_withdrawal' })
      .eq('id', participantId)
    navigate('/withdrawn')
  }

  if (!stimulus) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Loading…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <ProgressBar current={currentStimulusIndex + 1} total={sessionStimuli.length} />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-14">

        {/* Stimulus image */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Sample {currentStimulusIndex + 1}
            </p>
          </div>

          <div className="p-6 flex items-center justify-center bg-white min-h-[280px] sm:min-h-[360px]">
            {rs.imgError ? (
              <div className="flex flex-col items-center gap-2 text-slate-300">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                  <path d="m3 9 5 5 4-4 5 5" strokeWidth="1.5" />
                </svg>
                <p className="text-sm">Image unavailable</p>
                <p className="text-xs font-mono opacity-60">{stimulus.id}</p>
                <button
                  type="button"
                  onClick={() => advance(true)}
                  disabled={submitting}
                  className="mt-2 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Skip this one
                </button>
              </div>
            ) : (
              <img
                src={stimulus.image_path}
                alt="Script sample for evaluation"
                className="max-w-full max-h-96 object-contain"
                onError={() => rs.setImgError(true)}
              />
            )}
          </div>
        </section>

        {/* Binary judgment */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-3">
            Does this look like authentic Devanagari?
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </p>
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Authenticity judgment">
            <button
              type="button"
              onClick={() => rs.setVerdict('authentic')}
              aria-pressed={rs.verdict === 'authentic'}
              className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all duration-100 flex items-center justify-center gap-2 ${
                rs.verdict === 'authentic'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'border-slate-300 text-slate-700 hover:border-emerald-400 bg-white'
              }`}
            >
              <span aria-hidden>✓</span> {t('study.binary.authentic')}
            </button>
            <button
              type="button"
              onClick={() => rs.setVerdict('not_authentic')}
              aria-pressed={rs.verdict === 'not_authentic'}
              className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all duration-100 flex items-center justify-center gap-2 ${
                rs.verdict === 'not_authentic'
                  ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                  : 'border-slate-300 text-slate-700 hover:border-rose-400 bg-white'
              }`}
            >
              <span aria-hidden>✗</span> {t('study.binary.not_authentic')}
            </button>
          </div>
        </section>

        {/* Likert scales */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6">
          <p className="text-sm font-semibold text-slate-800">
            Rate these qualities
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </p>
          {LIKERT_SCALES.map(scale => (
            <LikertScale
              key={scale.key}
              scaleKey={scale.key}
              label={scale.label}
              description={scale.description}
              low={scale.low}
              high={scale.high}
              value={rs.ratings[scale.key]}
              onChange={rs.handleRatingChange}
            />
          ))}
        </section>

        {/* Category attribution */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <label htmlFor="category" className="block text-sm font-semibold text-slate-800 mb-2">
            {t('study.category.label')}
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </label>
          <select
            id="category"
            value={rs.category}
            onChange={e => rs.setCategory(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="">{t('study.category.placeholder')}</option>
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </section>

        {/* Free-text annotation */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <label htmlFor="annotation" className="block text-sm font-semibold text-slate-800 mb-2">
            {t('study.annotation.label')}{' '}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="annotation"
            value={rs.annotation}
            onChange={e => rs.setAnnotation(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t('study.annotation.placeholder')}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </section>

        {/* Group-specific question */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <GroupSpecificQuestion
            group={group}
            stimulus={stimulus}
            value={rs.groupResponse}
            onChange={rs.setGroupResponse}
          />
        </section>

        {stimulus.sessionDrawing && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Drawing canvas</p>
                <p className="text-xs text-slate-400">Optional annotation for this sample only.</p>
              </div>
              <button
                type="button"
                onClick={() => rs.setShowCanvas(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  rs.showCanvas
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'
                }`}
                aria-expanded={rs.showCanvas}
              >
                {rs.showCanvas ? t('study.drawing.hide') : t('study.drawing.toggle')}
              </button>
            </div>

            {rs.showCanvas ? (
              <DrawingCanvas imageSrc={stimulus.image_path} onDrawingChange={rs.setDrawingData} />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm text-slate-500">Open the canvas to mark problem areas on the sample.</p>
              </div>
            )}
          </section>
        )}

        {/* Submit / Skip */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => advance(true)}
            disabled={submitting}
            className="flex-1 py-3.5 border-2 border-slate-300 text-slate-500 rounded-xl font-semibold text-sm hover:border-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            {t('study.skip')}
          </button>
          <button
            type="button"
            onClick={() => advance(false)}
            disabled={!canSubmit}
            className={`flex-[2] py-3.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
              canSubmit
                ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving…' : isLast ? 'Submit Study ✓' : t('study.submit')}
          </button>
        </div>

        {!canSubmit && rs.verdict !== null && (
          <p className="text-center text-xs text-slate-400">
            {!allRated && 'Please complete all three rating scales. '}
            {rs.category === '' && 'Please select a style category. '}
            {!groupValid && 'Please answer the question above. '}
          </p>
        )}
      </main>

      {/* Exit link */}
      <div className="text-center pb-6">
        <button
          type="button"
          onClick={() => setShowExit(true)}
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
        >
          {t('study.exit')}
        </button>
      </div>

      {showExit && (
        <ExitModal
          onConfirm={handleExit}
          onCancel={() => setShowExit(false)}
        />
      )}
    </div>
  )
}
