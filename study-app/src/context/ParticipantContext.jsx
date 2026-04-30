import { createContext, useContext, useReducer, useEffect } from 'react'

const ParticipantContext = createContext(null)

const INITIAL_STATE = {
  participantId: null,
  group: null,
  prolificPid: null,
  demographics: null,
  sessionStimuli: [],
  sessionSeed: null,
  currentStimulusIndex: 0,
  responses: [],
  status: 'pending', // pending | in_progress | completed | withdrawn
  consentGiven: false,
  consentTimestamp: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...INITIAL_STATE, ...action.payload }
    case 'SET_CONSENT':
      return { ...state, consentGiven: true, consentTimestamp: action.payload }
    case 'SET_DEMOGRAPHICS':
      return { ...state, demographics: action.payload }
    case 'SET_SESSION':
      return { ...state, sessionStimuli: action.payload.stimuli, sessionSeed: action.payload.seed, status: 'in_progress' }
    case 'ADD_RESPONSE':
      return { ...state, responses: [...state.responses, action.payload] }
    case 'ADVANCE_STIMULUS':
      return { ...state, currentStimulusIndex: state.currentStimulusIndex + 1 }
    case 'SET_STATUS':
      return { ...state, status: action.payload }
    default:
      return state
  }
}

export function ParticipantProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (!state.participantId) return
    const sessionKey = `study_session_${state.participantId}`
    const progressKey = `study_progress_${state.participantId}`
    if (state.status === 'completed' || state.status === 'withdrawn') {
      localStorage.removeItem(sessionKey)
      localStorage.removeItem(progressKey)
      return
    }
    try {
      localStorage.setItem(sessionKey, JSON.stringify(state))
    } catch { /* quota — non-fatal */ }
  }, [state])

  return (
    <ParticipantContext.Provider value={{ state, dispatch }}>
      {children}
    </ParticipantContext.Provider>
  )
}

export function useParticipant() {
  const ctx = useContext(ParticipantContext)
  if (!ctx) throw new Error('useParticipant must be inside ParticipantProvider')
  return ctx
}

// Retry queue helpers — persisted separately to survive page reload
export function enqueueRetry(participantId, item) {
  try {
    const key = `study_retry_${participantId}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    localStorage.setItem(key, JSON.stringify([...existing, item]))
  } catch { /* ignore */ }
}

export function dequeueRetries(participantId) {
  try {
    const key = `study_retry_${participantId}`
    const items = JSON.parse(localStorage.getItem(key) || '[]')
    localStorage.removeItem(key)
    return items
  } catch { return [] }
}
