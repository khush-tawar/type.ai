import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant, enqueueRetry, dequeueRetries } from '../context/ParticipantContext'
import { supabase } from '../lib/supabase'
import { uploadDrawing } from '../lib/storage'
import { getGroupLikertQuestions, buildGroupSpecificPayload } from '../lib/manifest'
import { t } from '../locales'
import ProgressBar from '../components/ProgressBar'
import LikertGroupScale from '../components/LikertGroupScale'
import StyleTaxonomyDropdown from '../components/StyleTaxonomyDropdown'
import DrawingCanvas from '../components/DrawingCanvas'
import ExitModal from '../components/ExitModal'

function useRatingState(stimulusId) {
  const [styleTaxonomy, setStyleTaxonomy] = useState(null)
  const [likertScales, setLikertScales] = useState({
    likert_design_quality: null,
    likert_readability: null,
    likert_authenticity: null,
    likert_cultural_fit: null,
  })
  const [groupSpecificResponse, setGroupSpecificResponse] = useState({})
  const [annotation, setAnnotation] = useState('')
  const [drawingData, setDrawingData] = useState(null)
  const [imgError, setImgError] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)

  useEffect(() => {
    setStyleTaxonomy(null)
    setLikertScales({
      likert_design_quality: null,
      likert_readability: null,
      likert_authenticity: null,
      likert_cultural_fit: null,
    })
    setGroupSpecificResponse({})
    setAnnotation('')
    setDrawingData(null)
    setImgError(false)
    setShowCanvas(false)
  }, [stimulusId])

  const handleLikertChange = useCallback((key, value) => {
    setLikertScales((prev) => ({ ...prev, [key]: value }))
  }, [])

  return {
    styleTaxonomy,
    setStyleTaxonomy,
    likertScales,
    handleLikertChange,
    groupSpecificResponse,
    setGroupSpecificResponse,
    annotation,
    setAnnotation,
    drawingData,
    setDrawingData,
    imgError,
    setImgError,
    showCanvas,
    setShowCanvas,
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
      enqueueRetry(participantId, item)
    }
  }
}

