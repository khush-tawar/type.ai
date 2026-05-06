/**
 * Stimulus manifest generator for the typography study.
 * 
 * Within-subjects design: 4 granularity levels
 * - diacritics: isolated marks (ं, ा, ी, etc.)
 * - glyphs: individual characters (अ, ब, क, etc.)
 * - words: 2–3 syllables (बिहार, दिल्ली, etc.)
 * - sentences: 10–15 words in context
 * 
 * Multiple serif variants for designer comparison
 */

export const GRANULARITY_LEVELS = ['diacritics', 'glyphs', 'words', 'sentences']
export const CONTEXT_TYPES = ['isolated', 'with_context']
export const SERIF_VARIANTS = ['serif_a', 'serif_b', 'serif_c']
export const SOURCE_TYPES = ['ai', 'professional', 'historical', 'control']
export const STYLE_CATEGORIES = [
  'serif',
  'sans_serif',
  'handwriting',
  'pixel',
  'display',
  'monospace',
  'calligraphy',
  'black_letter',
  'cursive',
  'none',
]

/**
 * Generate a comprehensive stimulus manifest for the study.
 * Returns a list of stimuli with metadata.
 */
export function generateStudyManifest() {
  const stimuli = []
  let id = 1

  // For each granularity level
  for (const granularityLevel of GRANULARITY_LEVELS) {
    // For each serif variant (designers see 3, others see 1 randomly assigned)
    for (const serifVariant of SERIF_VARIANTS) {
      // For each source type
      for (const sourceType of SOURCE_TYPES) {
        // Optionally with context (for words and sentences)
        const contextTypes =
          granularityLevel === 'words' || granularityLevel === 'sentences'
            ? CONTEXT_TYPES
            : ['isolated']

        for (const contextType of contextTypes) {
          stimuli.push({
            id: String(id).padStart(4, '0'),
            granularityLevel,
            serifVariant,
            sourceType,
            contextType,
            imageUrl: `/stimuli/images/stim_${String(id).padStart(4, '0')}.png`,
          })
          id++
        }
      }
    }
  }

  return stimuli
}

/**
 * Select a subset of stimuli per session based on participant group and user type.
 * 
 * Type designers see all serif variants + weights.
 * Other groups see one randomly assigned serif.
 */
export function selectSessionStimuli(manifest, userType, participantId) {
  const seed = participantId.split('-').pop() // Use last segment of UUID as simple seed
  const seedValue = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0)

  if (userType === 'type_designer') {
    // Designers see full manifest (all serif variants)
    return shuffle(manifest, seedValue)
  } else {
    // Other groups see one serif variant (randomly assigned per session)
    const selectedVariant = SERIF_VARIANTS[seedValue % SERIF_VARIANTS.length]
    const filtered = manifest.filter((s) => s.serifVariant === selectedVariant)
    return shuffle(filtered, seedValue)
  }
}

// Simple Fisher-Yates shuffle with deterministic seed
function shuffle(array, seed) {
  const arr = [...array]
  let random = seed
  for (let i = arr.length - 1; i > 0; i--) {
    random = (random * 9301 + 49297) % 233280
    const j = Math.floor((random / 233280) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Get group-specific Likert scales.
 * All groups rate design_quality, readability, authenticity, cultural_fit.
 * But the questions can be phrased differently per group.
 */
export function getGroupLikertQuestions(userType) {
  const baseQuestions = [
    {
      key: 'likert_design_quality',
      label: 'Design Quality',
      prompt: 'How would you rate the overall design quality of this typeface?',
    },
    {
      key: 'likert_readability',
      label: 'Readability',
      prompt: 'How readable is this typeface?',
    },
    {
      key: 'likert_authenticity',
      label: 'Authenticity',
      prompt: 'How authentic or culturally appropriate does this feel?',
    },
    {
      key: 'likert_cultural_fit',
      label: 'Cultural Fit',
      prompt: 'Does this typeface feel suited for its context?',
    },
  ]

  // Customize per user type
  if (userType === 'type_designer') {
    return [
      ...baseQuestions,
      {
        key: 'group_specific_use_in_project',
        label: 'Professional Use',
        prompt: 'Would you consider using this in a professional design project?',
        scale: 'binary', // yes/no
      },
    ]
  } else if (userType === 'daily_user') {
    return [
      ...baseQuestions,
      {
        key: 'group_specific_use_daily',
        label: 'Daily Relevance',
        prompt: 'Would you be likely to use this font in your everyday contexts?',
        scale: 'binary',
      },
    ]
  }

  // General and other types
  return baseQuestions
}

/**
 * Parse group-specific response from the study page
 */
export function buildGroupSpecificPayload(userType, responses) {
  const payload = {}

  if (userType === 'type_designer' && responses.group_specific_use_in_project !== undefined) {
    payload.use_in_project = responses.group_specific_use_in_project
  } else if (userType === 'daily_user' && responses.group_specific_use_daily !== undefined) {
    payload.use_daily = responses.group_specific_use_daily
  }

  return Object.keys(payload).length > 0 ? payload : null
}
