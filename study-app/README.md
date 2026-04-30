# Devanagari Evaluation Study App

Web-based, anonymous research instrument for evaluating Devanagari samples across blinded source conditions.

## Stack

- React 18 + Vite
- Tailwind CSS
- Supabase (Postgres + Storage + RLS)
- Vercel

## Participant Flow

- `/` landing + group-link validation (`?group=A|B|C|D`)
- `/consent`
- `/demographics`
- `/instructions`
- `/study` (stimulus loop)
- `/thanks`
- `/withdrawn`
- `/researcher` (passphrase-gated utility page)

## One-Time Setup (Supabase)

1. Create a Supabase project.
2. Go to SQL Editor and run `supabase/schema.sql`.
3. In Storage, create a private bucket named `drawings`.
4. Confirm the SQL finished without errors, especially:
   - tables: `participants`, `consent_events`, `responses`
   - view: `stimulus_responses`
   - function: `export_study_dataset()`

Notes:
- RLS policies are included and idempotent (`DROP POLICY IF EXISTS` + recreate).
- The schema includes an export RPC used by `/researcher`.

## Environment Variables

Create `.env.local` in `study-app`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_PROLIFIC_CODE=DEVTYPE25
VITE_RESEARCHER_PASSPHRASE=choose-a-strong-passphrase
```

If Supabase vars are not set, writes are safely no-op/logged locally for UI testing.

## Local Development

```bash
cd study-app
npm install
npm run dev
```

Production build check:

```bash
cd study-app
npm run build
```

## Deploy to Vercel

1. Import the repo into Vercel (or use CLI).
2. Add the same env vars in Vercel Project Settings.
3. Deploy.

`vercel.json` is configured for SPA routing and npm-based install/build.

## Stimuli Management

Stimuli are static assets and metadata-driven.

- Manifest: `public/stimuli/manifest.json`
- Images directory: `public/stimuli/images/`

To add/edit stimuli:
1. Add or replace image files in `public/stimuli/images/`.
2. Update `public/stimuli/manifest.json` entries (`id`, `image_path`, `source_type`, `scale`, `context`, `metadata`).
3. Commit and deploy.

Tip: use Vercel preview deployments for quick stimulus QA before production.

## Data Capture Summary

Session-level table: `participants`
- group, demographics, status, session seed/order, timestamps

Consent log: `consent_events`

Per-stimulus table: `responses`
- includes `stimulus_id`, `source_type`, binary judgment, 3 Likerts, category, optional text, optional drawing path, group-specific response, timing, skip flag

Drawings:
- uploaded to Supabase Storage bucket `drawings`
- path format: `participantId/stimulusId.png`

## Pulling Data

You have 3 options:

1. Supabase dashboard tables/views
2. `/researcher` route exports
3. SQL/RPC function: `export_study_dataset()`

### `/researcher` utilities

- Aggregate counts by group/status and completion rate
- CSV download via `export_study_dataset()`
- Drawings ZIP download from Storage (PNG files)

## IRB Retention and Data Deletion

Per protocol, run data destruction at retention end (example: 3 years):

```sql
DELETE FROM responses;
DELETE FROM consent_events;
DELETE FROM participants;
```

Also empty the `drawings` storage bucket in Supabase Storage.

IRB audit practice:
- capture screenshots of SQL deletion execution and Storage deletion confirmation for records.

## Privacy Notes

- No analytics SDKs are integrated.
- No external CDN-hosted stimulus assets are used.
- No direct PII fields are collected in study forms.
- Supabase edge/network logs are managed by Supabase; configure retention in your Supabase project according to policy.

## Project Pointers

- `src/App.jsx`: router + progress persistence shell
- `src/context/ParticipantContext.jsx`: participant/session state + local persistence
- `src/pages/StudyPage.jsx`: main trial UI and response submit/queue flow
- `src/pages/ResearcherPage.jsx`: passphrase gate + CSV/ZIP exports
- `src/lib/selection.js`: seeded per-session stimulus selection
- `src/lib/storage.js`: drawing upload + metadata strip
- `supabase/schema.sql`: DDL, RLS, export function
