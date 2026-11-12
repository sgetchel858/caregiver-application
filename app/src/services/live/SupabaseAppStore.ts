import { createClient, type PostgrestError, type PostgrestSingleResponse, type SupabaseClient } from '@supabase/supabase-js'
import type { AppStore } from '../AppStore'
import type { Auth } from '../auth/Auth'
import { ServiceError } from '../errors'
import type {
  Appointment,
  AppUser,
  DateRange,
  Family,
  FamilyMember,
  FamilyUpdate,
  MemberInput,
  MessageDraft,
  PrepSheet,
  QuestionList,
  SavedPrepSheet,
  ToBookItem,
  UserSettings,
} from '../types'
import { initialsOf } from '../../lib/family'
import type { Database, Json } from './database.types'

type Tables = Database['public']['Tables']
type MemberRow = Tables['family_members']['Row']
type AppointmentRow = Tables['appointments']['Row']
type DraftRow = Tables['message_drafts']['Row']

/** What the store needs to know about the signed-in user, loaded once per session. */
interface Session {
  user: AppUser
  family: Family
  /** every family_members row, including the user's own */
  rows: MemberRow[]
  /** the user's own family_members row */
  selfMemberId: string | null
}

const DEFAULT_SETTINGS: UserSettings = { largeText: false, shareUpdatesByDefault: true }

function fail(error: PostgrestError, status?: number): never {
  if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') {
    throw new ServiceError('unauthorized', error.message)
  }
  if (status === 403 || error.code === '42501') throw new ServiceError('forbidden', error.message)
  // supabase-js reports a failed fetch as an error with no Postgres code
  if (!error.code && /fetch|network/i.test(error.message)) throw new ServiceError('network', error.message)
  throw new ServiceError('server', error.message)
}

/** Unwraps a supabase-js result, turning its error into a ServiceError. */
function ok<T>(res: PostgrestSingleResponse<T>): T {
  if (res.error) fail(res.error, res.status)
  return res.data
}

const toJson = (v: unknown) => v as Json

function toMember(r: MemberRow, id: string, isSelf: boolean): FamilyMember {
  return {
    id,
    healthMemberId: r.health_member_id,
    firstName: r.first_name,
    lastName: r.last_name ?? '', // '' until the member_profiles migration is applied
    relation: r.relation,
    userIs: r.user_is,
    birthYear: r.birth_year,
    age: r.birth_year ? new Date().getFullYear() - r.birth_year : null,
    initials: r.initials,
    avatarColor: r.avatar_color,
    isSelf,
  }
}

/**
 * Supabase-backed app store. Tables, row-level security and the demo seed are
 * in supabase/migrations; the layout is described in DATA.md, Part 2.
 *
 * Supabase trusts the Auth0 sign-in (third-party auth): every request carries
 * the user's Auth0 ID token, and row-level security keys off its `sub` claim.
 *
 * App data only: no medical records and no agent logic belong here.
 */
export class SupabaseAppStore implements AppStore {
  private db: SupabaseClient<Database>
  private session: Promise<Session> | null = null

  constructor(url: string, publishableKey: string, auth: Auth) {
    this.db = createClient<Database>(url, publishableKey, { accessToken: () => auth.getIdToken() })
  }

  /* ---- session ---- */

  private load(): Promise<Session> {
    this.session ??= this.loadSession().catch((e) => {
      this.session = null // let the next call retry
      throw e
    })
    return this.session
  }

  private async loadSession(): Promise<Session> {
    // Demo: a first-time user gets their own copy of the Mitchell family.
    const userId = ok(await this.db.rpc('bootstrap_demo_family'))

    const [userRes, familyRes] = await Promise.all([
      this.db.from('app_users').select('*').eq('id', userId).single(),
      this.db.from('families').select('id, name, family_members(*)').order('created_at').limit(1).maybeSingle(),
    ])
    const u = ok(userRes)
    const f = ok(familyRes)
    if (!f) throw new ServiceError('not-found', 'This account has no family yet')

    const rows = [...f.family_members].sort((a, b) => a.sort_order - b.sort_order)
    const circles = ok(
      await this.db
        .from('care_circles')
        .select('*')
        .in('about_member_id', rows.map((r) => r.id)),
    )

    const user: AppUser = {
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      initials: u.initials,
      avatarColor: u.avatar_color,
    }
    const selfMemberId = rows.find((r) => r.app_user_id === user.id)?.id ?? null
    // To screens, the user's own entry has the user's id.
    const personId = (rowId: string) => (rowId === selfMemberId ? user.id : rowId)
    const members = rows.map((r) => toMember(r, personId(r.id), r.id === selfMemberId))

    // Who else gets updates about a member. Screens look it up by the member's
    // id or by their Health API id. The user always sees updates, so their own
    // entry is left out.
    const careCircles: Record<string, string[]> = {}
    for (const c of circles) {
      if (c.notify_member_id === selfMemberId) continue
      const about = rows.find((r) => r.id === c.about_member_id)
      for (const key of [personId(c.about_member_id), about?.health_member_id]) {
        if (key) (careCircles[key] ??= []).push(c.notify_member_id)
      }
    }

    return { user, family: { id: f.id, name: f.name, members, careCircles }, rows, selfMemberId }
  }

