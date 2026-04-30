import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant } from '../context/ParticipantContext'
import { supabase } from '../lib/supabase'
import { buildSession, loadManifest } from '../lib/selection'
import { t } from '../locales'

const COUNTRIES = [
  'India', 'Nepal', 'Pakistan', 'Bangladesh', 'Sri Lanka',
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Netherlands', 'Singapore', 'UAE', 'Other',
]

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi (NCT)', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
  'Nepal', 'Outside South Asia', 'Not applicable',
]

const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+']
const DEVA_LANGUAGES = ['Hindi', 'Marathi', 'Sanskrit', 'Nepali', 'Other', 'None']
const READING_FREQS = ['Daily', 'Weekly', 'Monthly', 'Rarely', 'Never']
const DESIGN_EXP = ['0–2 years', '3–5 years', '6–10 years', '11–20 years', '20+ years']
const DESIGN_DISCIPLINES = ['Type design', 'Graphic design', 'UX/UI', 'Brand', 'Other']
const EXPERT_TYPES = ['Calligrapher', 'Type designer', 'Script historian', 'Linguist', 'Other']
const NON_LATIN_EXP = ['Yes', 'A little', 'No']

function SelectButton({ value, current, onClick, children }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={value === current}
      className={`py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all duration-100 ${
        value === current
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
          : 'border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 bg-white'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800 mb-2.5">
        {label}{required && <span className="text-red-500 ml-1" aria-hidden>*</span>}
      </p>
      {children}
    </div>
  )
}

function SelectGrid({ options, value, onChange, cols = 3 }) {
  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map(opt => (
        <SelectButton key={opt} value={opt} current={value} onClick={onChange}>{opt}</SelectButton>
      ))}
    </div>
  )
}

export default function DemographicsPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useParticipant()
  const { group } = state

  const [form, setForm] = useState({
    ageRange: '',
    country: '',
    // Groups A/B/C
    devaLanguage: '',
    devaLanguageOther: '',
    region: '',
    readingFreq: '',
    // Group A extra
    designExp: '',
    designDiscipline: '',
    // Group C extra
    expertType: '',
    expertNote: '',
    // Group D extra
    nonLatinExp: '',
    nonLatinScripts: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))
  const setStr = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const isGroupABC = ['A', 'B', 'C'].includes(group)
  const isGroupA = group === 'A'
  const isGroupC = group === 'C'
  const isGroupD = group === 'D'

  const isValid = () => {
    if (!form.ageRange || !form.country) return false
    if (isGroupABC) {
      if (!form.devaLanguage) return false
      if (form.devaLanguage === 'Other' && !form.devaLanguageOther.trim()) return false
      if (!form.region || !form.readingFreq) return false
    }
    if (isGroupA && (!form.designExp || !form.designDiscipline)) return false
    if (isGroupC && !form.expertType) return false
    if (isGroupD && !form.nonLatinExp) return false
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid() || loading) return
    setLoading(true)

    const demo = { ...form }
    dispatch({ type: 'SET_DEMOGRAPHICS', payload: demo })

    // Persist demographics to Supabase
    try {
      await supabase.from('participants')
        .update({ demographics: demo })
        .eq('id', state.participantId)
    } catch {
      // Intentionally silent: no participant identifiers in client logs.
    }

    // Build session stimulus list
    try {
      const manifest = await loadManifest()
      const stimuli = buildSession(manifest, group, state.participantId)
      dispatch({ type: 'SET_SESSION', payload: { stimuli, seed: state.participantId } })

      // Persist session stimuli list for reproducibility
      try {
        await supabase.from('participants')
          .update({
            session_stimuli: stimuli.map(s => ({ id: s.id, sessionDrawing: s.sessionDrawing })),
            status: 'in_progress',
          })
          .eq('id', state.participantId)
      } catch {
        // Intentionally silent: no participant identifiers in client logs.
      }
    } catch (err) {
      console.warn('[study] Failed to load stimulus manifest.')
    }

    setLoading(false)
    navigate('/instructions')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-700 px-8 py-5">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">
            {t('demographics.step')}
          </p>
          <h2 className="text-xl font-bold text-white">{t('demographics.heading')}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-7" noValidate>

          {/* All groups */}
          <Field label="Age range" required>
            <SelectGrid options={AGE_RANGES} value={form.ageRange} onChange={set('ageRange')} cols={3} />
          </Field>

          <Field label="Country of residence" required>
            <select
              value={form.country}
              onChange={setStr('country')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* Groups A, B, C */}
          {isGroupABC && (<>
            <Field label="Primary Devanagari language" required>
              <SelectGrid options={DEVA_LANGUAGES} value={form.devaLanguage} onChange={set('devaLanguage')} cols={3} />
              {form.devaLanguage === 'Other' && (
                <input
                  type="text"
                  value={form.devaLanguageOther}
                  onChange={setStr('devaLanguageOther')}
                  placeholder="Please specify…"
                  className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Other language"
                />
              )}
            </Field>

            <Field label="Region where you primarily learned the script" required>
              <select
                value={form.region}
                onChange={setStr('region')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
              >
                <option value="">Select region…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Reading frequency (Devanagari)" required>
              <SelectGrid options={READING_FREQS} value={form.readingFreq} onChange={set('readingFreq')} cols={3} />
            </Field>
          </>)}

          {/* Group A extra */}
          {isGroupA && (<>
            <Field label="Years of design practice" required>
              <SelectGrid options={DESIGN_EXP} value={form.designExp} onChange={set('designExp')} cols={2} />
            </Field>

            <Field label="Primary design discipline" required>
              <SelectGrid options={DESIGN_DISCIPLINES} value={form.designDiscipline} onChange={set('designDiscipline')} cols={2} />
            </Field>
          </>)}

          {/* Group C extra */}
          {isGroupC && (<>
            <Field label="Self-described expertise" required>
              <SelectGrid options={EXPERT_TYPES} value={form.expertType} onChange={set('expertType')} cols={2} />
            </Field>

            <Field label="How would you describe your relationship to Devanagari?">
              <textarea
                value={form.expertNote}
                onChange={setStr('expertNote')}
                maxLength={500}
                rows={3}
                placeholder="Optional, max 500 characters…"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </>)}

          {/* Group D extra */}
          {isGroupD && (<>
            <Field label="Have you ever read or studied any non-Latin script?" required>
              <SelectGrid options={NON_LATIN_EXP} value={form.nonLatinExp} onChange={set('nonLatinExp')} cols={3} />
            </Field>

            <Field label="Which non-Latin scripts have you encountered, if any?">
              <input
                type="text"
                value={form.nonLatinScripts}
                onChange={setStr('nonLatinScripts')}
                maxLength={200}
                placeholder="Optional, max 200 characters…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </>)}

          <button
            type="submit"
            disabled={!isValid() || loading}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
              isValid() && !loading
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Setting up your session…' : t('demographics.continue')}
          </button>
        </form>
      </div>
    </div>
  )
}
