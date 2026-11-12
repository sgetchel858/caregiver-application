# Casanté demo: data contracts

The app talks to two backends through typed interfaces. Screens never know which implementation they get.

| Service | Interface | Mock (default) | Real |
|---|---|---|---|
| Health API: medical information + agent | `src/services/HealthApi.ts` | `src/services/mock/MockHealthApi.ts` (fixtures in `mock/fixtures/health.ts`, scripted answers in `mock/scriptedAnswers.ts`) | `src/services/live/LiveHealthApi.ts` (fetch client, ready) |
| App store: app data only | `src/services/AppStore.ts` | `src/services/mock/MockAppStore.ts` (localStorage, seeded from `mock/fixtures/app.ts`) | `src/services/live/SupabaseAppStore.ts` (schema in `supabase/migrations/`) |

Switch with env vars at build time (`.env.local` locally, workflow `env:` in CI):

```
VITE_HEALTH_API=mock | live        # live also needs VITE_HEALTH_API_URL
VITE_APP_STORE=mock | supabase     # supabase also needs VITE_AUTH=auth0, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (both set in .env)
```

All types referenced below live in `src/services/types.ts`; that file is the source of truth for field-level detail.

---

## Part 1 · Health API contract

**Base URL:** `VITE_HEALTH_API_URL`, e.g. `https://api.casante.example/v1`. No other URL appears in the app.

**Conventions**
- JSON in and out, `Content-Type: application/json`.
- **Dates:** `ISODate` = `"2026-10-28"`. `LocalDateTime` = `"2026-11-12T10:30:00"`, **no offset**, in the member's own time zone (wall-clock time as recorded). The app shows these as written, wherever the phone is.
- **Rich text:** fields marked *rich* may contain `**bold**` and blank-line paragraph breaks, nothing else.
- **Errors:** `404` → "not found" UI. Any other non-2xx, network failure or a 20 s timeout → error state with Retry. A JSON error body is optional and is not shown to users.
- **Auth:** with `VITE_AUTH=auth0`, every request carries the signed-in user's Auth0 access token (`Authorization: Bearer …`, audience `https://sil-api`) and `X-SIL-Tenant: <tenant id>`, supplied by `SilClient.authHeaders()`. A `401` reads as "session ended", a `403` as "no access". Setup: [README.md](README.md#sign-in-with-the-cognatum-account-auth0). Never put a static secret in a `VITE_*` variable: the bundle is public.
- **Member ids:** `memberId` is the Health API's id for a person. The app store maps family members to it via `family_members.health_member_id`.
- **Sources:** every answer must cite at least one `SourceRef`, and every `recordId` must resolve via `GET /members/{id}/records/{recordId}`. The UI relies on this to keep the "every answer shows its source" guardrail.

### Medical information

#### `GET /family/briefing?members={id},{id}`
One agent line per person, plus nudges for the family home.

Response `FamilyBriefing`:
```json
{
  "nudges": [
    { "id": "n1", "memberId": "margaret",
      "text": "Mom sees **Dr. Okafor** (neurology) tomorrow at 10:30 AM. Want help getting ready?" }
  ],
  "statuses": [
    { "memberId": "margaret", "line": "Neurology tomorrow, 10:30 AM", "recordsConnected": true },
    { "memberId": "mike", "line": "Flu shot due this month", "recordsConnected": false }
  ]
}
```

#### `GET /members/{memberId}/profile` → `MemberProfile`
```json
{
  "memberId": "margaret", "fullName": "Margaret Mitchell", "firstName": "Margaret",
  "dateOfBirth": "1948-04-03", "age": 78, "primaryClinicianId": "dr-yojansen",
  "allergies": [{ "substance": "Penicillin", "reaction": "hives" }],
  "connection": { "source": "MyChart", "healthSystems": 2, "updatedAt": "2026-11-11T18:12:00" }
}
```

#### `GET /members/{memberId}/medications` → `Medication[]`
```json
[{
  "id": "med-warfarin", "name": "Warfarin", "strength": "5 mg",
  "schedule": "every evening", "scheduleShort": "evening",
  "prescriberId": "dr-reyes", "purpose": "blood thinner",
  "lastDose": { "takenAt": "2026-11-13T20:04:00", "source": "kitchen-hub" },
  "lastRefill": { "date": "2026-10-30", "pharmacy": "Main Street Pharmacy" }
}]
```

