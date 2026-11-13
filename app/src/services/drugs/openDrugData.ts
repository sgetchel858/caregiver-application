/**
 * Public drug data, called straight from the browser (both APIs allow CORS, no key needed):
 *
 *   RxNorm (NLM RxNav)  normalizes what was typed ("cipro 500", "Tylenol") to an ingredient,
 *                       its brand names and its FDA drug class.
 *                       https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
 *   openFDA drug label  the FDA-approved label for that ingredient, whose interaction,
 *                       warning and contraindication sections are searched for the other drug.
 *                       https://open.fda.gov/apis/drug/label/
 *
 * openFDA allows 1,000 requests a day per IP without a key; set VITE_OPENFDA_API_KEY for more.
 */

const RXNAV = 'https://rxnav.nlm.nih.gov/REST'
const OPENFDA = 'https://api.fda.gov/drug/label.json'

export interface NormalizedDrug {
  /** RxNorm ingredient concept id */
  rxcui: string
  /** ingredient, lower case, e.g. "ciprofloxacin" (several for a combination product) */
  ingredients: string[]
  /** display name, e.g. "Ciprofloxacin" or "Acetaminophen / Hydrocodone" */
  name: string
  /** brand names RxNorm knows for the ingredient, e.g. ["Cipro"] */
  brands: string[]
  /** FDA established pharmacologic classes, e.g. ["Fluoroquinolone Antibacterial"] */
  classes: string[]
}

/** The label sections that can name another drug, strongest first. */
export const LABEL_SECTIONS = [
  'boxed_warning',
  'contraindications',
  'do_not_use',
  'warnings_and_cautions',
  'warnings',
  'drug_interactions',
  'ask_doctor_or_pharmacist',
] as const
export type LabelSection = (typeof LABEL_SECTIONS)[number]

export const SECTION_TITLES: Record<LabelSection, string> = {
  boxed_warning: 'Boxed warning',
  contraindications: 'Contraindications',
  do_not_use: 'Do not use',
  warnings_and_cautions: 'Warnings and precautions',
  warnings: 'Warnings',
  drug_interactions: 'Drug interactions',
  ask_doctor_or_pharmacist: 'Ask a doctor or pharmacist',
}

export interface DrugLabel {
  setId: string
  /** e.g. "CIPROFLOXACIN HYDROCHLORIDE" */
  genericName: string
  brandName?: string
  manufacturer?: string
  /** YYYY-MM-DD */
  effectiveDate: string
  sections: Partial<Record<LabelSection, string>>
}

/** A passage on one drug's label that names the other drug. */
export interface LabelMention {
  /** whose label it is */
  labelOf: string
  label: DrugLabel
  section: LabelSection
  /** the matched term, e.g. "warfarin" */
  term: string
  /** the sentence(s) around it */
  passage: string
  severity: 'major' | 'moderate'
}

export class DrugDataError extends Error {}

/* ---------------- fetch with caching ---------------- */

const cache = new Map<string, Promise<unknown>>()

async function getJson<T>(url: string, opts: { notFoundOk?: boolean } = {}): Promise<T | null> {
  const hit = cache.get(url)
  if (hit) return hit as Promise<T | null>
  const p = (async () => {
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      throw new DrugDataError("Couldn't reach the drug database. Check the connection and try again.")
    }
    if (res.status === 404 && opts.notFoundOk) return null
    if (res.status === 429) throw new DrugDataError('The FDA drug database is busy. Try again in a minute.')
    if (!res.ok) throw new DrugDataError(`The drug database answered ${res.status}.`)
    return (await res.json()) as T
  })()
  cache.set(url, p)
  p.catch(() => cache.delete(url))
  return p
}

const q = encodeURIComponent

/* ---------------- RxNorm ---------------- */

interface RxConcept {
  rxcui: string
  name: string
  tty: string
}

async function related(rxcui: string, ttys: string): Promise<RxConcept[]> {
  const d = await getJson<{ relatedGroup?: { conceptGroup?: { tty: string; conceptProperties?: RxConcept[] }[] } }>(
    `${RXNAV}/rxcui/${q(rxcui)}/related.json?tty=${ttys.replace(/,/g, '+')}`,
  )
  return (d?.relatedGroup?.conceptGroup ?? []).flatMap((g) => g.conceptProperties ?? [])
}

async function rxcuiProperties(rxcui: string): Promise<RxConcept | null> {
  const d = await getJson<{ properties?: RxConcept }>(`${RXNAV}/rxcui/${q(rxcui)}/properties.json`)
  return d?.properties ?? null
}

