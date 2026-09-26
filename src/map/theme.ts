// Map themes. Signage is the default dark look; paper and night are Plus perks.
import { createContext } from 'react'

export type ThemeName = 'signage' | 'paper' | 'night'
export const THEME_NAMES: ThemeName[] = ['signage', 'paper', 'night']

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

export const THEMES: Record<ThemeName, Palette> = { signage: SIGNAGE, paper: PAPER, night: NIGHT }

export const ThemeCtx = createContext<ThemeName>('signage')