#### `GET /members/{memberId}/care-team` → `Clinician[]`
```json
[{ "id": "dr-yojansen", "name": "Dr. Yojansen", "role": "GP",
   "practice": "Riverside Primary Care", "phone": "(555) 014-2290" }]
```

#### `GET /members/{memberId}/visits?upcoming=true|false` → `Visit[]`
`upcoming=true` returns future visits, and `false` returns past visits. Both are sorted oldest first.
```json
[{ "id": "v-okafor", "clinicianId": "dr-okafor", "startsAt": "2026-11-12T10:30:00",
   "location": "Riverside Neurology", "reason": "Hand tremor",
   "referredById": "dr-yojansen", "referredOn": "2026-10-28" }]
```

#### `GET /members/{memberId}/vitals?type=bp` → `VitalReading[]`
```json
[{ "id": "bp-2026-10-28", "type": "bp", "systolic": 110, "diastolic": 86, "unit": "mmHg",
   "takenAt": "2026-10-28T10:09:00", "clinicianId": "dr-yojansen",
   "facility": "Riverside Primary Care", "recordId": "rec-visit-2026-10-28" }]
```

#### `GET /members/{memberId}/records/{recordId}` → `RecordDetail`
This opens when a source chip is tapped. `highlight` must be a substring of `excerpt`.
```json
{ "id": "rec-visit-2026-10-28", "kind": "visit-summary", "title": "Visit summary",
  "date": "2026-10-28", "facility": "Riverside Primary Care", "author": "Dr. Yojansen",
  "excerpt": "Vitals: BP 110/86 mmHg, pulse 72 …", "highlight": "BP 110/86 mmHg" }
```

#### `GET /members/{memberId}/encounters/current` → `Encounter` or `204 No Content`
This drives the "At St. Luke's Medical Center" strip. `newOrders` pre-fills Add medication.
```json
{ "id": "enc-1", "facility": "St. Luke's Medical Center", "kind": "emergency",
  "startedAt": "2026-11-14T11:20:00",
  "newOrders": [{ "name": "Ciprofloxacin 500 mg", "frequency": "Twice a day for 7 days",
                  "prescribedBy": "St. Luke's ER team", "reason": "Urinary tract infection" }] }
```

### Agent

#### `GET /members/{memberId}/ask/suggestions` → `AskSuggestions`
```json
{ "prompts": ["What meds is Mom on?", "Who's her cardiologist?"],
  "prefill": "What was Mom's BP at her last appointment with Dr. Green?" }
```

#### `POST /ask` → `AgentAnswer`
Request `AskRequest`:
```json
{ "memberId": "margaret", "question": "What was Mom's BP at her last appointment with Dr. Green?",
  "threadId": "thread-margaret" }
```
Response. An answer is a list of typed **blocks** that the app renders in order. The block types are `text`, `big-value`, `bp-reading`, `timeline`, `dose-log`, `list` and `note`.
```json
{
  "id": "ans-1", "memberId": "margaret", "question": "…", "kind": "answer",
  "blocks": [
    { "type": "text", "style": "tint",
      "text": "Quick heads-up: **Dr. Green is Mom's dentist** at Bright Smile Dental, and her chart has no blood pressure from that office.\n\nHer most recent reading was with her GP, **Dr. Yojansen**:" },
    { "type": "bp-reading", "label": "Blood pressure", "reading": { "…": "BpReading" },
      "trendLabel": "Last 3 visits with Dr. Yojansen", "trend": [ "…BpReading×3" ] }
  ],
  "sources": [
    { "recordId": "rec-visit-2026-10-28", "label": "Visit summary · Oct 28" },
    { "recordId": "rec-care-team", "label": "Care team list" }
  ],
  "actions": [
    { "kind": "add-to-prep", "label": "Add to tomorrow's prep", "visitId": "v-okafor",
      "pin": { "kind": "vital", "id": "bp-2026-10-28" }, "style": "primary" },
    { "kind": "show-vitals", "label": "All readings", "vitalType": "bp", "style": "secondary" }
  ],
  "followUps": [
    { "label": "Where were the X-rays taken?", "question": "Where were the X-rays taken, and what did they find?" },
    { "label": "Show to nurse", "action": "show-to-nurse" }
  ]
}
```
- **Out of scope:** questions outside the records return `kind: "out-of-scope"` with one polite text block and no sources.
- **Medical advice:** questions asking for advice should return what the chart says, plus a route to the doctor (FLOW.md guardrail).

