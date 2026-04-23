import { useState } from 'react'

const REGIONS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar Islands', 'Chandigarh', 'Delhi (NCT)',
  'Jammu & Kashmir', 'Ladakh', 'Puducherry',
  'Nepal',
  'Other / Outside South Asia',
]

const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55+']
const FREQUENCIES = ['Daily', 'Several times a week', 'Weekly', 'Monthly', 'Rarely']
const LANGUAGES = ['Hindi', 'Marathi', 'Sanskrit', 'Nepali', 'Other']

function SelectButton({ value, current, onClick, children }) {
  const selected = value === current
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={selected}
      className={`py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all duration-100 ${
        selected
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
          : 'border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 bg-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function DemographicsPage({ onComplete }) {
  const [form, setForm] = useState({
    language: '',
    languageOther: '',
    region: '',
    ageRange: '',
    readingFrequency: '',
  })

  const isValid =
    form.language !== '' &&
    (form.language !== 'Other' || form.languageOther.trim() !== '') &&
    form.region !== '' &&
    form.ageRange !== '' &&
    form.readingFrequency !== ''

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return
    const data = { ...form }
    if (form.language !== 'Other') delete data.languageOther
    onComplete(data)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-700 px-8 py-5">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Step 1 of 3</p>
          <h2 className="text-xl font-bold text-white">Background Information</h2>
          <p className="text-indigo-200 text-sm mt-1">A few quick questions about your background</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-7" noValidate>

          {/* Primary language */}
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-800 mb-2.5">
              Primary Devanagari language <span className="text-red-500" aria-hidden>*</span>
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {LANGUAGES.map(lang => (
                <SelectButton key={lang} value={lang} current={form.language} onClick={v => setForm(f => ({ ...f, language: v }))}>
                  {lang}
                </SelectButton>
              ))}
            </div>
            {form.language === 'Other' && (
              <input
                type="text"
                value={form.languageOther}
                onChange={e => setForm(f => ({ ...f, languageOther: e.target.value }))}
                placeholder="Please specify…"
                className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Other language name"
              />
            )}
          </fieldset>

          {/* Region */}
          <div>
            <label htmlFor="region" className="block text-sm font-semibold text-slate-800 mb-2.5">
              Region where you learned Devanagari <span className="text-red-500" aria-hidden>*</span>
            </label>
            <select
              id="region"
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="">Select state / country…</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Age range */}
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-800 mb-2.5">
              Age range <span className="text-red-500" aria-hidden>*</span>
            </legend>
            <div className="grid grid-cols-5 gap-2">
              {AGE_RANGES.map(r => (
                <SelectButton key={r} value={r} current={form.ageRange} onClick={v => setForm(f => ({ ...f, ageRange: v }))}>
                  {r}
                </SelectButton>
              ))}
            </div>
          </fieldset>

          {/* Reading frequency */}
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-800 mb-2.5">
              How often do you read Devanagari? <span className="text-red-500" aria-hidden>*</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FREQUENCIES.map(f => (
                <SelectButton key={f} value={f} current={form.readingFrequency} onClick={v => setForm(prev => ({ ...prev, readingFrequency: v }))}>
                  {f}
                </SelectButton>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!isValid}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
              isValid
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continue →
          </button>
        </form>
      </div>
    </div>
  )
}
