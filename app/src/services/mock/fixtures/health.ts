/**
 * Health API fixtures: the demo data from FLOW.md. Only Margaret (Mom) has
 * full records. Record excerpts are written for the demo and are not real.
 */
import type {
  Allergy,
  BpReading,
  Clinician,
  DrugMatch,
  MemberProfile,
  Medication,
  NewMedication,
  RecordDetail,
  Visit,
  VisitReadinessItem,
} from '../../types'
import type { SceneId } from '../../demo/demoState'

export const MARGARET = 'margaret'

export const profiles: Record<string, MemberProfile> = {
  [MARGARET]: {
    memberId: MARGARET,
    fullName: 'Margaret Mitchell',
    firstName: 'Margaret',
    dateOfBirth: '1948-04-03',
    age: 78,
    primaryClinicianId: 'dr-yojansen',
    allergies: [{ substance: 'Penicillin', reaction: 'hives' }] satisfies Allergy[],
    connection: { source: 'MyChart', healthSystems: 2, updatedAt: '2026-11-11T18:12:00' },
  },
}

export const careTeam: Record<string, Clinician[]> = {
  [MARGARET]: [
    { id: 'dr-yojansen', name: 'Dr. Yojansen', role: 'GP', practice: 'Riverside Primary Care', phone: '(555) 014-2290' },
    { id: 'dr-okafor', name: 'Dr. Okafor', role: 'Neurology', practice: 'Riverside Neurology' },
    { id: 'dr-reyes', name: 'Dr. Reyes', role: 'Cardiology', practice: 'Riverside Heart Center' },
    { id: 'dr-green', name: 'Dr. Green', role: 'Dentist', practice: 'Bright Smile Dental' },
  ],
}

export const medications: Record<string, Medication[]> = {
  [MARGARET]: [
    { id: 'med-lisinopril', name: 'Lisinopril', strength: '20 mg', schedule: 'every morning', scheduleShort: 'morning', prescriberId: 'dr-yojansen', purpose: 'blood pressure' },
    { id: 'med-levothyroxine', name: 'Levothyroxine', strength: '50 mcg', schedule: 'every morning', scheduleShort: 'morning', prescriberId: 'dr-yojansen', purpose: 'thyroid' },
    { id: 'med-atorvastatin', name: 'Atorvastatin', strength: '40 mg', schedule: 'every night', scheduleShort: 'night', prescriberId: 'dr-yojansen', purpose: 'cholesterol' },
    {
      id: 'med-warfarin',
      name: 'Warfarin',
      strength: '5 mg',
      schedule: 'every evening',
      scheduleShort: 'evening',
      prescriberId: 'dr-reyes',
      purpose: 'blood thinner',
      lastDose: { takenAt: '2026-11-13T20:04:00', source: 'kitchen-hub' },
      lastRefill: { date: '2026-10-30', pharmacy: 'Main Street Pharmacy' },
    },
  ],
}

/** evening warfarin doses logged on the kitchen hub, Sat Nov 7 to Fri Nov 13 */
export const hubDoseLog: { date: string; takenAt: string | null }[] = [
  { date: '2026-11-07', takenAt: '2026-11-07T20:01:00' },
  { date: '2026-11-08', takenAt: '2026-11-08T19:58:00' },
  { date: '2026-11-09', takenAt: '2026-11-09T20:10:00' },
  { date: '2026-11-10', takenAt: '2026-11-10T20:03:00' },
  { date: '2026-11-11', takenAt: '2026-11-11T20:06:00' },
  { date: '2026-11-12', takenAt: '2026-11-12T19:55:00' },
  { date: '2026-11-13', takenAt: '2026-11-13T20:04:00' },
]

