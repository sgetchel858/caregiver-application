# Casanté demo: data contracts

The app talks to two backends through typed interfaces. Screens never know which implementation they get.

| Service | Interface | Mock (default) | Real |
|---|---|---|---|
| Health API: medical information + agent | `src/services/HealthApi.ts` | `src/services/mock/MockHealthApi.ts` (fixtures in `mock/fixtures/health.ts`, scripted answers in `mock/scriptedAnswers.ts`) | `src/services/live/LiveHealthApi.ts` (fetch client, ready) |
| App store: app data only | `src/services/AppStore.ts` | `src/services/mock/MockAppStore.ts` (localStorage, seeded from `mock/fixtures/app.ts`) | `src/services/live/SupabaseAppStore.ts` (stub) |

Switch with env vars at build time (`.env.local` locally, workflow `env:` in CI):

```
VITE_HEALTH_API=mock | live        # live also needs VITE_HEALTH_API_URL
VITE_APP_STORE=mock | supabase     # supabase also needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
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
- **Auth:** not wired. Add a short-lived bearer token in `LiveHealthApi.request()` when you have one. Never put a static secret in a `VITE_*` variable: the bundle is public.
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

---

## Part 2 · App store: suggested Supabase layout

App data only. No medical records and no agent logic.

> **One decision to make before going live:** prep sheets, message drafts and family updates contain health details (BP readings, medication names, message text). Either:
> 1. Store only **references** in Supabase (visit id, pins, checked questions, draft id) and rebuild the content from the Health API when opened. This is recommended and keeps PHI in one place. Or:
> 2. Store snapshots, as the mock does today. Then the Supabase project must be on a HIPAA-eligible plan with a BAA, and the tables below hold PHI.
>
> The tables below support either option: `sheet` and `body` are nullable for option 1.

```sql
-- One row per signed-in user (id = auth.users.id)
create table app_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  initials      text not null,
  avatar_color  text not null default '#A5D7C7',
  created_at    timestamptz not null default now()
);

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                   -- "The Mitchells"
  created_by  uuid not null references app_users(id),
  created_at  timestamptz not null default now()
);

-- Everyone in the family, whether or not they use the app
create table family_members (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id) on delete cascade,
  app_user_id       uuid references app_users(id),   -- null for Mom, the kids, …
  health_member_id  text,                            -- Health API memberId, null if not connected
  first_name        text not null,
  relation          text not null,                   -- how the owner refers to them: "Mom"
  user_is           text not null,                   -- how they refer to the owner: "daughter"
  birth_year        int,
  initials          text not null,
  avatar_color      text not null,
  sort_order        int not null default 0
);

-- Who can see the family (owner, spouse, siblings…)
create table family_access (
  family_id    uuid references families(id) on delete cascade,
  app_user_id  uuid references app_users(id) on delete cascade,
  role         text not null check (role in ('owner','editor','viewer')),
  primary key (family_id, app_user_id)
);

-- Who gets updates about whom ("Also update Dad and Mike")
create table care_circles (
  about_member_id   uuid references family_members(id) on delete cascade,
  notify_member_id  uuid references family_members(id) on delete cascade,
  primary key (about_member_id, notify_member_id)
);

create table user_settings (
  app_user_id               uuid primary key references app_users(id) on delete cascade,
  large_text                boolean not null default false,
  share_updates_by_default  boolean not null default true
);

create table prep_sheets (
  id                uuid primary key default gen_random_uuid(),
  family_member_id  uuid not null references family_members(id) on delete cascade,
  visit_id          text not null,                 -- Health API visit id
  pins              jsonb not null default '[]',   -- [{kind:"vital", id, pinnedAt}]
  sheet             jsonb,                         -- PrepSheet snapshot (option 2 only)
  saved_by          uuid not null references app_users(id),
  saved_at          timestamptz not null default now(),
  unique (family_member_id, visit_id)
);

create table question_lists (
  family_member_id  uuid references family_members(id) on delete cascade,
  visit_id          text,
  items             jsonb not null,               -- [{id, text, checked, addedBy}]
  updated_at        timestamptz not null default now(),
  primary key (family_member_id, visit_id)
);

create table message_drafts (
  id                uuid primary key default gen_random_uuid(),
  family_member_id  uuid not null references family_members(id) on delete cascade,
  to_clinician_id   text not null,
  to_name           text not null,
  to_role           text not null,
  channel           text not null default 'MyChart',
  body              text,                          -- option 2 only
  about_kind        text,                          -- 'interaction-check'
  about_id          text,
  sent_message_id   text,                          -- set after POST /messages succeeds
  created_by        uuid not null references app_users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table family_updates (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families(id) on delete cascade,
  from_user_id     uuid not null references app_users(id),
  about_member_id  uuid not null references family_members(id),
  to_member_ids    uuid[] not null,
  summary          text not null,
  ref_kind         text not null check (ref_kind in ('prep-sheet','message','interaction-check')),
  ref_id           text not null,
  created_at       timestamptz not null default now()
);
```

**Row-level security.** Turn it on for every table. A user can read and write rows only for families they appear in through `family_access`, with writes needing `owner` or `editor`. The anon key is public by design, so RLS is the real protection.

**Mapping to `AppStore` methods**

| Method | Table(s) |
|---|---|
| `getCurrentUser()` | `app_users` (current `auth.uid()`) |
| `getFamily()` | `families` + `family_members` + `care_circles` via `family_access` |
| `getSettings()` / `updateSettings()` | `user_settings` |
| `getPrepSheet()` / `savePrepSheet()` | `prep_sheets` |
| `getQuestionList()` / `saveQuestionList()` | `question_lists` |
| `listDrafts()` / `saveDraft()` | `message_drafts` |
| `createFamilyUpdate()` | `family_updates` (push notifications should say only "New update about Mom", never health details) |

**Not stored anywhere yet.** Ask conversations are kept in the browser session only (`sessionStorage`). Add an `ask_threads` table if you want them to persist; it would hold PHI.