export default function StudyPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useParticipant()
  const { sessionStimuli, currentStimulusIndex, participantId, userType } = state

  const stimulus = sessionStimuli[currentStimulusIndex]
  const isLast = currentStimulusIndex + 1 >= sessionStimuli.length

  const screenStart = useRef(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [showExit, setShowExit] = useState(false)

  const rs = useRatingState(stimulus?.id)
  const groupLikertQuestions = getGroupLikertQuestions(userType)

  // Reset timer when stimulus changes
  useEffect(() => {
    screenStart.current = Date.now()
  }, [currentStimulusIndex])

  // Redirect guards
  useEffect(() => {
    if (!state.participantId) {
      navigate('/', { replace: true })
      return
    }
    if (!state.consentGiven) {
      navigate('/consent', { replace: true })
      return
    }
    if (!state.demographics) {
      navigate('/demographics', { replace: true })
      return
    }
    if (sessionStimuli.length === 0) {
      navigate('/demographics', { replace: true })
      return
    }
  }, [state, sessionStimuli.length, navigate])

  // Check if all required responses are filled
  const allLikertsFilled = Object.values(rs.likertScales).every((v) => v !== null)
  const canSubmit = rs.styleTaxonomy !== null && allLikertsFilled && !submitting

  const buildPayload = (skipped) => ({
    participant_id: participantId,
    stimulus_id: stimulus.id,
    granularity_level: stimulus.granularityLevel,
    serif_variant: stimulus.serifVariant || null,
    context_type: stimulus.contextType || null,
    source_type: stimulus.sourceType || null,
    style_taxonomy: skipped ? null : rs.styleTaxonomy,
    likert_design_quality: skipped ? null : rs.likertScales.likert_design_quality,
    likert_readability: skipped ? null : rs.likertScales.likert_readability,
    likert_authenticity: skipped ? null : rs.likertScales.likert_authenticity,
    likert_cultural_fit: skipped ? null : rs.likertScales.likert_cultural_fit,
    group_specific_response: skipped ? null : buildGroupSpecificPayload(userType, rs.groupSpecificResponse),
    error_annotation_text: rs.annotation || null,
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
      // Queue for retry on next submission
      enqueueRetry(participantId, { ...payload, drawing_data: drawingData })
    }
  }

  const advance = useCallback(
    async (skipped) => {
      if (submitting) return
      setSubmitting(true)
      const payload = buildPayload(skipped)
      dispatch({ type: 'ADD_RESPONSE', payload })
      await submitToSupabase(payload, rs.drawingData)

      if (isLast) {
        await supabase
          .from('participants')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', participantId)
        dispatch({ type: 'SET_STATUS', payload: 'completed' })
        navigate('/thanks')
      } else {
        dispatch({ type: 'ADVANCE_STIMULUS' })
      }
      setSubmitting(false)
    },
    [submitting, isLast, rs.drawingData, participantId, dispatch, navigate]
  )

  const handleExit = async () => {
    dispatch({ type: 'SET_STATUS', payload: 'withdrawn' })
    await supabase.from('participants').update({ status: 'withdrawn', withdrawn_reason: 'mid_study_withdrawal' }).eq('id', participantId)
    navigate('/withdrawn')
  }

  if (!stimulus) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ProgressBar current={currentStimulusIndex + 1} total={sessionStimuli.length} />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-32">
        {/* Stimulus metadata */}
        <section className="text-xs text-slate-500 space-y-1">
          <p>
            <strong>Granularity:</strong> {stimulus.granularityLevel}
          </p>
          <p>
            <strong>Context:</strong> {stimulus.contextType}
          </p>
          <p>
            <strong>Variant:</strong> {stimulus.serifVariant}
          </p>
        </section>

        {/* Stimulus image */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Sample {currentStimulusIndex + 1}</p>
          </div>

          <div className="p-6 flex items-center justify-center bg-white min-h-[280px] sm:min-h-[360px]">
            {rs.imgError ? (
              <div className="flex flex-col items-center gap-2 text-slate-300">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                  <path d="m3 9 5 5 4-4 5 5" strokeWidth="1.5" />
                </svg>
                <p className="text-sm">Image unavailable</p>
                <button
                  type="button"
                  onClick={() => advance(true)}
                  disabled={submitting}
                  className="mt-2 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            ) : (
              <img
                src={stimulus.imageUrl}
                alt="Typeface sample for evaluation"
                className="max-w-full max-h-96 object-contain"
                onError={() => rs.setImgError(true)}
              />
            )}
          </div>
        </section>

        {/* Style taxonomy dropdown */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <StyleTaxonomyDropdown value={rs.styleTaxonomy} onChange={rs.setStyleTaxonomy} disabled={submitting} />
        </section>

        {/* Likert scales */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6">
          {groupLikertQuestions.map((question) => (
            <LikertGroupScale
              key={question.key}
              question={question}
              value={rs.likertScales[question.key]}
              onChange={(val) => {
                if (question.scale === 'binary') {
                  rs.setGroupSpecificResponse((prev) => ({ ...prev, [question.key]: val }))
                } else {
                  rs.handleLikertChange(question.key, val)
                }
              }}
              disabled={submitting}
            />
          ))}
        </section>

        {/* Annotation */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-3">Any additional notes or observations?</label>
          <textarea
            value={rs.annotation}
            onChange={(e) => rs.setAnnotation(e.target.value)}
            placeholder="Describe any issues, unexpected features, or observations..."
            disabled={submitting}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
            rows={3}
          />
        </section>

        {/* Drawing canvas (optional) */}
        {stimulus.contextType === 'with_context' && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">Optional: Annotate the sample</label>
              <button
                type="button"
                onClick={() => rs.setShowCanvas(!rs.showCanvas)}
                className="text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {rs.showCanvas ? 'Hide' : 'Show'} canvas
              </button>
            </div>
            {rs.showCanvas && (
              <DrawingCanvas onCapture={rs.setDrawingData} disabled={submitting} />
            )}
          </section>
        )}

        {/* Submit / Skip buttons */}
        <section className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 flex gap-3 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => advance(true)}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => advance(false)}
            disabled={!canSubmit}
            className="flex-1 px-4 py-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={() => setShowExit(true)}
            disabled={submitting}
            className="px-4 py-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Exit study"
          >
            ✕
          </button>
        </section>

        {showExit && <ExitModal onConfirm={handleExit} onCancel={() => setShowExit(false)} />}
      </main>
    </div>
  )
}