  /** The family_members row for a member's id (the user's id for their own entry) or their Health API id. */
  private memberRow(s: Session, memberId: string): MemberRow {
    const rowId = memberId === s.user.id ? s.selfMemberId : memberId
    const row = s.rows.find((r) => r.id === rowId) ?? s.rows.find((r) => r.health_member_id === memberId)
    if (!row) throw new ServiceError('not-found', `No family member "${memberId}"`)
    return row
  }

  /** family_members.id for the user's id or a member's id. */
  private toMemberId(s: Session, personId: string): string {
    if (personId === s.user.id) {
      if (!s.selfMemberId) throw new ServiceError('server', 'The signed-in user has no family member row')
      return s.selfMemberId
    }
    return this.memberRow(s, personId).id
  }

  /** The user's id for their own row, the member's id otherwise. */
  private toPersonId(s: Session, memberId: string): string {
    return memberId === s.selfMemberId ? s.user.id : memberId
  }

  /* ---- user and family ---- */

  async getCurrentUser(): Promise<AppUser> {
    return (await this.load()).user
  }

  async getFamily(): Promise<Family> {
    return (await this.load()).family
  }

  /* ---- family members ---- */

  /** Forget the cached family so the next read sees the change. */
  private changed() {
    this.session = null
  }

  async addMember(input: MemberInput): Promise<FamilyMember> {
    const s = await this.load()
    const row = ok(
      await this.db
        .from('family_members')
        .insert({
          family_id: s.family.id,
          first_name: input.firstName,
          last_name: input.lastName,
          relation: input.relation,
          user_is: input.userIs,
          birth_year: input.birthYear,
          initials: initialsOf(input.firstName, input.lastName),
          avatar_color: input.avatarColor,
          sort_order: Math.max(0, ...s.rows.map((r) => r.sort_order)) + 1,
        })
        .select()
        .single(),
    )
    this.changed()
    return toMember(row, row.id, false)
  }

  async updateMember(memberId: string, patch: Partial<MemberInput>): Promise<FamilyMember> {
    const s = await this.load()
    const before = this.memberRow(s, memberId)
    const isSelf = before.id === s.selfMemberId
    const firstName = patch.firstName ?? before.first_name
    const lastName = patch.lastName ?? before.last_name
    // initials tell people apart ("MM", "MK"), so they only change with the name
    const renamed = firstName !== before.first_name || lastName !== before.last_name
    const initials = renamed ? initialsOf(firstName, lastName) : before.initials
    const avatarColor = patch.avatarColor ?? before.avatar_color

    const row = ok(
      await this.db
        .from('family_members')
        .update({
          first_name: firstName,
          last_name: lastName,
          relation: patch.relation ?? before.relation,
          user_is: patch.userIs ?? before.user_is,
          birth_year: patch.birthYear === undefined ? before.birth_year : patch.birthYear,
          initials,
          avatar_color: avatarColor,
        })
        .eq('id', before.id)
        .select()
        .maybeSingle(),
    )
    if (!row) throw new ServiceError('forbidden', 'This account cannot change that family member')
    if (isSelf) {
      ok(
        await this.db
          .from('app_users')
          .update({ first_name: firstName, last_name: lastName, initials, avatar_color: avatarColor })
          .eq('id', s.user.id)
          .select('id')
          .single(),
      )
    }
    this.changed()
    return toMember(row, isSelf ? s.user.id : row.id, isSelf)
  }

  async removeMember(memberId: string): Promise<void> {
    const s = await this.load()
    const row = this.memberRow(s, memberId)
    if (row.id === s.selfMemberId) throw new ServiceError('forbidden', 'You cannot remove yourself from the family')
    // their appointments, prep sheets, drafts and care circle rows go with them (on delete cascade)
    const gone = ok(await this.db.from('family_members').delete().eq('id', row.id).select('id'))
    if (!gone.length) throw new ServiceError('forbidden', 'This account cannot remove that family member')
    this.changed()
  }

