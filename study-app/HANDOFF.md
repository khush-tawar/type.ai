# HANDOFF

## What Was Not Fully Implemented

- Full cross-device manual verification (iOS Safari / Android Chrome / desktop Firefox) was not executed in this environment.
- Browser-history hard block inside `/study` (preventing manual back navigation) is not explicitly enforced yet.
- Researcher auth is intentionally lightweight (env passphrase) and is not production-grade security.

## What Was Implemented Differently

- Export now uses Supabase RPC (`export_study_dataset()`) instead of client-side joining table queries.
  - Reason: centralizes export schema and keeps researcher CSV logic stable as frontend changes.
- `source_type` is persisted with each response row.
  - Reason: ensures exports include source metadata without requiring external manifest joins.
- Supabase client supports no-op mode when env vars are absent.
  - Reason: allows offline UI iteration without runtime crashes.

## IRB-Relevant Concerns Observed

- Blinding risk: `source_type` is available in in-memory client state by design for researcher export consistency. It is not rendered in UI, but a technically advanced participant can inspect client state/DevTools.
  - Mitigation option: avoid storing `source_type` client-side and attach it post-hoc server-side during export.
- Storage policy currently allows anon inserts to `drawings` bucket by bucket check only.
  - Mitigation option: add stronger path constraints if needed (for example participant-scoped patterns).
- Supabase logs may contain network metadata outside app control.
  - Action: configure Supabase retention policies to align with IRB/privacy constraints.

## Suggested Next Steps (v2)

1. Add strict `/study` back-navigation handling (history trap + route guard).
2. Add explicit automated tests for resume behavior and skip/submit data shape.
3. Add optional server-side validation for response payload constraints.
4. Add localization packs (`hi`, `mr`) using current `t('key')` scaffolding.
5. Move researcher tooling behind proper auth if used beyond pilot phases.