#### `GET /drugs/lookup?q={text}` → `DrugMatch` or `null`
```json
{ "id": "ciprofloxacin", "name": "Ciprofloxacin", "strength": "500 mg", "drugClass": "An antibiotic" }
```

#### `POST /members/{memberId}/interaction-checks` → `InteractionCheck` (`202` style)
This starts a check and returns immediately with every item `"pending"`. The real check must run on a licensed drug-interaction database, not on model judgment.

Request `NewMedication`:
```json
{ "name": "Ciprofloxacin 500 mg", "frequency": "Twice a day for 7 days",
  "prescribedBy": "St. Luke's ER team", "reason": "Urinary tract infection" }
```

#### `GET /interaction-checks/{checkId}` → `InteractionCheck`
The app polls this every 600 ms until `status: "complete"`. Items may resolve one by one, and the app animates each row as it resolves.
```json
{
  "id": "chk-1", "memberId": "margaret", "status": "complete",
  "drug": { "name": "Ciprofloxacin", "label": "Ciprofloxacin 500 mg", "drugClass": "An antibiotic" },
  "scopeLine": "Against Mom's 4 medications from 2 doctors, and her allergies",
  "items": [
    { "id": "med-lisinopril", "kind": "medication", "label": "Lisinopril 20 mg", "sublabel": "Dr. Yojansen",
      "result": "clear", "resultLabel": "No major interaction" },
    { "id": "med-warfarin", "kind": "medication", "label": "Warfarin 5 mg", "sublabel": "Dr. Reyes, cardiology",
      "result": "major", "resultLabel": "Major interaction" },
    { "id": "allergy-penicillin", "kind": "allergy", "label": "Penicillin allergy", "sublabel": "From her chart",
      "result": "clear", "resultLabel": "Not a penicillin" }
  ],
  "findings": [{
    "id": "f-1", "severity": "major", "itemId": "med-warfarin", "title": "Ciprofloxacin + Warfarin",
    "summary": "Ciprofloxacin can make warfarin stronger. That raises her chance of bleeding.",
    "sections": [
      { "title": "Why it matters for Mom", "text": "She takes **warfarin 5 mg** every evening …" },
      { "title": "What care teams often do", "text": "Check her INR …" },
      { "title": "Tell a nurse if you notice", "text": "Unusual bruising …" }
    ]
  }],
  "source": { "recordId": "rec-interaction-cipro-warfarin", "label": "drug-interaction database" },
  "disclaimer": "This doesn't replace her care team. Don't stop or change any medicine without asking them."
}
```
`result` values are `pending`, `clear`, `minor`, `moderate` and `major`. Red is reserved for `major` and yellow for `moderate`.

#### `POST /members/{memberId}/visits/{visitId}/prep-sheet` → `PrepSheet`
Request: `{ "pins": [{ "kind": "vital", "id": "bp-2026-10-28" }] }`. Pins are items Sarah chose to add from an answer.
```json
{
  "id": "prep-v-okafor", "memberId": "margaret", "visitId": "v-okafor", "forName": "Margaret",
  "title": "Neurology with Dr. Okafor", "startsAt": "2026-11-12T10:30:00", "location": "Riverside Neurology",
  "sections": [
    { "type": "text", "id": "why", "title": "Why she's going", "text": "First visit for a hand tremor …" },
    { "type": "vital", "id": "pin-bp-2026-10-28", "title": "Latest blood pressure",
      "reading": { "…": "BpReading" }, "clinicianName": "Dr. Yojansen", "pinnedAt": "2026-11-11T19:42:10.000Z" },
    { "type": "medications", "id": "meds", "title": "Current medications · 4",
      "items": [{ "name": "Lisinopril", "strength": "20 mg", "schedule": "every morning",
                  "detail": "Dr. Yojansen · blood pressure" }] },
    { "type": "questions", "id": "questions", "title": "Questions to ask",
      "items": [{ "id": "q-1", "text": "Could any of her current meds be causing the tremor?" }] }
  ],
  "sources": [{ "recordId": "rec-visit-2026-10-28", "label": "Visit summary · Oct 28" }],
  "sourcesFrom": "Mom's MyChart",
  "shareSummary": "Prep for Mom's neurology visit with Dr. Okafor, Thu, Nov 12 at 10:30 AM. …",
  "builtAt": "2026-11-11T19:42:10.000Z"
}
```

