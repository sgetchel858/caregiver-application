import type { SilClient } from './SilClient'
import { ServiceError } from '../errors'

/**
 * Seeds the fictional Mitchell family's records into Cognatum as folder documents,
 * so the Ask agent can answer from them through SIL folder chat.
 *
 *   Casanté · Mitchell family/            (root, the signed-in user owns it)
 *   └── Margaret Mitchell/                (the folder /ask queries for Mom)
 *       ├── Profile and care team/ …      (one markdown file per Health API record)
 *
 * The files live in app/seed/cognatum/<member>/<subfolder>/. Each file name ends
 * with " - <recordId>.md" and carries the record date, so a citation's title maps
 * back to a record and the adapter can leave out documents dated after the demo clock.
 *
 * Safe to run again: folders are found by name, a file whose content is unchanged
 * is skipped, and a changed file replaces the old document.
 */
export const SEED_ROOT_FOLDER = 'Casanté · Mitchell family'

const SEED_FILES = import.meta.glob('/seed/cognatum/**/*.md', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>

const POLL_MS = 3_000
const POLL_LIMIT_MS = 5 * 60_000

interface SilFolder {
  id: string
  name: string
}
interface SilDocument {
  id: string
  filename: string
  status: 'queued' | 'pending' | 'processing' | 'completed' | 'failed'
  content_sha256?: string | null
  content_hash?: string | null
  error?: string | null
}

export interface SeedProgress {
  /** one line for the demo menu */
  line: string
}

export interface SeedResult {
  rootFolderId: string
  memberFolders: Record<string, string>
  uploaded: number
  replaced: number
  unchanged: number
  failed: string[]
}

export async function seedCognatum(sil: SilClient, onProgress: (p: SeedProgress) => void): Promise<SeedResult> {
  const say = (line: string) => onProgress({ line })

  // member → subfolder → files
  const plan = new Map<string, Map<string, { filename: string; load: () => Promise<string> }[]>>()
  for (const [path, load] of Object.entries(SEED_FILES)) {
    const [member, sub, filename] = path.replace(/^\/seed\/cognatum\//, '').split('/')
    if (!member || !sub || !filename) continue
    if (!plan.has(member)) plan.set(member, new Map())
    const subs = plan.get(member)!
    if (!subs.has(sub)) subs.set(sub, [])
    subs.get(sub)!.push({ filename, load })
  }

  say('Finding the family folder…')
  const root = await findOrCreateFolder(sil, SEED_ROOT_FOLDER, null)
  const result: SeedResult = { rootFolderId: root.id, memberFolders: {}, uploaded: 0, replaced: 0, unchanged: 0, failed: [] }
  const waiting: SilDocument[] = []

  for (const [member, subs] of plan) {
    const memberFolder = await findOrCreateFolder(sil, member, root.id)
    result.memberFolders[member] = memberFolder.id
    for (const [sub, files] of subs) {
      say(`${member} / ${sub}…`)
      const folder = await findOrCreateFolder(sil, sub, memberFolder.id)
      const existing = await listDocuments(sil, folder.id)

      const toUpload: { filename: string; text: string; sha: string; replaces?: SilDocument }[] = []
      for (const f of files) {
        const text = await f.load()
        const sha = await sha256(text)
        const old = existing.find((d) => d.filename === f.filename)
        if (old && (old.content_sha256 ?? old.content_hash) === sha && old.status !== 'failed') {
          result.unchanged++
          continue
        }
        toUpload.push({ filename: f.filename, text, sha, replaces: old })
      }
      if (toUpload.length === 0) continue

      const sessionId = await openUploadSession(sil, folder.id, toUpload.length)
      for (const f of toUpload) {
        if (f.replaces) await sil.request('DELETE', `/documents/${f.replaces.id}`)
        const form = new FormData()
        form.append('file', new File([f.text], f.filename, { type: 'text/markdown' }))
        form.append('client_sha256', f.sha)
        if (sessionId) form.append('upload_session_id', sessionId)
        say(`Uploading ${f.filename}`)
        const doc = await sil.upload<SilDocument>(`/folders/${folder.id}/documents`, form)
        if (f.replaces) result.replaced++
        else result.uploaded++
        waiting.push(doc)
      }
    }
  }

  // Wait for ingestion, so Ask can use the documents as soon as this says done.
  const started = Date.now()
  let pending = waiting.filter((d) => d.status !== 'completed' && d.status !== 'failed')
  for (const d of waiting) if (d.status === 'failed') result.failed.push(d.filename)
  while (pending.length > 0) {
    if (Date.now() - started > POLL_LIMIT_MS) {
      throw new ServiceError('timeout', `${pending.length} documents still processing after 5 minutes; run the seed again to check`)
    }
    say(`Processing ${pending.length} of ${waiting.length} documents…`)
    await new Promise((r) => setTimeout(r, POLL_MS))
    const next: SilDocument[] = []
    for (const d of pending) {
      const now = await sil.request<SilDocument>('GET', `/documents/${d.id}`)
      if (now.status === 'failed') result.failed.push(`${now.filename}${now.error ? ` (${now.error})` : ''}`)
      else if (now.status !== 'completed') next.push(now)
    }
    pending = next
  }
  return result
}

async function findOrCreateFolder(sil: SilClient, name: string, parentId: string | null): Promise<SilFolder> {
  const query = parentId ? `?parent_id=${parentId}&limit=200` : '?limit=200'
  const { folders } = await sil.request<{ folders: SilFolder[] }>('GET', `/folders${query}`)
  const found = folders.find((f) => f.name === name)
  if (found) return found
  return sil.request<SilFolder>('POST', '/folders', { name, parent_id: parentId })
}

async function listDocuments(sil: SilClient, folderId: string): Promise<SilDocument[]> {
  const { documents } = await sil.request<{ documents: SilDocument[] }>('GET', `/folders/${folderId}/documents?limit=200`)
  return documents
}

/** ADR 050 admission control; a tenant without it answers 501 and takes plain uploads. */
async function openUploadSession(sil: SilClient, folderId: string, count: number): Promise<string | null> {
  try {
    const s = await sil.request<{ upload_session_id: string }>('POST', `/folders/${folderId}/upload-sessions`, {
      expected_file_count: count,
    })
    return s.upload_session_id
  } catch (e) {
    if (e instanceof ServiceError && e.status === 501) return null
    throw e
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
