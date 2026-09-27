// Keeps nicknames and group names presentable on the shared boards.
// The server checks the same lists (clean_name in supabase/schema.sql); this copy gives instant feedback.

// Long words are blocked anywhere in the name, even with dots or spaces pushed in between.
const ANYWHERE = [
  'kanker', 'tering', 'tyfus', 'klootzak', 'flikker', 'mongool', 'debiel', 'nikker', 'verkracht',
  'nigger', 'nigga', 'faggot', 'bitch', 'whore', 'pussy', 'rapist', 'retard',
  'hitler', 'siegheil', 'wegenkenner', 'beheerder', 'moderator',
]
// Short words only count at the start or end of a word, so Schoerder and Rekuth stay fine.
const EDGE = ['hoer', 'kut', 'neger', 'pedo', 'fuck', 'shit', 'cunt', 'slut', 'nazi', 'admin']

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i' }

/** Lower-case, strip accents, undo leet speak; everything that is not a letter becomes a space. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0134578@$!|]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

export function isClean(s: string): boolean {
  const n = normalizeName(s)
  const glued = n.replace(/ /g, '')
  if (ANYWHERE.some((w) => glued.includes(w))) return false
  return !n.split(' ').some((tok) => EDGE.some((w) => tok.startsWith(w) || tok.endsWith(w)))
}

const SHAPE = /^[\p{L}\p{N} _.-]+$/u

function validName(s: string, min: number, max: number): boolean {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length < min || t.length > max) return false
  if (!SHAPE.test(t)) return false
  if (!/\p{L}|\p{N}/u.test(t)) return false
  return isClean(t)
}

export const validNickname = (s: string): boolean => validName(s, 2, 16)
export const validGroupName = (s: string): boolean => validName(s, 2, 32)

/** Trimmed, single-spaced version to send to the server. */
export const tidyName = (s: string): string => s.trim().replace(/\s+/g, ' ')
