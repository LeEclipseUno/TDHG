// Tiny synthesised sound effects (no audio files) plus haptics. Everything respects the sound setting.

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean) {
  enabled = on
}

// Everything runs through one master gain so the whole set sits at half volume.
let master: GainNode | null = null
const MASTER = 0.5
function out(c: AudioContext): AudioNode {
  if (!master) {
    master = c.createGain()
    master.gain.value = MASTER
    master.connect(out(c))
  }
  return master
}

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.15, delay = 0, slideTo?: number) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(out(c))
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function thud(delay = 0) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const len = Math.floor(c.sampleRate * 0.08)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = 0.25
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 900
  src.connect(f).connect(g).connect(out(c))
  src.start(t0)
  tone(150, 0.14, 'sine', 0.35, delay, 55)
}

export const sfx = {
  /** Soft click for taps and drags. */
  tap: () => tone(1400, 0.035, 'square', 0.04),
  /** A sign landing on the road. */
  place: () => thud(),
  correct: () => {
    tone(660, 0.09, 'triangle', 0.18)
    tone(990, 0.14, 'triangle', 0.18, 0.09)
  },
  wrong: () => tone(170, 0.28, 'sawtooth', 0.12, 0, 110),
  /** Matrix board tick for the last seconds. */
  tick: () => tone(1800, 0.03, 'square', 0.07),
  /** Rising arpeggio for streaks; n is the streak length. */
  combo: (n: number) => {
    const base = 520 + Math.min(n, 6) * 60
    ;[0, 0.07, 0.14].forEach((d, i) => tone(base * Math.pow(1.26, i), 0.09, 'triangle', 0.14, d))
  },
  /** Counting ticks on the results board. */
  count: () => tone(2200, 0.015, 'square', 0.035),
  /** The click of a hectometre post: a short wooden knock with a bright tip. */
  post: () => {
    thud()
    tone(2600, 0.02, 'square', 0.05, 0.01)
  },
  /** Perfect daily: a small road-sign fanfare. */
  perfect: () => {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319]
    const when = [0, 0.11, 0.22, 0.33, 0.5, 0.61, 0.72]
    notes.forEach((f, i) => tone(f, i === notes.length - 1 ? 0.6 : 0.13, 'triangle', 0.17, when[i]))
    ;[0.33, 0.72].forEach((d) => tone(262, 0.3, 'sine', 0.1, d))
  },
  /** End of round. */
  done: () => {
    ;[0, 0.12, 0.24, 0.42].forEach((d, i) => tone([523, 659, 784, 1047][i], i === 3 ? 0.4 : 0.14, 'triangle', 0.16, d))
  },
}

export function haptic(pattern: number | number[]) {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}