async function epcClasses(ingredientRxcui: string): Promise<string[]> {
  const d = await getJson<{
    rxclassDrugInfoList?: { rxclassDrugInfo?: { rxclassMinConceptItem: { className: string } }[] }
  }>(`${RXNAV}/rxclass/class/byRxcui.json?rxcui=${q(ingredientRxcui)}&relaSource=FDASPL&relas=has_EPC`)
  const names = (d?.rxclassDrugInfoList?.rxclassDrugInfo ?? []).map((i) => i.rxclassMinConceptItem.className)
  return [...new Set(names)]
}

/** best RxNorm concept for free text; null when nothing plausible */
async function approximate(term: string): Promise<string | null> {
  const d = await getJson<{ approximateGroup?: { candidate?: { rxcui: string; score: string; source: string }[] } }>(
    `${RXNAV}/approximateTerm.json?term=${q(term)}&maxEntries=8&option=1`,
  )
  const c = d?.approximateGroup?.candidate ?? []
  const best = c.find((x) => x.source === 'RXNORM') ?? c[0]
  return best ? best.rxcui : null
}

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase())

/**
 * Normalize typed text ("Cipro 500 mg", "tylenol", "ciproflaxin") to its ingredient(s).
 * Returns null when RxNorm has nothing that looks like a drug.
 */
export async function normalizeDrug(text: string): Promise<NormalizedDrug | null> {
  const typed = text.trim()
  if (!typed) return null
  // Strip strengths and dose forms so "cipro 500 mg twice a day" still finds Cipro.
  const core = typed
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|units?|iu|%)\b.*$/i, '')
    .replace(/\b(tabs?|tablets?|caps?|capsules?|pills?|oral|solution|suspension|er|xr|sr|dr)\b/gi, '')
    .trim()
  let rxcui = (await approximate(typed)) ?? (core && core !== typed ? await approximate(core) : null)
  if (!rxcui) {
    const s = await getJson<{ suggestionGroup?: { suggestionList?: { suggestion?: string[] } } }>(
      `${RXNAV}/spellingsuggestions.json?name=${q(core || typed)}`,
    )
    const suggestion = s?.suggestionGroup?.suggestionList?.suggestion?.[0]
    if (suggestion) rxcui = await approximate(suggestion)
  }
  if (!rxcui) return null

  const props = await rxcuiProperties(rxcui)
  let ingredients: RxConcept[]
  if (props?.tty === 'IN') ingredients = [props]
  else {
    const rel = await related(rxcui, 'IN,MIN')
    ingredients = rel.filter((c) => c.tty === 'IN')
    if (!ingredients.length) {
      // a multi-ingredient concept: take the ingredients of its MIN
      const min = rel.find((c) => c.tty === 'MIN')
      if (min) ingredients = (await related(min.rxcui, 'IN')).filter((c) => c.tty === 'IN')
    }
  }
  if (!ingredients.length) return null
  ingredients.sort((a, b) => a.name.localeCompare(b.name))

  const primary = ingredients[0]
  const [brandConcepts, classes] = await Promise.all([
    Promise.all(ingredients.map((i) => related(i.rxcui, 'BN'))).then((r) => r.flat()),
    Promise.all(ingredients.map((i) => epcClasses(i.rxcui))).then((r) => [...new Set(r.flat())]),
  ])
  return {
    rxcui: ingredients.length === 1 ? primary.rxcui : rxcui,
    ingredients: ingredients.map((i) => i.name.toLowerCase()),
    name: ingredients.map((i) => titleCase(i.name)).join(' / '),
    brands: [...new Set(brandConcepts.map((b) => b.name))],
    classes,
  }
}

/* ---------------- openFDA labels ---------------- */

interface FdaLabelResult {
  set_id: string
  effective_time?: string
  openfda?: { generic_name?: string[]; brand_name?: string[]; manufacturer_name?: string[]; route?: string[]; substance_name?: string[] }
  [section: string]: unknown
}

function withKey(url: string) {
  const key = import.meta.env?.VITE_OPENFDA_API_KEY
  return key ? `${url}&api_key=${q(key)}` : url
}

/** openFDA label section text is an array of strings (sometimes with HTML tables) */
function sectionText(raw: unknown): string | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined
  return raw
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelScore(r: FdaLabelResult, ingredients: string[]) {
  const generic = (r.openfda?.generic_name?.[0] ?? '').toLowerCase()
  const substances = r.openfda?.substance_name ?? []
  let s = 0
  if (ingredients.every((i) => generic.includes(i))) s += 4
  if (substances.length === ingredients.length) s += 4 // not a combination product
  if (r.openfda?.route?.includes('ORAL')) s += 2
  if (r.drug_interactions || r.ask_doctor_or_pharmacist) s += 3
  return s
}

