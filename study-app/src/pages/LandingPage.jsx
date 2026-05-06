import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useParticipant } from '../context/ParticipantContext'
import { t } from '../locales'

const VALID_GROUPS = ['A', 'B', 'C', 'D', 'E']
const VALID_USER_TYPES = ['type_designer', 'daily_user', 'ui_designer', 'student', 'general']

export default function LandingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { dispatch } = useParticipant()

  const group = searchParams.get('group')?.toUpperCase()
  const userType = searchParams.get('userType')?.toLowerCase()
  const prolificPid = searchParams.get('prolific_pid') || searchParams.get('PROLIFIC_PID') || null
  
  const isValidGroup = VALID_GROUPS.includes(group)
  const isValidUserType = VALID_USER_TYPES.includes(userType)
  const hasValidParams = isValidGroup && isValidUserType

  useEffect(() => {
    if (!hasValidParams) return

    // Check for an existing in-progress session
    const savedPid = localStorage.getItem('study_pid')
    if (savedPid) {
      try {
        const saved = JSON.parse(localStorage.getItem(`study_session_${savedPid}`))
        if (saved?.status === 'in_progress' && saved?.groupCode === group && saved?.userType === userType) {
          const progress = JSON.parse(localStorage.getItem(`study_progress_${savedPid}`) || 'null')
          const resumeRoute = typeof progress?.route === 'string' ? progress.route : '/study'
          dispatch({ type: 'INIT', payload: { ...saved, participantId: savedPid } })
          navigate(resumeRoute, { replace: true })
          return
        }
      } catch { /* stale / corrupt — start fresh */ }
    }

    // Fresh participant
    const pid = uuidv4()
    localStorage.setItem('study_pid', pid)
    dispatch({ 
      type: 'INIT', 
      payload: { 
        participantId: pid, 
        groupCode: group, 
        userType,
        prolificPid 
      } 
    })
  }, [hasValidParams, group, userType, prolificPid, dispatch, navigate])

  if (!hasValidParams) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-4" aria-hidden>⚠️</div>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">{t('error.heading')}</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Invalid or missing study parameters. Please use the link provided by the researcher.
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Required: <code className="bg-slate-100 px-2 py-1 rounded">?group=A&userType=type_designer</code>
          </p>
        </div>
      </div>
    )
  }

  // Valid params — show landing card (briefly visible before redirect for returning participants)
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-700 px-8 py-6">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">
            {t('study.subtitle')}
          </p>
          <h1 className="text-2xl font-bold text-white leading-snug">{t('study.title')}</h1>
          <p className="text-indigo-200 text-sm mt-2">{t('study.approx_time')}</p>
        </div>

        <div className="p-8">
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            You are about to begin a research study evaluating Devanagari typefaces.
            Please read the consent form on the next page carefully before starting.
          </p>
          <button
            onClick={() => navigate('/consent')}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            {t('landing.begin')}
          </button>
          <p className="text-center text-xs text-slate-400 mt-4">
            Your progress saves automatically. You may close and return to this link to resume.
          </p>
        </div>
      </div>
    </div>
  )
}