  async setCareCircle(memberId: string, notifyIds: string[]): Promise<string[]> {
    const s = await this.load()
    const about = this.memberRow(s, memberId)
    const wanted = s.rows
      .filter((r) => r.id !== about.id && r.id !== s.selfMemberId && notifyIds.includes(r.id))
      .map((r) => r.id)
    const current = ok(await this.db.from('care_circles').select('notify_member_id').eq('about_member_id', about.id))
      .map((c) => c.notify_member_id)
      .filter((id) => id !== s.selfMemberId)
    const removed = current.filter((id) => !wanted.includes(id))
    const added = wanted.filter((id) => !current.includes(id))
    if (removed.length) {
      ok(await this.db.from('care_circles').delete().eq('about_member_id', about.id).in('notify_member_id', removed).select())
    }
    if (added.length) {
      ok(
        await this.db
          .from('care_circles')
          .insert(added.map((id) => ({ about_member_id: about.id, notify_member_id: id })))
          .select(),
      )
    }
    this.changed()
    return wanted
  }

  /* ---- settings ---- */

  async getSettings(): Promise<UserSettings> {
    const s = await this.load()
    const row = ok(await this.db.from('user_settings').select('*').eq('app_user_id', s.user.id).maybeSingle())
    return row ? { largeText: row.large_text, shareUpdatesByDefault: row.share_updates_by_default } : DEFAULT_SETTINGS
  }