#### `POST /members/{memberId}/nurse-card` → `NurseCard`
Request: `{}`. This returns the large-type summary for handing to a clinician.
```json
{
  "memberId": "margaret", "fullName": "Margaret Mitchell", "dateOfBirth": "1948-04-03", "age": 78,
  "sections": [
    { "label": "Allergy", "boxed": true, "lines": [{ "text": "Penicillin (hives)", "size": "xl" }] },
    { "label": "Blood thinner", "lines": [
      { "text": "Warfarin 5 mg every evening", "size": "xl" },
      { "text": "Last dose: Fri, Nov 13, 8:04 PM", "size": "lg" } ] }
  ],
  "sourcesNote": "From Margaret's medical records and hub log",
  "sources": [{ "recordId": "rec-allergies", "label": "Allergies" }]
}
```

#### `POST /members/{memberId}/interaction-checks/{checkId}/follow-up` → `CareTeamFollowUp`
Request: `{}`.
```json
{
  "inPerson": { "heading": "Show the ER doctor now",
    "paragraphs": ["Mom takes **warfarin 5 mg** every evening. Last dose: Fri, Nov 13, 8:04 PM.",
                   "Is ciprofloxacin safe with it, or should her INR be checked?"] },
  "messageHeading": "Let Dr. Reyes know",
  "draft": { "id": "draft-chk-1", "memberId": "margaret",
             "to": { "clinicianId": "dr-reyes", "name": "Dr. Reyes", "role": "Cardiology" },
             "channel": "MyChart", "body": "Hi Dr. Reyes, …", "createdAt": "…", "updatedAt": "…",
             "about": { "kind": "interaction-check", "id": "chk-1" } },
  "familySummary": "Mom was prescribed ciprofloxacin …"
}
```

#### `POST /messages` → `SentMessage`
Request: the `MessageDraft`, as edited by Sarah. **The app only calls this after Sarah confirms in the review sheet.**
```json
{ "id": "msg-1", "sentAt": "2026-11-14T15:12:00.000Z", "status": "sent" }
```

### Calendar

The calendar's dated events come from the app store (Part 2). These two calls add what only the agent knows.

#### `GET /family/calendar-summary?members={id},{id}&from={YYYY-MM-DD}&to={YYYY-MM-DD}` → `CalendarSummary`
The agent's one-line read on the family's health events in the range (the calendar asks for the current week), plus short labels for visits in it.
```json
{ "text": "One visit this week: Mom's neurology appointment tomorrow. Her prep sheet is ready.",
  "visitLabels": [{ "visitId": "v-okafor", "label": "Prep sheet ready" }] }
```

#### `GET /members/{memberId}/visits/{visitId}/readiness` → `VisitReadiness`
What is ready for an upcoming visit ("Ready for this visit") and what the agent will do afterwards. `kind` is `prep-sheet` (opens the prep sheet; `suggestedPins` are passed to it) or `record` (opens `recordId`).
```json
{ "memberId": "margaret", "visitId": "v-okafor",
  "items": [
    { "id": "ready-prep", "kind": "prep-sheet", "title": "Prep sheet",
      "detail": "Latest BP, 4 medications, 3 questions",
      "suggestedPins": [{ "kind": "vital", "id": "bp-2026-10-28" }] },
    { "id": "ready-referral", "kind": "record", "title": "Referral from Dr. Yojansen",
      "detail": "Oct 28 · in Mom's MyChart", "recordId": "rec-referral-neuro" }
  ],
  "afterVisitNote": "After the visit, I'll let you know when Dr. Okafor's notes arrive in Mom's MyChart and explain them in plain words." }
```

---

## Part 2 · App store: Supabase

App data only. No medical records and no agent logic.

The schema, row-level security and the demo seed live in [`supabase/migrations/`](supabase/migrations/); that SQL is the source of truth. Change the database by adding a migration there and running `supabase db push`, then refresh the TypeScript types with `supabase gen types typescript --linked > src/services/live/database.types.ts`.