export const visits: Record<string, Visit[]> = {
  [MARGARET]: [
    { id: 'v-2026-04-02', clinicianId: 'dr-yojansen', startsAt: '2026-04-02T09:00:00', location: 'Riverside Primary Care', reason: 'Check-up' },
    { id: 'v-2026-07-14', clinicianId: 'dr-yojansen', startsAt: '2026-07-14T14:15:00', location: 'Riverside Primary Care', reason: 'Blood pressure follow-up' },
    { id: 'v-2026-09-09', clinicianId: 'dr-green', startsAt: '2026-09-09T11:00:00', location: 'Bright Smile Dental', reason: 'Cleaning' },
    { id: 'v-2026-10-28', clinicianId: 'dr-yojansen', startsAt: '2026-10-28T10:00:00', location: 'Riverside Primary Care', reason: 'Check-up' },
    {
      id: 'v-okafor',
      clinicianId: 'dr-okafor',
      startsAt: '2026-11-12T10:30:00',
      location: 'Riverside Neurology',
      reason: 'Hand tremor',
      referredById: 'dr-yojansen',
      referredOn: '2026-10-28',
    },
  ],
}

export const bpReadings: Record<string, BpReading[]> = {
  [MARGARET]: [
    { id: 'bp-2026-04-02', type: 'bp', systolic: 122, diastolic: 84, unit: 'mmHg', takenAt: '2026-04-02T09:12:00', clinicianId: 'dr-yojansen', facility: 'Riverside Primary Care', recordId: 'rec-visit-2026-04-02' },
    { id: 'bp-2026-07-14', type: 'bp', systolic: 118, diastolic: 82, unit: 'mmHg', takenAt: '2026-07-14T14:24:00', clinicianId: 'dr-yojansen', facility: 'Riverside Primary Care', recordId: 'rec-visit-2026-07-14' },
    { id: 'bp-2026-10-28', type: 'bp', systolic: 110, diastolic: 86, unit: 'mmHg', takenAt: '2026-10-28T10:09:00', clinicianId: 'dr-yojansen', facility: 'Riverside Primary Care', recordId: 'rec-visit-2026-10-28' },
  ],
}

export const injuryHistory: Record<string, { summary: string; detail: string }[]> = {
  [MARGARET]: [{ summary: 'Right ankle fracture, Mar 14, 2019', detail: "X-rays at St. Luke's ER · healed by May 2019" }],
}

/** active encounter per scene (Moment 2 and 3 happen at St. Luke's ER) */
export const encounters: Record<SceneId, { facility: string; startedAt: string; newOrders: NewMedication[] } | null> = {
  m1: null,
  m2: { facility: "St. Luke's Medical Center", startedAt: '2026-11-14T11:20:00', newOrders: [] },
  m3: {
    facility: "St. Luke's Medical Center",
    startedAt: '2026-11-14T11:20:00',
    newOrders: [
      { name: 'Ciprofloxacin 500 mg', frequency: 'Twice a day for 7 days', prescribedBy: "St. Luke's ER team", reason: 'Urinary tract infection' },
    ],
  },
}