/** The newest best-matching FDA label for the ingredient(s), or null if openFDA has none. */
export async function fetchLabel(drug: NormalizedDrug): Promise<DrugLabel | null> {
  const field = (f: string) => drug.ingredients.map((i) => `${f}:"${i}"`).join('+AND+')
  let results: FdaLabelResult[] = []
  for (const search of [field('openfda.generic_name'), field('openfda.substance_name')]) {
    const d = await getJson<{ results?: FdaLabelResult[] }>(
      withKey(`${OPENFDA}?search=${search.replace(/"/g, '%22')}&sort=effective_time:desc&limit=25`),
      { notFoundOk: true },
    )
    results = d?.results ?? []
    if (results.length) break
  }
  if (!results.length) return null
  const best = results.reduce((a, b) => (labelScore(b, drug.ingredients) > labelScore(a, drug.ingredients) ? b : a))
  const sections: DrugLabel['sections'] = {}
  for (const s of LABEL_SECTIONS) {
    const t = sectionText(best[s])
    if (t) sections[s] = t
  }
  const t = best.effective_time ?? ''
  return {
    setId: best.set_id,
    genericName: best.openfda?.generic_name?.[0] ?? drug.name,
    brandName: best.openfda?.brand_name?.[0],
    manufacturer: best.openfda?.manufacturer_name?.[0],
    effectiveDate: t.length === 8 ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : new Date().toISOString().slice(0, 10),
    sections,
  }
}

/* ---------------- finding one drug on another's label ---------------- */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** words that, next to a mention, mark it as serious */
const SERIOUS =
  /contraindicat|do not (use|take|co-?administer)|avoid|should not|serious|fatal|life-threatening|death|bleed|hemorrhag|\bINR\b|prothrombin|anticoagulant effect|torsade|QT(c)? (interval )?prolong|serotonin syndrome|rhabdomyolysis|myopathy|respiratory depression|hyperkalemia|hypoglycemia|lactic acidosis/i

/** terms that identify a drug in label text: ingredients, distinctive brand names, class names */
export function searchTerms(drug: NormalizedDrug): string[] {
  const terms = new Set<string>()
  for (const i of drug.ingredients) terms.add(i)
  for (const b of drug.brands) if (b.length >= 5 && !/\s/.test(b)) terms.add(b.toLowerCase())
  for (const c of drug.classes) {
    terms.add(c.toLowerCase())
    // "Fluoroquinolone Antibacterial" → "fluoroquinolone"; "HMG-CoA Reductase Inhibitor" → "HMG-CoA reductase inhibitor"
    const head = c.split(/\s+/)[0]
    if (head.length >= 10) terms.add(head.toLowerCase())
  }
  return [...terms]
}

function sentencesAround(text: string, index: number, length: number): string {
  // sentence boundaries: ". " followed by a capital, or start/end of text
  const before = text.slice(0, index)
  const startCut = Math.max(before.lastIndexOf('. '), before.lastIndexOf('; '))
  let start = startCut >= 0 ? startCut + 2 : 0
  // OTC labels have no periods between headings ("…warfarin Stop use and ask a doctor if…")
  const afterIdx = text.slice(index + length).search(/\.\s+[A-Z(]|\.$|\s(?=(Stop use|Do not use|When using|Keep out of reach|If pregnant|Ask a doctor)\b)/)
  let end = afterIdx >= 0 ? index + length + afterIdx + 1 : text.length
  let clipped = false
  // keep passages readable; label text runs on through flattened tables
  const leadClipped = index - start > 260
  if (leadClipped) start = text.lastIndexOf(' ', index - 220) + 1
  if (end - (index + length) > 320) {
    end = text.indexOf(' ', index + length + 280)
    clipped = true
  }
  if (end < 0) end = text.length
  return `${leadClipped ? '…' : ''}${text.slice(start, end).trim()}${clipped ? '…' : ''}`
}

/** Every section of `label` (belonging to `labelOf`) that names `other`, strongest section first. */
export function findMentions(labelOf: string, label: DrugLabel, other: NormalizedDrug): LabelMention[] {
  const terms = searchTerms(other)
  const out: LabelMention[] = []
  for (const section of LABEL_SECTIONS) {
    const text = label.sections[section]
    if (!text) continue
    for (const term of terms) {
      const m = new RegExp(`\\b${escape(term)}(e?s)?\\b`, 'i').exec(text)
      if (!m) continue
      const passage = sentencesAround(text, m.index, m[0].length)
      const strong = section === 'boxed_warning' || section === 'contraindications' || section === 'do_not_use'
      out.push({ labelOf, label, section, term, passage, severity: strong || SERIOUS.test(passage) ? 'major' : 'moderate' })
      break // one passage per section is enough
    }
  }
  return out
}
