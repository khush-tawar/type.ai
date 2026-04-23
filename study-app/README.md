# Devanagari Typography Evaluation Study

A web-based human subjects research tool for collecting community feedback on AI-generated Devanagari typography. IRB-approved study flow: consent → demographics → instructions → stimulus rating → debrief.

## Quick Start

```bash
cd study-app
npm install
cp .env.example .env.local   # fill in your credentials
npm run dev
```

Open http://localhost:5173.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 |
| Drawing | react-sketch-canvas |
| Backend | Supabase (Postgres + RLS) |
| Deployment | Vercel (or any static host) |

---

## Adding Stimuli

1. **Add images** to `public/stimuli/`. PNG at 400×400 px works best; white or transparent background.
2. **Edit `src/data/stimuli.json`** — add an entry per image:

```json
{
  "id": "stim_ai_009",
  "image_path": "/stimuli/ai_009.png",
  "source_type": "ai",
  "allow_drawing": true
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier — never change after data collection starts |
| `image_path` | string | Path relative to `public/` |
| `source_type` | `"ai"` \| `"professional"` \| `"historical"` \| `"control"` | **Never shown to participants** |
| `allow_drawing` | boolean | Show drawing canvas on this stimulus (~30% recommended) |

The app selects N=30 stimuli per participant, balanced across `source_type` groups and randomized.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_PROLIFIC_CODE=DEVTYPE25
```

Get the URL and anon key from **Supabase dashboard → Project Settings → API**.

---

## Supabase Setup

1. Create a new Supabase project.
2. In the SQL editor, paste and run `supabase/schema.sql`.
3. Copy your project URL and anon key into `.env.local`.

### Pulling Data

```sql
-- All responses as flat rows (one per stimulus per participant)
SELECT * FROM stimulus_responses;

-- Export CSV from the Supabase table editor or:
-- supabase db dump --data-only -t study_responses > data.sql
```

### Drawing Annotations

Drawing PNGs are stored as base64 data URLs in `responses[*].drawingData`. To extract them:

```python
import json, base64, pathlib

with open('data.json') as f:
    rows = json.load(f)

for row in rows:
    pid = row['participant_id'][:8]
    for resp in row['responses']:
        if resp.get('drawingData'):
            header, b64 = resp['drawingData'].split(',', 1)
            pathlib.Path(f"drawings/{pid}_{resp['stimulusId']}.png").write_bytes(
                base64.b64decode(b64)
            )
```

---

## Deployment (Vercel)

```bash
# From the study-app directory
vercel deploy
```

Set environment variables in the Vercel dashboard under **Settings → Environment Variables**.

The `vercel.json` already handles SPA routing.

### Other Hosts

Any static host works (Netlify, GitHub Pages, Cloudflare Pages). Build with `npm run build` — output is in `dist/`.

---

## Study Configuration

| Setting | Location | Default |
|---|---|---|
| N stimuli per participant | `App.jsx` line `const N_STIMULI` | 30 |
| Consent form text | `WelcomePage.jsx` `CONSENT_TEXT` | Placeholder |
| Debrief text | `DebriefPage.jsx` `DEBRIEF_TEXT` | Placeholder |
| Prolific completion code | `.env.local` `VITE_PROLIFIC_CODE` | `DEVTYPE25` |
| Likert scale labels | `RatingPage.jsx` `SCALES` array | Editable |

---

## Data Schema

Each row in `study_responses` has:

```
participant_id   UUID
demographics     { language, region, ageRange, readingFrequency }
responses        [
  {
    stimulusId       string
    sourceType       string
    verdict          "accept" | "reject" | null
    ratings          { structuralCorrectness, culturalAuthenticity, readability }  (1–7)
    annotation       string
    drawingData      string | null  (base64 PNG)
    timeSpentMs      number
    skipped          boolean
    timestamp        ISO 8601 string
  },
  ...
]
submitted_at     ISO 8601 string
```

Use the `stimulus_responses` view in Supabase for flat per-stimulus analysis.

---

## Participant Flow

```
Welcome + Consent
       ↓
  Demographics
       ↓
  Instructions
       ↓
  Rating (×30)  ←─ localStorage auto-save (refresh-safe)
       ↓
  Debrief + Prolific code
```

Progress is saved in `localStorage` key `deva-study-v1`. Participants can safely refresh or close and return.

---

## IRB Notes

- No personally identifiable information is collected.
- Participant IDs are UUID v4 generated client-side.
- No cookies beyond localStorage.
- No analytics, no tracking pixels.
- `robots: noindex` in `index.html` prevents search engine indexing.
- Replace placeholder consent/debrief text with your IRB-approved language before deployment.
