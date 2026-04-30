import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useParticipant } from '../context/ParticipantContext'
import { supabase } from '../lib/supabase'
import { t } from '../locales'

export default function WithdrawnPage() {
  const [searchParams] = useSearchParams()
  const { state, dispatch } = useParticipant()
  const reason = searchParams.get('reason') || 'mid_study_withdrawal'

  useEffect(() => {
    dispatch({ type: 'SET_STATUS', payload: 'withdrawn' })
    if (state.participantId) {
      supabase.from('participants')
        .update({ status: 'withdrawn', withdrawn_reason: reason })
        .eq('id', state.participantId)
        .then(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-700 px-8 py-6">
          <h2 className="text-xl font-bold text-white">{t('withdrawn.heading')}</h2>
        </div>
        <div className="p-8 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{t('withdrawn.body')}</p>
          <p className="text-sm text-slate-500 leading-relaxed">{t('withdrawn.contact')}</p>
        </div>
      </div>
    </div>
  )
}