> **Demo data only.** `prep_sheets.sheet`, `message_drafts.body`, `family_updates.summary` and the text columns of `appointments` hold health details (BP readings, medication names, message text). That is fine for the fictional Mitchell family. Before real people's data goes in, move to a HIPAA-eligible store with a BAA, or store only references (visit id, pins, draft id) and rebuild the content from the Health API. `sheet` and `body` are nullable for that reason.

| Table | Holds |
|---|---|
| `app_users` | One row per signed-in user. `id` is the Auth0 `sub` (text). |
| `families` | "The Mitchells". |
| `family_members` | Everyone in the family, whether or not they use the app. `health_member_id` is the Health API `memberId`. A user has their own row (`app_user_id` set). |
| `family_access` | Who can see a family: `owner`, `editor` or `viewer`. |
| `care_circles` | Who gets updates about whom ("Also update Dad and Mike"). |
| `user_settings` | Large text, share updates by default. |
| `prep_sheets` | One per member and visit: the pins and the sheet snapshot. |
| `question_lists` | One per member and visit: `[{id, text, checked, addedBy}]`. |
| `message_drafts` | Drafts to the care team. `draft_key` is the draft id the Health API gave. |
| `family_updates` | Updates sent to the family about a member. |
| `appointments` | Family calendar: dated health events (visits, refills). |
| `to_book_items` | Things that still need booking ("Flu shot · due this month"). |

**Sign-in.** Supabase trusts the Auth0 sign-in (third-party auth). Every request carries the user's Auth0 ID token, and row-level security reads its `sub` claim through `private.uid()`. Setup: [README.md](README.md#supabase-app-store).

**Row-level security.** It is on for every table. A user can read rows only for families they appear in through `family_access`, and writes need `owner` or `editor`. The publishable key is public by design and on its own reads nothing, so RLS is the real protection.

**Demo seed.** `bootstrap_demo_family()` runs when a user first opens the app and gives them their own copy of the Mitchell family, with the user as Sarah. It mirrors `mock/fixtures/app.ts` and does nothing on later calls. Remove it before real users sign up.

**Ids.** Rows have uuid ids. Screens pass the Health API member id (the `/m/:memberId` route) to the prep sheet, question list and draft methods, so `SupabaseAppStore` accepts either a `family_members.id` or a `health_member_id` wherever a method takes a member id.

**Mapping to `AppStore` methods**

| Method | Table(s) |
|---|---|
| `getCurrentUser()` | `app_users` (the row whose id is the token's `sub`) |
| `getFamily()` | `families` + `family_members` + `care_circles` via `family_access` |
| `getSettings()` / `updateSettings()` | `user_settings` |
| `getPrepSheet()` / `savePrepSheet()` | `prep_sheets` |
| `getQuestionList()` / `saveQuestionList()` | `question_lists` |
| `listDrafts()` / `saveDraft()` | `message_drafts` |
| `createFamilyUpdate()` | `family_updates` (push notifications should say only "New update about Mom", never health details) |
| `listAppointments(familyId, { from, to })` | `appointments` where `starts_on` is between `from` and `to` (both inclusive), ordered by `starts_at`, then `starts_on` |
| `getAppointment(id)` | `appointments` by id; `null` when it doesn't exist |
| `listToBookItems(familyId)` | `to_book_items` where `booked_appointment_id is null`, ordered by `due_by` |
| `setAppointmentEscort(id, escortId)` | update `appointments.escort_member_id` (and `updated_at`); returns the updated row |

**Not stored anywhere yet.** Ask conversations are kept in the browser session only (`sessionStorage`). Add an `ask_threads` table if you want them to persist; it would hold PHI.

**Calendar notes**

- `Appointment.escortId` is the signed-in user's id or a family member's id. In Supabase the user has their own `family_members` row (`app_user_id` set), so `escort_member_id` covers both. Map it back to the user's id when it is their row.
- `Appointment.escortOptions` is not a column: for a visit it is the signed-in user plus the member's `care_circles` rows, and for a refill it is empty.
- Appointment titles, places and notes are health details ("Neurology with Dr. Okafor"), so the decision at the top of this part applies to these two tables as well. To keep PHI out of Supabase, store only `health_visit_id` and read the title and place from the Health API.
- The agent's week summary, the "Prep sheet ready" label and "Ready for this visit" come from the Health API (Part 1, Calendar), never from these tables.
- "Today" for the calendar comes from the shared `Clock` service: the demo scene's date in mock mode, the real date when the Health API is live.

