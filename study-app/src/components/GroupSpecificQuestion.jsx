// Group-specific per-stimulus question — rendered inside StudyPage.

const PROJECT_TYPES = [
  'Client work', 'Personal project', 'Editorial', 'Branding', 'Display', 'Body text', 'Other',
]

function RadioRow({ options, value, onChange, name }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name || 'Response options'}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          role="radio"
          aria-checked={value === opt}
          className={`min-h-11 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all duration-100 ${
            value === opt
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-300 text-slate-600 hover:border-indigo-400 bg-white'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function Chip({ label, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all duration-100 ${
        selected
          ? 'bg-indigo-100 border-indigo-400 text-indigo-800'
          : 'border-slate-200 text-slate-500 hover:border-slate-400 bg-white'
      }`}
    >
      {label}
    </button>
  )
}

// Group A
function GroupAQuestion({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  const toggleProject = (p) => {
    const current = value.projects || []
    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p]
    set('projects', next)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-800">
        Would you use this in your own design work?
        <span className="text-slate-400 font-normal ml-1">(required)</span>
      </p>
      <RadioRow
        name="Group A use intention"
        options={['Yes', 'Maybe', 'No']}
        value={value.use}
        onChange={v => set('use', v)}
      />
      {(value.use === 'Yes' || value.use === 'Maybe') && (
        <div>
          <p className="text-xs text-slate-500 mb-2">For what kind of project? (select all that apply)</p>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPES.map(p => (
              <Chip
                key={p}
                label={p}
                selected={(value.projects || []).includes(p)}
                onToggle={() => toggleProject(p)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Group B
function GroupBQuestion({ value, onChange, context }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-800">
        Would you trust this in <em>{context}</em>?
        <span className="text-slate-400 font-normal ml-1">(required)</span>
      </p>
      <RadioRow
        name="Group B trust intention"
        options={['Yes', 'Maybe', 'No']}
        value={value.trust}
        onChange={v => onChange({ ...value, trust: v })}
      />
    </div>
  )
}

// Group C
function GroupCQuestion({ value, onChange }) {
  return (
    <div>
      <label htmlFor="expert-note" className="block text-sm font-semibold text-slate-800 mb-2">
        Briefly note anything notable about this sample{' '}
        <span className="text-slate-400 font-normal">(optional, max 300 chars)</span>
      </label>
      <textarea
        id="expert-note"
        value={value.note || ''}
        onChange={e => onChange({ ...value, note: e.target.value })}
        maxLength={300}
        rows={2}
        placeholder="Unusual stroke angles, missing conjuncts, regional variant…"
        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}

// Group D
const REAL_SCRIPT_OPTIONS = ['Definitely', 'Probably', 'Not sure', 'Probably not', 'Definitely not']

function GroupDQuestion({ value, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-800">
        Does this look like a real, functioning script to you?
        <span className="text-slate-400 font-normal ml-1">(required)</span>
      </p>
      <RadioRow
        name="Group D script realism"
        options={REAL_SCRIPT_OPTIONS}
        value={value.looksReal}
        onChange={v => onChange({ ...value, looksReal: v })}
      />
      <div>
        <label htmlFor="group-d-reminder" className="block text-xs text-slate-500 mb-1">
          What does it remind you of? <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="group-d-reminder"
          type="text"
          value={value.reminder || ''}
          onChange={e => onChange({ ...value, reminder: e.target.value })}
          maxLength={200}
          placeholder="e.g., Arabic, some Asian script, symbols, nothing in particular…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  )
}

export default function GroupSpecificQuestion({ group, stimulus, value, onChange }) {
  if (group === 'A') return <GroupAQuestion value={value} onChange={onChange} />
  if (group === 'B') return <GroupBQuestion value={value} onChange={onChange} context={stimulus.groupBContext || 'this context'} />
  if (group === 'C') return <GroupCQuestion value={value} onChange={onChange} />
  if (group === 'D') return <GroupDQuestion value={value} onChange={onChange} />
  return null
}

// Validation helper used by StudyPage
export function isGroupResponseValid(group, value) {
  if (group === 'A') return !!value.use
  if (group === 'B') return !!value.trust
  if (group === 'C') return true // optional
  if (group === 'D') return !!value.looksReal
  return true
}