export const records: Record<string, RecordDetail> = {
  'rec-visit-2026-10-28': {
    id: 'rec-visit-2026-10-28', kind: 'visit-summary', title: 'Visit summary', date: '2026-10-28', facility: 'Riverside Primary Care', author: 'Dr. Yojansen',
    excerpt: 'Vitals: BP 110/86 mmHg, pulse 72, weight 141 lb. Patient reports a slight shake in her right hand over the past two months, worse when holding a cup. Mild resting tremor of the right hand noted on exam. Plan: refer to neurology (Dr. Okafor). Continue current medications.',
    highlight: 'BP 110/86 mmHg',
  },
  'rec-visit-2026-07-14': {
    id: 'rec-visit-2026-07-14', kind: 'visit-summary', title: 'Visit summary', date: '2026-07-14', facility: 'Riverside Primary Care', author: 'Dr. Yojansen',
    excerpt: 'Blood pressure follow-up. Vitals: BP 118/82 mmHg, pulse 70. Doing well on lisinopril 20 mg. No changes.',
    highlight: 'BP 118/82 mmHg',
  },
  'rec-visit-2026-04-02': {
    id: 'rec-visit-2026-04-02', kind: 'visit-summary', title: 'Visit summary', date: '2026-04-02', facility: 'Riverside Primary Care', author: 'Dr. Yojansen',
    excerpt: 'Annual check-up. Vitals: BP 122/84 mmHg, pulse 74. Labs ordered: lipid panel, TSH.',
    highlight: 'BP 122/84 mmHg',
  },
  'rec-care-team': {
    id: 'rec-care-team', kind: 'care-team', title: 'Care team list', date: '2026-11-11', facility: 'MyChart',
    excerpt: 'Dr. Yojansen, primary care, Riverside Primary Care. Dr. Okafor, neurology, Riverside Neurology. Dr. Reyes, cardiology, Riverside Heart Center. Dr. Green, dentist, Bright Smile Dental.',
    highlight: 'Dr. Green, dentist, Bright Smile Dental',
  },
  'rec-referral-neuro': {
    id: 'rec-referral-neuro', kind: 'referral', title: 'Referral to neurology', date: '2026-10-28', facility: 'Riverside Primary Care', author: 'Dr. Yojansen',
    excerpt: 'Referral to Dr. Okafor, Riverside Neurology. Reason: new resting tremor, right hand. Please evaluate.',
    highlight: 'new resting tremor, right hand',
  },
  'rec-appt-okafor': {
    id: 'rec-appt-okafor', kind: 'appointment', title: 'Appointment', date: '2026-11-12', facility: 'Riverside Neurology',
    excerpt: 'New patient visit with Dr. Okafor. Thursday, November 12, 2026 at 10:30 AM. Please arrive 15 minutes early and bring a list of your medications.',
    highlight: 'Thursday, November 12, 2026 at 10:30 AM',
  },
  'rec-med-list': {
    id: 'rec-med-list', kind: 'medication-list', title: 'Medication list', date: '2026-10-28', facility: 'MyChart',
    excerpt: 'Lisinopril 20 mg every morning. Levothyroxine 50 mcg every morning. Atorvastatin 40 mg every night. Warfarin 5 mg every evening.',
  },
  'rec-rx-warfarin': {
    id: 'rec-rx-warfarin', kind: 'prescription', title: 'Prescription · Dr. Reyes', date: '2026-10-30', facility: 'Riverside Heart Center', author: 'Dr. Reyes',
    excerpt: 'Warfarin 5 mg tablet. Take 1 tablet by mouth every evening. Last refill filled Oct 30, 2026 at Main Street Pharmacy.',
    highlight: 'Take 1 tablet by mouth every evening',
  },
  'rec-hub-log': {
    id: 'rec-hub-log', kind: 'hub-log', title: 'Hub dose log', date: '2026-11-13', facility: "Mom's kitchen hub",
    excerpt: 'Warfarin 5 mg, evening dose. Confirmed taken: Sat 8:01 PM, Sun 7:58 PM, Mon 8:10 PM, Tue 8:03 PM, Wed 8:06 PM, Thu 7:55 PM, Fri 8:04 PM.',
    highlight: 'Fri 8:04 PM',
  },
  'rec-er-2019-03-14': {
    id: 'rec-er-2019-03-14', kind: 'er-note', title: 'ER visit note', date: '2019-03-14', facility: "St. Luke's Medical Center",
    excerpt: 'Seen after a fall at home with pain and swelling of the right ankle. X-ray shows a non-displaced fracture of the right lateral malleolus. Walking boot applied. Follow-up X-ray in 6 to 8 weeks.',
    highlight: 'non-displaced fracture of the right lateral malleolus',
  },
  'rec-rad-2019-03-14': {
    id: 'rec-rad-2019-03-14', kind: 'radiology', title: 'Radiology report', date: '2019-03-14', facility: "St. Luke's Medical Center",
    excerpt: 'Right ankle, 3 views. Impression: Non-displaced fracture of the right lateral malleolus. Ankle joint is aligned.',
    highlight: 'Non-displaced fracture of the right lateral malleolus.',
  },
  'rec-rad-2019-05-02': {
    id: 'rec-rad-2019-05-02', kind: 'radiology', title: 'Radiology report', date: '2019-05-02', facility: 'Valley Imaging Center',
    excerpt: 'Right ankle, follow-up. Impression: Healed fracture of the right lateral malleolus. No new findings.',
    highlight: 'Healed fracture',
  },
  'rec-allergies': {
    id: 'rec-allergies', kind: 'medication-list', title: 'Allergies', date: '2026-10-28', facility: 'MyChart',
    excerpt: 'Penicillin: hives.',
    highlight: 'Penicillin: hives.',
  },
  'rec-interaction-cipro-warfarin': {
    id: 'rec-interaction-cipro-warfarin', kind: 'interaction-db', title: 'Drug-interaction database', date: '2026-11-14', facility: 'Licensed drug-interaction database',
    excerpt: 'Ciprofloxacin + warfarin. Severity: major. Ciprofloxacin may increase the effect of warfarin and the risk of bleeding. Monitor INR closely when starting or stopping ciprofloxacin; a warfarin dose change or another antibiotic may be needed.',
    highlight: 'Severity: major.',
  },
}