  async updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
    const s = await this.load()
    const next = { ...(await this.getSettings()), ...patch }
    ok(
      await this.db
        .from('user_settings')
        .upsert({ app_user_id: s.user.id, large_text: next.largeText, share_updates_by_default: next.shareUpdatesByDefault })
        .select()
        .single(),
    )
    return next
  }

  /* ---- prep sheets and question lists ---- */

  async getPrepSheet(memberId: string, visitId: string): Promise<SavedPrepSheet | null> {
    const s = await this.load()
    const row = ok(
      await this.db
        .from('prep_sheets')
        .select('sheet, saved_at')
        .eq('family_member_id', this.memberRow(s, memberId).id)
        .eq('visit_id', visitId)
        .maybeSingle(),
    )
    if (!row?.sheet) return null
    return { memberId, visitId, sheet: row.sheet as unknown as PrepSheet, savedAt: row.saved_at }
  }

  async savePrepSheet(sheet: SavedPrepSheet): Promise<SavedPrepSheet> {
    const s = await this.load()
    const pins = sheet.sheet.sections.flatMap((sec) =>
      sec.type === 'vital' ? [{ kind: 'vital', id: sec.reading.id, pinnedAt: sec.pinnedAt ?? null }] : [],
    )
    ok(
      await this.db
        .from('prep_sheets')
        .upsert(
          {
            family_member_id: this.memberRow(s, sheet.memberId).id,
            visit_id: sheet.visitId,
            pins: toJson(pins),
            sheet: toJson(sheet.sheet),
            saved_by: s.user.id,
            saved_at: sheet.savedAt,
          },
          { onConflict: 'family_member_id,visit_id' },
        )
        .select('id')
        .single(),
    )
    return sheet
  }

  async getQuestionList(memberId: string, visitId: string): Promise<QuestionList | null> {
    const s = await this.load()
    const row = ok(
      await this.db
        .from('question_lists')
        .select('items, updated_at')
        .eq('family_member_id', this.memberRow(s, memberId).id)
        .eq('visit_id', visitId)
        .maybeSingle(),
    )
    if (!row) return null
    return { memberId, visitId, items: row.items as unknown as QuestionList['items'], updatedAt: row.updated_at }
  }

  async saveQuestionList(list: QuestionList): Promise<QuestionList> {
    const s = await this.load()
    const row = ok(
      await this.db
        .from('question_lists')
        .upsert({
          family_member_id: this.memberRow(s, list.memberId).id,
          visit_id: list.visitId,
          items: toJson(list.items),
          updated_at: new Date().toISOString(),
        })
        .select('updated_at')
        .single(),
    )
    return { ...list, updatedAt: row.updated_at }
  }

  /* ---- message drafts and family updates ---- */

  private toDraft(row: DraftRow, memberId: string): MessageDraft {
    return {
      id: row.draft_key,
      memberId,
      to: { clinicianId: row.to_clinician_id, name: row.to_name, role: row.to_role },
      channel: 'MyChart',
      body: row.body ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.about_kind === 'interaction-check' && row.about_id
        ? { about: { kind: 'interaction-check' as const, id: row.about_id } }
        : {}),
    }
  }

  async listDrafts(memberId: string): Promise<MessageDraft[]> {
    const s = await this.load()
    const rows = ok(
      await this.db
        .from('message_drafts')
        .select('*')
        .eq('family_member_id', this.memberRow(s, memberId).id)
        .order('created_at'),
    )
    return rows.map((r) => this.toDraft(r, memberId))
  }

  async saveDraft(draft: MessageDraft): Promise<MessageDraft> {
    const s = await this.load()
    const row = ok(
      await this.db
        .from('message_drafts')
        .upsert(
          {
            family_member_id: this.memberRow(s, draft.memberId).id,
            draft_key: draft.id,
            to_clinician_id: draft.to.clinicianId,
            to_name: draft.to.name,
            to_role: draft.to.role,
            channel: draft.channel,
            body: draft.body,
            about_kind: draft.about?.kind ?? null,
            about_id: draft.about?.id ?? null,
            created_by: s.user.id,
            created_at: draft.createdAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'family_member_id,draft_key' },
        )
        .select()
        .single(),
    )
    return this.toDraft(row, draft.memberId)
  }

  async createFamilyUpdate(update: Omit<FamilyUpdate, 'id' | 'createdAt'>): Promise<FamilyUpdate> {
    const s = await this.load()
    const row = ok(
      await this.db
        .from('family_updates')
        .insert({
          family_id: s.family.id,
          from_user_id: s.user.id,
          about_member_id: this.memberRow(s, update.aboutMemberId).id,
          to_member_ids: update.toMemberIds.map((id) => this.toMemberId(s, id)),
          summary: update.summary,
          ref_kind: update.ref.kind,
          ref_id: update.ref.id,
        })
        .select('id, created_at')
        .single(),
    )
    return { ...update, id: row.id, createdAt: row.created_at }
  }

  /* ---- calendar ---- */

  private toAppointment(s: Session, row: AppointmentRow): Appointment {
    // Who could take them: the user first, then the member's care circle.
    const memberId = this.toPersonId(s, row.family_member_id)
    const circle = s.family.careCircles[memberId] ?? []
    const escortOptions = row.kind === 'visit' ? [...new Set([s.user.id, ...circle])] : []
    return {
      id: row.id,
      familyId: row.family_id,
      memberId,
      kind: row.kind as Appointment['kind'],
      title: row.title,
      date: row.starts_on,
      startsAt: row.starts_at,
      place: row.place,
      placePhone: row.place_phone,
      note: row.note,
      healthVisitId: row.health_visit_id,
      escortId: row.escort_member_id ? this.toPersonId(s, row.escort_member_id) : null,
      escortOptions,
    }
  }

  async listAppointments(familyId: string, range: DateRange): Promise<Appointment[]> {
    const s = await this.load()
    const rows = ok(
      await this.db
        .from('appointments')
        .select('*')
        .eq('family_id', familyId)
        .gte('starts_on', range.from)
        .lte('starts_on', range.to),
    )
    return rows
      .map((r) => this.toAppointment(s, r))
      .sort((a, b) => (a.startsAt ?? a.date).localeCompare(b.startsAt ?? b.date))
  }

  async getAppointment(appointmentId: string): Promise<Appointment | null> {
    const s = await this.load()
    const res = await this.db.from('appointments').select('*').eq('id', appointmentId).maybeSingle()
    // an id that isn't a uuid (an old link from the mock store) is simply not found
    if (res.error?.code === '22P02') return null
    const row = ok(res)
    return row ? this.toAppointment(s, row) : null
  }

  async listToBookItems(familyId: string): Promise<ToBookItem[]> {
    const s = await this.load()
    const rows = ok(
      await this.db
        .from('to_book_items')
        .select('*')
        .eq('family_id', familyId)
        .is('booked_appointment_id', null)
        .order('due_by'),
    )
    return rows.map((r) => ({ id: r.id, familyId: r.family_id, memberId: this.toPersonId(s, r.family_member_id), title: r.title, dueBy: r.due_by }))
  }

  async setAppointmentEscort(appointmentId: string, escortId: string | null): Promise<Appointment> {
    const s = await this.load()
    const appt = await this.getAppointment(appointmentId)
    if (!appt) throw new ServiceError('not-found', 'Appointment not found')
    if (escortId !== null && !appt.escortOptions.includes(escortId)) {
      throw new ServiceError('server', 'That person is not in the care circle for this visit')
    }
    const row = ok(
      await this.db
        .from('appointments')
        .update({ escort_member_id: escortId === null ? null : this.toMemberId(s, escortId) })
        .eq('id', appointmentId)
        .select()
        .maybeSingle(),
    )
    if (!row) throw new ServiceError('forbidden', 'This account cannot change that appointment')
    return this.toAppointment(s, row)
  }
}
