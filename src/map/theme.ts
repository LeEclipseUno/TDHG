// Map themes. Signage is the default dark look; paper and night are Plus perks.
import { createContext } from 'react'

export type ThemeName = 'signage' | 'paper' | 'night' | 'delft' | 'polder' | 'kingsday' | 'sinterklaas' | 'snow'
/** The ones a player can pick; the rest are day-specific. */
export const THEME_NAMES: ThemeName[] = ['signage', 'paper', 'night', 'delft', 'polder']

export interface Palette {
  bg: string
  land: string
  landEdge: string
  abroad: string
  abroadEdge: string
  A: string
  N: string
  P: string
  correct: string
  wrong: string
  active: string
  /** Place names and labels. */
  text: string
  /** Shallow water glow along the coast. */
  glow: string
  /** Province borders. */
  border: string
  /** Bridge deck and tunnel outline. */
  structure: string
  /** Casing under bridges. */
  casing: string
  /** Water texture on the sea (empty string: none). */
  ripple: string
}

export const SIGNAGE: Palette = {
  bg: '#091b2c',
  land: '#1b4a8d',
  landEdge: '#2f6fd0',
  abroad: '#15243a',
  abroadEdge: '#22344d',
  A: '#f6f8fc',
  N: '#ffd23f',
  P: '#8aa4c8',
  correct: '#34d17c',
  wrong: '#ff4d5e',
  active: '#ef712f',
  text: '#ffffff',
  glow: 'rgba(90,150,230,0.28)',
  border: 'rgba(255,255,255,0.28)',
  structure: '#cfd8e6',
  casing: '#05101f',
  ripple: 'rgba(255,255,255,0.045)',
}

/** Classic road atlas: cream land, light blue water, red motorways, yellow N-roads. */
export const PAPER: Palette = {
  bg: '#b9dcf2',
  land: '#f4efdc',
  landEdge: '#9fc3de',
  abroad: '#e6e1cd',
  abroadEdge: '#cbc6b0',
  A: '#d9302a',
  N: '#f0b400',
  P: '#ffffff',
  correct: '#1f9d55',
  wrong: '#c1121f',
  active: '#1f5fd0',
  text: '#26313f',
  glow: 'rgba(120,170,220,0.4)',
  border: 'rgba(60,70,90,0.35)',
  structure: '#5b6470',
  casing: '#8a2a26',
  ripple: '',
}

/** Night drive: near-black land, motorways lit amber like sodium lamps. */
export const NIGHT: Palette = {
  bg: '#03070f',
  land: '#0b1424',
  landEdge: '#1c2d4a',
  abroad: '#05090f',
  abroadEdge: '#0d1420',
  A: '#ffd27a',
  N: '#ff9f43',
  P: '#3f5273',
  correct: '#3ddc84',
  wrong: '#ff4d5e',
  active: '#ffffff',
  text: '#e6ecf5',
  glow: 'rgba(255,180,80,0.10)',
  border: 'rgba(255,210,120,0.22)',
  structure: '#a8b4c8',
  casing: '#000000',
  ripple: 'rgba(255,255,255,0.03)',
}

/** Delfts blauw: porcelain white land, cobalt water, cobalt roads, like a painted tile. */
export const DELFT: Palette = {
  bg: '#1d4fa6',
  land: '#f8f8f3',
  landEdge: '#7f9fd8',
  abroad: '#e2e7ee',
  abroadEdge: '#c3cfe0',
  A: '#123c8c',
  N: '#4a86d8',
  P: '#b3c6e8',
  correct: '#1f9d55',
  wrong: '#c1121f',
  active: '#ef712f',
  text: '#123c8c',
  glow: 'rgba(255,255,255,0.5)',
  border: 'rgba(18,60,140,0.35)',
  structure: '#123c8c',
  casing: '#f8f8f3',
  ripple: 'rgba(255,255,255,0.07)',
}

/** Polder: grass-green meadows, sky-blue water, white motorways and a tulip-orange question road. */
export const POLDER: Palette = {
  bg: '#4a93d1',
  land: '#5f9e4b',
  landEdge: '#b7dd93',
  abroad: '#4f7f3f',
  abroadEdge: '#6f9d5c',
  A: '#ffffff',
  N: '#ffd23f',
  P: '#d5ecc0',
  correct: '#2f80ed',
  wrong: '#ff2d55',
  active: '#ef712f',
  text: '#ffffff',
  glow: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.5)',
  structure: '#eaf2df',
  casing: '#2f4a25',
  ripple: 'rgba(255,255,255,0.06)',
}

/** Koningsdag: the country in orange for one day. */
export const KINGSDAY: Palette = {
  ...SIGNAGE,
  land: '#ff7a1a',
  landEdge: '#ffb066',
  abroad: '#2c2118',
  abroadEdge: '#4a3627',
  A: '#ffffff',
  N: '#1b1f3a',
  P: '#c65a05',
  active: '#0d4a9c',
  glow: 'rgba(255,140,40,0.35)',
  border: 'rgba(255,255,255,0.4)',
}

/** Pakjesavond: deep red land, gold N-roads. */
export const SINTERKLAAS: Palette = {
  ...SIGNAGE,
  bg: '#120608',
  land: '#8b1e2d',
  landEdge: '#c0392b',
  abroad: '#2a1015',
  abroadEdge: '#3d1a20',
  A: '#ffffff',
  N: '#ffd23f',
  P: '#c4707a',
  active: '#ffb000',
  glow: 'rgba(255,200,120,0.15)',
  border: 'rgba(255,255,255,0.3)',
  casing: '#120608',
}

/** December: snow on the land, winter water, navy roads. */
export const SNOW: Palette = {
  bg: '#9cc3e6',
  land: '#f2f6fb',
  landEdge: '#c8d8ea',
  abroad: '#dfe6ee',
  abroadEdge: '#c5cfda',
  A: '#0d4a9c',
  N: '#e39a00',
  P: '#b8c4d2',
  correct: '#1f9d55',
  wrong: '#c1121f',
  active: '#ef712f',
  text: '#26313f',
  glow: 'rgba(255,255,255,0.5)',
  border: 'rgba(60,70,90,0.3)',
  structure: '#5b6470',
  casing: '#f2f6fb',
  ripple: '',
}

export const THEMES: Record<ThemeName, Palette> = { signage: SIGNAGE, paper: PAPER, night: NIGHT, delft: DELFT, polder: POLDER, kingsday: KINGSDAY, sinterklaas: SINTERKLAAS, snow: SNOW }

/** Day-specific theme, or null. Koningsdag and pakjesavond override everything for their day; snow covers December for players on the default look. */
export function seasonalTheme(chosen: ThemeName, d = new Date()): ThemeName | null {
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (m === 4 && day === 27) return 'kingsday'
  if (m === 12 && day === 5) return 'sinterklaas'
  if (m === 12 && chosen === 'signage') return 'snow'
  return null
}

export const ThemeCtx = createContext<ThemeName>('signage')
/** Colour-blind friendly right/wrong colours. */
export const AccessCtx = createContext<boolean>(false)
export const CB_CORRECT = '#2f80ed'
export const CB_WRONG = '#f5a623'
/** The question road, so it never looks like a wrong answer. */
export const CB_ACTIVE = '#d94fd9'