/** designed content for visit prep (the agent's suggested wording) */
export const prepContent: Record<string, { why: string; questions: string[]; sourceIds: string[] }> = {
  'v-okafor': {
    why: 'First visit for a hand tremor. Dr. Yojansen noted it in her right hand on Oct 28 and referred her.',
    questions: [
      'Could any of her current meds be causing the tremor?',
      'Is it still safe for her to drive?',
      'What changes should we watch for at home?',
    ],
    sourceIds: [
      'rec-visit-2026-10-28',
      'rec-referral-neuro',
      'rec-appt-okafor',
      'rec-med-list',
      'rec-rx-warfarin',
      'rec-visit-2026-07-14',
      'rec-visit-2026-04-02',
    ],
  },
}

/** family home: one agent line per person, per scene */
export const briefings: Record<SceneId, { nudges: { memberId: string; text: string }[]; statuses: Record<string, string> }> = {
  m1: {
    nudges: [{ memberId: MARGARET, text: 'Mom sees **Dr. Okafor** (neurology) tomorrow at 10:30 AM. Want help getting ready?' }],
    statuses: {
      margaret: 'Neurology tomorrow, 10:30 AM',
      robert: 'All caught up',
      mike: 'Flu shot due this month',
      emma: 'Physical Dec 3',
      leo: 'All caught up',
    },
  },
  m2: {
    nudges: [{ memberId: MARGARET, text: "Mom is at **St. Luke's ER**. Her records are ready if the care team has questions." }],
    statuses: {
      margaret: "At St. Luke's ER now",
      robert: 'All caught up',
      mike: 'Flu shot due this month',
      emma: 'Physical Dec 3',
      leo: 'All caught up',
    },
  },
  m3: {
    nudges: [{ memberId: MARGARET, text: "Mom has a **new prescription** from St. Luke's ER. Check it against her meds?" }],
    statuses: {
      margaret: 'New prescription today',
      robert: 'All caught up',
      mike: 'Flu shot due this month',
      emma: 'Physical Dec 3',
      leo: 'All caught up',
    },
  },
}

export const askSuggestions: Record<SceneId, { prompts: string[]; prefill?: string }> = {
  m1: {
    prompts: ['What meds is Mom on?', "Who's her cardiologist?"],
    prefill: "What was Mom's BP at her last appointment with Dr. Green?",
  },
  m2: { prompts: ['What meds is Mom on?'], prefill: 'What year did Mom break her ankle?' },
  m3: { prompts: ['What meds is Mom on?'] },
}

/** a tiny stand-in for a licensed drug database */
export const drugs: (DrugMatch & { aliases: string[]; isPenicillin: boolean })[] = [
  { id: 'ciprofloxacin', name: 'Ciprofloxacin', strength: '500 mg', drugClass: 'An antibiotic', aliases: ['cipro', 'ciprofloxacin'], isPenicillin: false },
  { id: 'amoxicillin', name: 'Amoxicillin', strength: '500 mg', drugClass: 'A penicillin antibiotic', aliases: ['amoxicillin', 'amoxil'], isPenicillin: true },
  { id: 'acetaminophen', name: 'Acetaminophen', strength: '500 mg', drugClass: 'A pain reliever', aliases: ['acetaminophen', 'tylenol', 'paracetamol'], isPenicillin: false },
  { id: 'nitrofurantoin', name: 'Nitrofurantoin', strength: '100 mg', drugClass: 'An antibiotic', aliases: ['nitrofurantoin', 'macrobid'], isPenicillin: false },
]

