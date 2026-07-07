# Dietoy Phase 1 — Stability-first client records

This phase must keep the app buildable after every commit. The current implementation already contains the core schema foundations for visits, attachments, body-analysis attachments, service catalog, visit services, and calculation settings. The next work must connect these safely to the UI in small commits.

## Non-negotiable rules

1. Do not overwrite `App.tsx` with a large untested replacement.
2. Each change must preserve installer build compatibility.
3. Data must stay in the existing app-data location and existing identifier.
4. The existing SQLite database must migrate forward without deleting client data.
5. Backup/export must include every new table before the UI exposes it to customers.

## Phase 1A — Build stability

- Run GitHub Actions on `main` before any new feature commit.
- If build fails, fix compile errors before adding UI.
- Keep each commit scoped to one area only.

## Phase 1B — Client goal grouping

Visible feature:

- Show all clients.
- Show only weight-loss clients.
- Show only weight-gain clients.
- Show maintenance/other goals separately.

Implementation target:

- Add a goal filter on the Clients screen.
- Do not alter the client data model.
- Reuse existing `goal` field and existing `goalLabels`.

## Phase 1C — Attachments and body analysis

Visible feature:

- In each client profile, add an Attachments section.
- Upload files from the user's computer.
- Mark file category as `body_analysis`, `lab`, `medical_report`, or `other`.
- Require an attachment date.
- Body-analysis files must appear in their own list.
- Open/view files from the client profile.

Implementation target:

- Use the existing `attachments` table.
- Use category `body_analysis` for body-analysis reports.
- Store copied files under app data, not next to the installer.

## Phase 1D — Visits and services

Visible feature:

- Create/edit a visit for a client.
- Add services from the service catalog.
- Allow manual fee entry.
- Automatically calculate total fee for the visit.

Implementation target:

- Use `visits`, `service_catalog`, and `visit_services` tables.
- Preserve service name snapshot for historical accuracy.

## Phase 1E — PDF and cloud later

Not in the first safe UI commit:

- Google Drive login.
- Google Drive backup.
- Client profile PDF export.
- Website sync.

These require a separate security and OAuth architecture phase.
