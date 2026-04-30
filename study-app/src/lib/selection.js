// Seeded PRNG (Mulberry32) — deterministic given the same seed.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function seededShuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function groupBy(arr, keyFn) {
  const map = {}
  for (const item of arr) {
    const k = keyFn(item)
    if (!map[k]) map[k] = []
    map[k].push(item)
  }
  return map
}

const GROUP_B_CONTEXTS = ['a sign', 'a book', 'an invitation', 'an app interface']

function sampleBalancedCells(stimuli, targetCount, rng) {
  const cells = groupBy(stimuli, stim => `${stim.source_type}|${stim.scale}|${stim.context}`)
  const cellKeys = seededShuffle(Object.keys(cells), rng)
  const picks = []

  while (picks.length < targetCount) {
    let addedThisPass = false

    for (const key of cellKeys) {
      const pool = cells[key]
      if (!pool || pool.length === 0) continue

      const index = Math.floor(rng() * pool.length)
      const [picked] = pool.splice(index, 1)
      if (!picked) continue

      picks.push(picked)
      addedThisPass = true

      if (picks.length >= targetCount) break
    }

    if (!addedThisPass) break
  }

  return picks
}

/**
 * Build a reproducible, balanced per-session stimulus list.
 * The same participantId + manifest will always produce the same list.
 */
export function buildSession(manifest, group, participantId) {
  const config = manifest.groups[group]
  if (!config) throw new Error(`Unknown group: ${group}`)

  const { stimuli_per_session, drawing_subset_pct } = config
  const seed = hashStr(participantId)
  const rng = mulberry32(seed)

  const allStimuli = Array.isArray(manifest.stimuli) ? manifest.stimuli : []
  const targetCount = Math.min(stimuli_per_session, allStimuli.length)

  // Stratify by source_type × scale × context in a round-robin pass.
  const selected = sampleBalancedCells(seededShuffle(allStimuli, rng), targetCount, rng)

  // Fill any gaps with remaining stimuli if some cells ran out early.
  if (selected.length < targetCount) {
    const usedIds = new Set(selected.map(stim => stim.id))
    const remainder = seededShuffle(allStimuli.filter(stim => !usedIds.has(stim.id)), rng)
    selected.push(...remainder.slice(0, targetCount - selected.length))
  }

  // Randomize presentation order with the same seed for reproducibility.
  const ordered = seededShuffle(selected, rng)

  // Assign drawing canvas to a random subset
  const drawingCount = Math.round(ordered.length * drawing_subset_pct)
  const indices = seededShuffle([...Array(ordered.length).keys()], rng)
  const drawingSet = new Set(indices.slice(0, drawingCount))

  return ordered.map((stim, i) => ({
    ...stim,
    sessionDrawing: drawingSet.has(i),
    // Group B: each stimulus gets a randomly assigned trust context
    groupBContext: group === 'B'
      ? GROUP_B_CONTEXTS[Math.floor(rng() * GROUP_B_CONTEXTS.length)]
      : null,
  }))
}

let _manifestCache = null

export async function loadManifest() {
  if (_manifestCache) return _manifestCache
  const res = await fetch('/stimuli/manifest.json')
  if (!res.ok) throw new Error('Failed to load stimulus manifest')
  _manifestCache = await res.json()
  return _manifestCache
}