/** interaction table: drugId + medication id */
export const interactionTable: {
  drugId: string
  medicationId: string
  severity: 'major'
  title: string
  summary: string
  sections: { title: string; text: string }[]
  recordId: string
}[] = [
  {
    drugId: 'ciprofloxacin',
    medicationId: 'med-warfarin',
    severity: 'major',
    title: 'Ciprofloxacin + Warfarin',
    summary: 'Ciprofloxacin can make warfarin stronger. That raises her chance of bleeding.',
    sections: [
      {
        title: 'Why it matters for Mom',
        text: 'She takes **warfarin 5 mg** every evening, prescribed by Dr. Reyes (cardiology). Her last dose was Fri, Nov 13 at 8:04 PM.',
      },
      {
        title: 'What care teams often do',
        text: 'Check her INR (a blood test for clotting) sooner and more often, adjust the warfarin dose, or choose a different antibiotic.',
      },
      { title: 'Tell a nurse if you notice', text: 'Unusual bruising, bleeding gums, or blood in her urine or stool.' },
    ],
    recordId: 'rec-interaction-cipro-warfarin',
  },
]

/** designed wording for the care-team follow-up in Moment 3 */
export const followUpContent: Record<string, { inPerson: string[]; body: string; familySummary: string; toClinicianId: string }> = {
  'ciprofloxacin:med-warfarin': {
    toClinicianId: 'dr-reyes',
    inPerson: [
      'Mom takes **warfarin 5 mg** every evening. Last dose: Fri, Nov 13, 8:04 PM.',
      'Is ciprofloxacin safe with it, or should her INR be checked?',
    ],
    body: "Hi Dr. Reyes, Mom was seen at St. Luke's ER today and prescribed ciprofloxacin 500 mg twice a day for 7 days. She takes warfarin 5 mg every evening. Should her INR be checked this week? Thank you, Sarah (Margaret's daughter)",
    familySummary:
      "Mom was prescribed ciprofloxacin (an antibiotic) at St. Luke's ER today. It can make her warfarin stronger, so Sarah asked Dr. Reyes whether her INR should be checked this week.",
  },
}

/* ---- calendar ---- */

/** the agent's one-line week summary on the calendar tab, per scene */
export const calendarSummaries: Record<SceneId, { text: string; visitLabels: { visitId: string; label: string }[] }> = {
  m1: {
    text: "One visit this week: Mom's neurology appointment tomorrow. Her prep sheet is ready.",
    visitLabels: [{ visitId: 'v-okafor', label: 'Prep sheet ready' }],
  },
  m2: {
    text: "No more visits this week. Mom is at St. Luke's ER today; her warfarin refill is due Nov 29.",
    visitLabels: [],
  },
  m3: {
    text: "No more visits this week. Mom is at St. Luke's ER today; her warfarin refill is due Nov 29.",
    visitLabels: [],
  },
}

/** what is ready for a visit, by Health API visit id */
export const visitReadiness: Record<string, { items: VisitReadinessItem[]; afterVisitNote: string }> = {
  'v-okafor': {
    items: [
      {
        id: 'ready-prep',
        kind: 'prep-sheet',
        title: 'Prep sheet',
        detail: 'Latest BP, 4 medications, 3 questions',
        suggestedPins: [{ kind: 'vital', id: 'bp-2026-10-28' }],
      },
      {
        id: 'ready-referral',
        kind: 'record',
        title: 'Referral from Dr. Yojansen',
        detail: "Oct 28 · in Mom's MyChart",
        recordId: 'rec-referral-neuro',
      },
    ],
    afterVisitNote: "After the visit, I'll let you know when Dr. Okafor's notes arrive in Mom's MyChart and explain them in plain words.",
  },
}
