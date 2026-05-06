export default function StyleTaxonomyDropdown({ value, onChange, disabled = false }) {
  const options = [
    { value: 'serif', label: 'Serif' },
    { value: 'sans_serif', label: 'Sans Serif' },
    { value: 'handwriting', label: 'Handwriting' },
    { value: 'pixel', label: 'Pixel' },
    { value: 'display', label: 'Display' },
    { value: 'monospace', label: 'Monospace' },
    { value: 'calligraphy', label: 'Calligraphy' },
    { value: 'black_letter', label: 'Black Letter' },
    { value: 'cursive', label: 'Cursive' },
    { value: 'none', label: 'None of the above' },
  ]

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Which style category best represents this typeface?
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
      >
        <option value="">— Select a category —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
