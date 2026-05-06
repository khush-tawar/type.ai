# New IRB Study Design — Deployment & Setup Guide

## Overview

This is a completely refactored version of the study app implementing a rich, factorial design:

**Between-Subjects (Groups A–E):**
- Group A: Type Designers
- Group B: Daily Users  
- Group C, D, E: [TBD — UI designers, students, general population, etc.]

**Within-Subjects (All participants see all 4 levels):**
1. Diacritics (isolated marks: ं, ा, ी, etc.)
2. Glyphs (individual characters: अ, ब, क, etc.)
3. Words (2–3 syllables: बिहार, दिल्ली)
4. Sentences (10–15 words in context)

**User Type Screening:**
Participants arrive with query parameters:
```
?group=A&userType=type_designer
?group=B&userType=daily_user
?group=C&userType=ui_designer
?group=D&userType=student
?group=E&userType=general
```

## New Schema Changes (Applied to Supabase)

### participants table
- Added `user_type` column (matches query param)
- Group codes now: A, B, C, D, E
- session_stimuli now includes granularityLevel, contextType, serifVariant

### responses table
- **Removed:** binary_judgment, likert_structural, category_attribution
- **Added:**
  - `granularity_level` (diacritics | glyphs | words | sentences)
  - `serif_variant` (serif_a | serif_b | serif_c)
  - `context_type` (isolated | with_context)
  - `style_taxonomy` (serif, sans_serif, handwriting, pixel, display, monospace, calligraphy, black_letter, cursive, none)
  - `likert_design_quality`
  - `likert_cultural_fit`
  - (kept: likert_readability, likert_authenticity)

### export_study_dataset() RPC
Updated to include all new fields for CSV export

## Local Setup

### 1. Run Schema Migration in Supabase SQL Editor

Copy the entire `/study-app/supabase/schema.sql` file and paste into Supabase SQL Editor. Run the entire file—it's idempotent and will update all tables/views/RPC.

### 2. Update .env.local

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Install & Test Locally

```bash
cd study-app
npm install
npm run dev
```

Visit: `http://localhost:5173/?group=A&userType=type_designer`

### 4. Test Full Flow

- Consent → Demographics (shows designer-specific fields) → Instructions → Study (4 stimuli levels) → Thanks

## Deployment to Vercel

### 1. Build Check

```bash
npm run build  # Should succeed with minor chunk warnings
```

### 2. Deploy

```bash
vercel --prod
```

### 3. Update Environment Variables in Vercel Dashboard

Project Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 4. Test Production URL

```
https://<your-deployment>.vercel.app/?group=A&userType=type_designer
https://<your-deployment>.vercel.app/?group=B&userType=daily_user
```

## Study Links (Generate for Researchers)

Template:
```
https://<deployment>/study-app/?group=A&userType=type_designer&prolific_pid={{PROLIFIC_PID}}
```

For Prolific integration, use their dynamic field placeholders.

## Key Component Changes

### New Components
- `StyleTaxonomyDropdown.jsx` — 10-category dropdown
- `LikertGroupScale.jsx` — Flexible Likert/binary scales per user type

### Refactored Pages
- `LandingPage.jsx` — Now validates both group and userType query params
- `DemographicsPage.jsx` — User-type-aware questionnaire fields
- `StudyPage.jsx` — Displays granularity level metadata, within-subjects logic, style taxonomy selection

### Manifest & Stimulus Selection
- `lib/manifest.js` — Generates complete factorial stimulus set (diacritics × glyphs × words × sentences × 3 serif variants × 4 source types × context variations)
- `selectSessionStimuli()` — Returns subset per user type (designers see all serif variants; others see one randomly assigned)

## Stimulus Asset Management

Stimuli are referenced as `/stimuli/images/stim_NNNN.png` in the manifest.

Place image files in: `public/stimuli/images/`

Example:
```
public/stimuli/images/stim_0001.png
public/stimuli/images/stim_0002.png
...
```

The manifest generator creates ~500+ stimulus references (4 granularity × 3 variants × 4 sources × 2 contexts × ~20 base stimuli).

## Data Export & Analysis

### Researcher Page
Access at `https://<deployment>/researcher`

Passphrase-gated CSV download includes all new fields:
- granularity_level
- serif_variant
- context_type
- style_taxonomy
- likert_design_quality
- likert_cultural_fit
- group_specific_response (JSONB: e.g., {"use_in_project": true})

### Analysis Queries

Example: Compare design quality ratings by user type and granularity:
```sql
SELECT
  user_type,
  granularity_level,
  COUNT(*) AS n,
  ROUND(AVG(likert_design_quality)::NUMERIC, 2) AS avg_design_quality,
  ROUND(AVG(likert_readability)::NUMERIC, 2) AS avg_readability
FROM stimulus_responses
WHERE NOT skipped
GROUP BY user_type, granularity_level
ORDER BY user_type, granularity_level;
```

## Troubleshooting

### "Study link not found"
- Check query params: `?group=A&userType=type_designer` are both present
- Valid groups: A, B, C, D, E
- Valid user types: type_designer, daily_user, ui_designer, student, general

### "Image unavailable"
- Check that stimulus images exist in `public/stimuli/images/`
- Browser DevTools → Network tab to confirm 404s
- Fallback UI allows users to skip without submitting image

### localStorage Persistence
- Session auto-resumes on page reload to exact stimulus
- Stored under `study_session_${participantId}` key
- Can manually clear in DevTools → Application → localStorage for testing

## IRB Compliance Notes

- All participant responses logged with UUID (no PII in client code)
- Drawings stored in Supabase Storage (private bucket, RLS policies enforce anon insert only)
- CSV export allows researcher to link back to Prolific IDs if needed
- 3-year data retention: IRB-compliant deletion script in schema.sql comments

## Next Steps

1. ✅ Refactor complete & tested locally
2. → Update study links with full query parameters
3. → Run schema migration in Supabase
4. → Deploy to Vercel with env vars
5. → Smoke test production URLs
6. → Generate study link variants for researcher distribution
7. → Monitor responses in researcher export

---

**Questions?** Refer to [CLAUDE.md](../CLAUDE.md) for design system rules or DemographicsPage for demographic screening logic.
