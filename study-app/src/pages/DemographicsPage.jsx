import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant } from '../context/ParticipantContext'
import { supabase } from '../lib/supabase'
import { generateStudyManifest, selectSessionStimuli } from '../lib/manifest'
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
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-hidden>
            *
          </span>
        )}
      </p>
      {children}
    </div>
  )
}

function SelectGrid({ options, value, onChange, cols = 3 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <SelectButton key={opt} value={opt} current={value} onClick={onChange}>
          {opt}
        </SelectButton>
      ))}
    </div>
  )
}

export default function DemographicsPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useParticipant()
  const { userType } = state

  const [form, setForm] = useState({
    ageRange: '',
    country: '',
    devaLanguage: '',
    devaLanguageOther: '',
    region: '',
    readingFreq: '',
    // Designer-specific
    designExp: '',
    designDiscipline: '',
    // Expert-specific (could be added later)
    expertType: '',
    expertNote: '',
    // General/UI designer
    nonLatinExp: '',
    nonLatinScripts: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setStr = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const isDesigner = userType === 'type_designer'
  const isUIDesigner = userType === 'ui_designer'
  const isStudent = userType === 'student'
  const isDailyUser = userType === 'daily_user'

  const isValid = () => {
    if (!form.ageRange || !form.country) return false
    if (!form.devaLanguage) return false
    if (form.devaLanguage === 'Other' && !form.devaLanguageOther.trim()) return false
    if (!form.region || !form.readingFreq) return false
    if (isDesigner && (!form.designExp || !form.designDiscipline)) return false
    if (isUIDesigner && !form.nonLatinExp) return false
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
      await supabase
        .from('participants')
        .update({ demographics: demo, status: 'in_progress' })
        .eq('id', state.participantId)
    } catch {
      // Intentionally silent
    }

    // Build session stimulus list
    try {
      const manifest = generateStudyManifest()
      const sessionStimuli = selectSessionStimuli(manifest, userType, state.participantId)

      // Map to schema structure for StudyPage
      const sessionStimuliPayload = sessionStimuli.map((s) => ({
        stimulusId: s.id,
        granularityLevel: s.granularityLevel,
        serifVariant: s.serifVariant,
        contextType: s.contextType,
        sourceType: s.sourceType,
        imageUrl: s.imageUrl,
      }))

      dispatch({
        type: 'SET_SESSION',
        payload: { stimuli: sessionStimuliPayload, seed: state.participantId },
      })

      // Persist session to Supabase
      try {
        await supabase
          .from('participants')
          .update({
            session_stimuli: sessionStimuliPayload,
          })
          .eq('id', state.participantId)
      } catch {
        // Intentionally silent
      }
    } catch (err) {
      console.error('Failed to generate session stimuli:', err)
    }

    setLoading(false)
    navigate('/instructions')
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-indigo-700 px-6 py-8">
            <h1 className="text-2xl font-bold text-white mb-2">Background Information</h1>
            <p className="text-indigo-200 text-sm">Help us better understand your perspective</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Age */}
            <Field label="How would you describe your age range?" required>
              <SelectGrid options={AGE_RANGES} value={form.ageRange} onChange={set('ageRange')} cols={3} />
            </Field>

            {/* Country */}
            <Field label="Which country are you in?" required>
              <SelectGrid options={COUNTRIES} value={form.country} onChange={set('country')} cols={2} />
            </Field>

            {/* Devanagari language */}
            <Field label="How would you describe your fluency in Devanagari?" required>
              <SelectGrid options={DEVA_LANGUAGES} value={form.devaLanguage} onChange={set('devaLanguage')} cols={3} />
              {form.devaLanguage === 'Other' && (
                <input
                  type="text"
                  placeholder="Please specify"
                  value={form.devaLanguageOther}
                  onChange={setStr('devaLanguageOther')}
                  className="mt-3 w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </Field>

            {/* Region */}
            <Field label="Which region are you based in?" required>
              <SelectGrid options={INDIAN_STATES} value={form.region} onChange={set('region')} cols={2} />
            </Field>

            {/* Reading frequency */}
            <Field label="How often do you read Devanagari?" required>
              <SelectGrid options={READING_FREQS} value={form.readingFreq} onChange={set('readingFreq')} cols={3} />
            </Field>

            {/* Designer-specific: design experience */}
            {isDesigner && (
              <>
                <Field label="What is your design experience level?" required>
                  <SelectGrid options={DESIGN_EXP} value={form.designExp} onChange={set('designExp')} cols={3} />
                </Field>

                <Field label="What design discipline(s) are you trained in?" required>
                  <SelectGrid options={DESIGN_DISCIPLINES} value={form.designDiscipline} onChange={set('designDiscipline')} cols={3} />
                </Field>
              </>
            )}

            {/* UI Designer / General: non-Latin experience */}
            {(isUIDesigner || isDailyUser) && (
              <Field label="Have you worked with or studied non-Latin scripts?" required>
                <SelectGrid options={NON_LATIN_EXP} value={form.nonLatinExp} onChange={set('nonLatinExp')} cols={3} />
              </Field>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => navigate('/consent')}
                className="flex-1 px-4 py-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!isValid() || loading}
                className="flex-1 px-4 py-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Preparing study…' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
