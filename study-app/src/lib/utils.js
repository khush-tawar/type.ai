/**
 * Select N stimuli from the manifest, balanced across source_type categories.
 * Randomizes order. Falls back gracefully if fewer stimuli than requested.
 */
export function selectStimuli(manifest, n = 30) {
  const all = Array.isArray(manifest) ? manifest : (manifest.stimuli ?? [])
  if (all.length === 0) return []

  // Group by source_type
  const groups = {}
  for (const s of all) {
    const type = s.source_type ?? 'unknown'
    if (!groups[type]) groups[type] = []
    groups[type].push(s)
  }

  const types = Object.keys(groups)
  const perType = Math.floor(n / types.length)
  const selected = []

  for (const type of types) {
    const shuffled = fisherYates([...groups[type]])
    selected.push(...shuffled.slice(0, perType))
  }

  // Fill any remaining slots (due to rounding) with random items not yet selected
  const remaining = n - selected.length
  if (remaining > 0) {
    const usedIds = new Set(selected.map(s => s.id))
    const pool = fisherYates(all.filter(s => !usedIds.has(s.id)))
    selected.push(...pool.slice(0, remaining))
  }

  return fisherYates(selected)
}

export function fisherYates(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
