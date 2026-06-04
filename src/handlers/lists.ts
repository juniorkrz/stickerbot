import { and, asc, desc, eq } from 'drizzle-orm'

import { listEntries, lists } from '../db/schema'
import { db } from './db'

export type ListRow = typeof lists.$inferSelect
export type EntryRow = typeof listEntries.$inferSelect

export const SECTION_MAIN = 'main'
export const SECTION_GK = 'gk'

// ---------------------------------------------------------------------------
// Template parsing — turns a pasted/quoted list into a structured template.
// ---------------------------------------------------------------------------

export interface ParsedTemplate {
  title: string
  subtitle: string | null
  mainCap: number
  gkLabel: string | null
  gkCap: number
  mainNames: string[]
  gkNames: string[]
}

// Matches a numbered slot line: "1 - Fulano", "12 -", "3 . Beltrano", etc.
const SLOT_RE = /^\s*(\d+)\s*[-–.)]\s*(.*)$/

interface ParsedSection {
  label: string | null
  count: number
  names: string[]
}

export const parseListTemplate = (raw: string): ParsedTemplate | null => {
  const lines = raw.split('\n').map(l => l.replace(/\s+$/, ''))
  let title = ''
  const subtitleLines: string[] = []
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null
  let seenSlot = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const match = trimmed.match(SLOT_RE)
    if (match) {
      seenSlot = true
      if (!current) {
        current = { label: null, count: 0, names: [] }
        sections.push(current)
      }
      current.count++
      const name = match[2].trim()
      if (name) current.names.push(name)
    } else if (!seenSlot) {
      if (!title) title = trimmed
      else subtitleLines.push(trimmed)
    } else {
      // A header line after slots starts a new section (e.g. "🥅 Goleiros").
      current = { label: trimmed, count: 0, names: [] }
      sections.push(current)
    }
  }

  if (!title || sections.length === 0) return null

  const main = sections[0]
  const gk = sections[1] || null
  return {
    title,
    subtitle: subtitleLines.length ? subtitleLines.join('\n') : null,
    mainCap: main.count,
    gkLabel: gk ? gk.label : null,
    gkCap: gk ? gk.count : 0,
    mainNames: main.names,
    gkNames: gk ? gk.names : []
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getActiveList = async (groupJid: string): Promise<ListRow | null> => {
  const rows = await db.select()
    .from(lists)
    .where(and(eq(lists.groupJid, groupJid), eq(lists.status, 'open')))
    .orderBy(desc(lists.id))
    .limit(1)
  return rows.length > 0 ? rows[0] : null
}

export const getEntries = async (listId: number): Promise<EntryRow[]> => {
  return await db.select()
    .from(listEntries)
    .where(eq(listEntries.listId, listId))
    .orderBy(asc(listEntries.id))
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const buildImportedEntry = (listId: number, section: string, name: string) => ({
  listId,
  section,
  name,
  jid: null,
  addedBy: null,
  createdAt: new Date()
})

// Creates a new active list for the group (closing any previous open one).
// When importNames is true, the names present in the template seed the entries.
export const createList = async (
  groupJid: string,
  template: ParsedTemplate,
  createdBy: string | null,
  importNames: boolean
): Promise<ListRow> => {
  const now = new Date()
  await db.update(lists)
    .set({
      status: 'closed',
      updatedAt: now
    })
    .where(and(eq(lists.groupJid, groupJid), eq(lists.status, 'open')))

  await db.insert(lists).values({
    groupJid,
    title: template.title,
    subtitle: template.subtitle,
    mainCap: template.mainCap,
    gkLabel: template.gkLabel,
    gkCap: template.gkCap,
    status: 'open',
    createdBy,
    createdAt: now,
    updatedAt: now
  })

  const list = await getActiveList(groupJid)
  if (!list) throw new Error('Failed to create list')

  if (importNames) {
    const rows = [
      ...template.mainNames.map(name => buildImportedEntry(list.id, SECTION_MAIN, name)),
      ...template.gkNames.map(name => buildImportedEntry(list.id, SECTION_GK, name))
    ]
    if (rows.length > 0) await db.insert(listEntries).values(rows)
  }

  return list
}

export const setListStatus = async (listId: number, status: string): Promise<void> => {
  await db.update(lists)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(lists.id, listId))
}

const sectionRank = (entries: EntryRow[], entry: EntryRow): number => {
  return entries.filter(e => e.section === entry.section).findIndex(e => e.id === entry.id) + 1
}

export interface JoinResult {
  status: 'ok' | 'dup' | 'gk_full'
  position: number
  isReserva: boolean
}

export const joinList = async (
  list: ListRow,
  section: string,
  name: string,
  jid: string | null,
  addedBy: string | null
): Promise<JoinResult> => {
  const entries = await getEntries(list.id)

  if (jid) {
    const existing = entries.find(e => e.jid === jid)
    if (existing) {
      const rank = sectionRank(entries, existing)
      return {
        status: 'dup',
        position: rank,
        isReserva: existing.section === SECTION_MAIN && rank > list.mainCap
      }
    }
  }

  if (section === SECTION_GK) {
    const gkCount = entries.filter(e => e.section === SECTION_GK).length
    if (gkCount >= list.gkCap) return { status: 'gk_full', position: 0, isReserva: false }
  }

  await db.insert(listEntries).values({
    listId: list.id,
    section,
    name,
    jid: jid ?? null,
    addedBy: addedBy ?? null,
    createdAt: new Date()
  })

  const sectionCount = entries.filter(e => e.section === section).length + 1
  const isReserva = section === SECTION_MAIN && sectionCount > list.mainCap
  return { status: 'ok', position: sectionCount, isReserva }
}

// Deletes an entry and returns the reserve that gets promoted into the main
// list (if removing this entry opened a playing spot), or null.
const removeEntry = async (list: ListRow, entry: EntryRow, entries: EntryRow[]): Promise<EntryRow | null> => {
  let promoted: EntryRow | null = null
  if (entry.section === SECTION_MAIN) {
    const main = entries.filter(e => e.section === SECTION_MAIN)
    const index = main.findIndex(e => e.id === entry.id)
    if (index >= 0 && index < list.mainCap && main.length > list.mainCap) {
      promoted = main[list.mainCap]
    }
  }
  await db.delete(listEntries).where(eq(listEntries.id, entry.id))
  return promoted
}

export interface RemoveResult {
  ok: boolean
  removed?: EntryRow
  promoted?: EntryRow | null
}

export const leaveList = async (list: ListRow, jid: string): Promise<RemoveResult> => {
  const entries = await getEntries(list.id)
  const mine = entries.find(e => e.jid === jid)
  if (!mine) return { ok: false }
  const promoted = await removeEntry(list, mine, entries)
  return { ok: true, removed: mine, promoted }
}

export const removeByPosition = async (
  list: ListRow,
  position: number,
  section: string = SECTION_MAIN
): Promise<RemoveResult> => {
  const entries = await getEntries(list.id)
  const sectionEntries = entries.filter(e => e.section === section)
  if (position < 1 || position > sectionEntries.length) return { ok: false }
  const entry = sectionEntries[position - 1]
  const promoted = await removeEntry(list, entry, entries)
  return { ok: true, removed: entry, promoted }
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

const setEntryPresent = async (entryId: number, present: boolean): Promise<void> => {
  await db.update(listEntries)
    .set({ present: present ? 1 : 0 })
    .where(eq(listEntries.id, entryId))
}

// Marks the sender's own entry (matched by jid). Returns the entry, or null if not on the list.
export const markPresenceByJid = async (
  list: ListRow,
  jid: string,
  present: boolean
): Promise<EntryRow | null> => {
  const entries = await getEntries(list.id)
  const mine = entries.find(e => e.jid === jid)
  if (!mine) return null
  await setEntryPresent(mine.id, present)
  return { ...mine, present: present ? 1 : 0 }
}

// Marks an entry by its display position within a section (handles guests).
export const markPresenceByPosition = async (
  list: ListRow,
  section: string,
  position: number,
  present: boolean
): Promise<EntryRow | null> => {
  const entries = await getEntries(list.id)
  const sectionEntries = entries.filter(e => e.section === section)
  if (position < 1 || position > sectionEntries.length) return null
  const entry = sectionEntries[position - 1]
  await setEntryPresent(entry.id, present)
  return { ...entry, present: present ? 1 : 0 }
}

// Count of present players among the playing line (1..mainCap) plus goalkeepers.
export const getPresentCount = async (list: ListRow): Promise<number> => {
  const entries = await getEntries(list.id)
  const playing = entries.filter(e => e.section === SECTION_MAIN).slice(0, list.mainCap)
  const gk = entries.filter(e => e.section === SECTION_GK)
  return [...playing, ...gk].filter(e => e.present).length
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const formatName = (entry: EntryRow): string => {
  // Present players get a green check; member-added guests show who brought them.
  const check = entry.present ? '✅ ' : ''
  if (!entry.jid && entry.addedBy) return `${check}${entry.name} (convidado de ${entry.addedBy})`
  return `${check}${entry.name}`
}

export const renderList = async (list: ListRow): Promise<string> => {
  const entries = await getEntries(list.id)
  const main = entries.filter(e => e.section === SECTION_MAIN)
  const gk = entries.filter(e => e.section === SECTION_GK)

  let out = list.title
  if (list.subtitle) out += `\n${list.subtitle}`
  out += '\n'

  for (let i = 0; i < list.mainCap; i++) {
    const entry = main[i]
    out += `\n${i + 1} - ${entry ? formatName(entry) : ''}`
  }

  if (list.gkCap > 0) {
    out += `\n\n${list.gkLabel || '🥅 Goleiros'}`
    for (let i = 0; i < list.gkCap; i++) {
      const entry = gk[i]
      out += `\n${i + 1} - ${entry ? formatName(entry) : ''}`
    }
  }

  const reservas = main.slice(list.mainCap)
  if (reservas.length > 0) {
    out += '\n\n📋 Reservas'
    reservas.forEach((entry, i) => {
      out += `\n${list.mainCap + i + 1} - ${formatName(entry)}`
    })
  }

  const presentCount = [...main.slice(0, list.mainCap), ...gk].filter(e => e.present).length
  if (presentCount > 0) out += `\n\n✅ ${presentCount} presente${presentCount > 1 ? 's' : ''}`

  if (list.status === 'closed') out += '\n\n🔒 _Lista fechada_'
  return out
}

// ---------------------------------------------------------------------------
// Team draw
// ---------------------------------------------------------------------------

const shuffle = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

export interface Team {
  players: EntryRow[]
  gk: EntryRow | null
}

export interface DrawResult {
  ok: boolean
  error?: 'size' | 'few' | 'nopresence'
  confirmed?: number
  teams?: Team[]
  leftover?: EntryRow[]
  gkLeftover?: EntryRow[]
}

// Draws the line players (positions 1..mainCap, not reserves) into teams of
// teamSize, distributing one goalkeeper per team. Leftovers are listed.
// presentOnly (default) restricts the draw to players marked present.
export const drawTeams = async (
  list: ListRow,
  teamSize: number,
  presentOnly: boolean = true
): Promise<DrawResult> => {
  if (teamSize < 1) return { ok: false, error: 'size' }

  const entries = await getEntries(list.id)
  let confirmed = entries.filter(e => e.section === SECTION_MAIN).slice(0, list.mainCap)
  let goalkeepers = entries.filter(e => e.section === SECTION_GK)
  if (presentOnly) {
    confirmed = confirmed.filter(e => e.present)
    goalkeepers = goalkeepers.filter(e => e.present)
  }

  if (presentOnly && confirmed.length === 0) return { ok: false, error: 'nopresence' }
  if (confirmed.length < teamSize) return { ok: false, error: 'few' }

  const players = shuffle([...confirmed])
  const numTeams = Math.floor(players.length / teamSize)
  const teams: Team[] = []
  for (let t = 0; t < numTeams; t++) {
    teams.push({
      players: players.slice(t * teamSize, (t + 1) * teamSize),
      gk: null
    })
  }
  const leftover = players.slice(numTeams * teamSize)

  const shuffledGk = shuffle([...goalkeepers])
  for (let t = 0; t < teams.length && t < shuffledGk.length; t++) {
    teams[t].gk = shuffledGk[t]
  }
  const gkLeftover = shuffledGk.slice(teams.length)

  return {
    ok: true,
    confirmed: confirmed.length,
    teams,
    leftover,
    gkLeftover
  }
}
