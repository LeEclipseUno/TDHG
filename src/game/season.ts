// Seasonal decorations: which Dutch occasion is it today?
export type Season = 'kingsday' | 'sinterklaas' | 'christmas' | 'carnaval' | null

/** Easter Sunday (Gregorian, Meeus/Jones/Butcher). */
function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

export function season(d = new Date()): Season {
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (m === 4 && (day === 26 || day === 27)) return 'kingsday'
  if (m === 12 && day >= 1 && day <= 5) return 'sinterklaas'
  if ((m === 12 && day >= 20) || (m === 1 && day <= 1)) return 'christmas'
  // Carnaval: the Saturday before Ash Wednesday through Shrove Tuesday (Easter minus 50 to 47 days).
  const e = easter(d.getFullYear()).getTime()
  const t = new Date(d.getFullYear(), m - 1, day).getTime()
  const days = Math.round((e - t) / 86_400_000)
  if (days >= 47 && days <= 50) return 'carnaval'
  return null
}

export const SEASON_TEXT: Record<Exclude<Season, null>, { nl: string; en: string }> = {
  kingsday: { nl: 'Fijne Koningsdag!', en: 'Happy King’s Day!' },
  sinterklaas: { nl: 'Fijne pakjesavond!', en: 'Happy Sinterklaas!' },
  christmas: { nl: 'Fijne feestdagen!', en: 'Happy holidays!' },
  carnaval: { nl: 'Alaaf! Fijne carnaval!', en: 'Alaaf! Happy Carnaval!' },
}
