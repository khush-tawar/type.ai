import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import WelcomePage from './components/WelcomePage'
import DemographicsPage from './components/DemographicsPage'
import InstructionsPage from './components/InstructionsPage'
import RatingPage from './components/RatingPage'
import DebriefPage from './components/DebriefPage'
import { selectStimuli } from './lib/utils'
import { supabase } from './lib/supabase'
import stimuliManifest from './data/stimuli.json'

const STORAGE_KEY = 'deva-study-v2'
const N_STIMULI = stimuliManifest.stimuli.length

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getInitialState() {
  const saved = loadSaved()
  if (saved?.page && saved.page !== 'welcome' && saved.page !== 'debrief') {
    return saved
  }
  return {
    participantId: uuidv4(),
    page: 'welcome',
    demographics: null,
    stimuli: [],
    currentIndex: 0,
    responses: [],
  }
}

export default function App() {
  const [state, setState] = useState(getInitialState)
  const [startTime, setStartTime] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  const { participantId, page, demographics, stimuli, currentIndex, responses } = state

  useEffect(() => {
    if (page === 'debrief') {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        participantId, page, demographics, stimuli, currentIndex, responses,
      }))
    } catch {
      // localStorage quota — not fatal, study continues
    }
  }, [participantId, page, demographics, stimuli, currentIndex, responses])

  const handleConsentComplete = useCallback(() => {
    setState(prev => ({ ...prev, page: 'demographics' }))
  }, [])

  const handleDemographicsComplete = useCallback((demo) => {
    const selected = selectStimuli(stimuliManifest, N_STIMULI)
    setState(prev => ({
      ...prev,
      page: 'instructions',
      demographics: demo,
      stimuli: selected,
      currentIndex: 0,
      responses: [],
    }))
  }, [])

  const handleInstructionsComplete = useCallback(() => {
    setStartTime(Date.now())
    setState(prev => ({ ...prev, page: 'rating' }))
  }, [])

  const handleStimulusComplete = useCallback(async (response) => {
    const updatedResponses = [...responses, response]
    const nextIndex = currentIndex + 1
    const isLast = nextIndex >= stimuli.length

    if (isLast) {
      setSubmitting(true)
      setSubmitError(false)
      try {
        await submitData(participantId, demographics, updatedResponses)
      } catch (err) {
        console.error('Submission failed — data preserved in localStorage', err)
        setSubmitError(true)
        // Backup: keep saved state so researcher can recover manually
        try {
          localStorage.setItem(
            `${STORAGE_KEY}-backup-${participantId}`,
            JSON.stringify({ participantId, demographics, responses: updatedResponses, failedAt: new Date().toISOString() })
          )
        } catch { /* ignore */ }
      } finally {
        setSubmitting(false)
      }
      setState(prev => ({ ...prev, responses: updatedResponses, page: 'debrief' }))
    } else {
      setState(prev => ({ ...prev, responses: updatedResponses, currentIndex: nextIndex }))
      setStartTime(Date.now())
    }
  }, [responses, currentIndex, stimuli.length, participantId, demographics])

  if (page === 'welcome') {
    return <WelcomePage onComplete={handleConsentComplete} />
  }
  if (page === 'demographics') {
    return <DemographicsPage onComplete={handleDemographicsComplete} />
  }
  if (page === 'instructions') {
    return <InstructionsPage onComplete={handleInstructionsComplete} stimuliCount={N_STIMULI} />
  }
  if (page === 'rating' && stimuli.length > 0) {
    return (
      <RatingPage
        stimulus={stimuli[currentIndex]}
        index={currentIndex}
        total={stimuli.length}
        startTime={startTime}
        onComplete={handleStimulusComplete}
        isSubmitting={submitting}
      />
    )
  }
  if (page === 'debrief') {
    return <DebriefPage participantId={participantId} submitError={submitError} />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading study…</p>
    </div>
  )
}

async function submitData(participantId, demographics, responses) {
  const { error } = await supabase.from('study_responses').insert({
    participant_id: participantId,
    demographics,
    responses,
    submitted_at: new Date().toISOString(),
  })
  if (error) throw error
}
