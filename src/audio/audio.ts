import type { TimeOfDay, Weather } from '../game/types'

/**
 * All sound is synthesized at runtime. There are no audio files, so the lake
 * remains a single static bundle. Nothing is created until a real user gesture.
 */
class LakeAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private rainGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private tensionOsc: OscillatorNode | null = null
  private tensionGain: GainNode | null = null
  private reelTimer: number | null = null
  private loonTimer: number | null = null
  private birdTimer: number | null = null
  private enabled = true
  private paused = false
  private started = false
  private weather: Weather = 'calm'
  private time: TimeOfDay = 'golden'

  get isStarted(): boolean {
    return this.started
  }

  ensureStarted(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled || this.started) return
    if (typeof window === 'undefined') return

    try {
      const Ctor = window.AudioContext
      if (!Ctor) return
      const ctx = new Ctor()
      this.ctx = ctx
      this.started = true

      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
      this.master = master
      master.gain.setTargetAtTime(this.paused ? 0 : 0.82, ctx.currentTime, 0.5)

      this.noiseBuffer = this.makeNoise(ctx, 3.2)
      this.buildAmbient(ctx)
      this.applyWeather()
      void ctx.resume().catch(() => undefined)
      this.scheduleLoon(24_000 + Math.random() * 16_000)
      this.scheduleBird(9_000 + Math.random() * 12_000)
    } catch {
      this.started = false
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        enabled && !this.paused ? 0.82 : 0,
        this.ctx.currentTime,
        0.25,
      )
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(
      this.enabled && !paused ? 0.82 : 0,
      this.ctx.currentTime,
      0.2,
    )
    if (paused) {
      void this.ctx.suspend().catch(() => undefined)
    } else {
      void this.ctx.resume().catch(() => undefined)
    }
  }

  setTime(time: TimeOfDay): void {
    this.time = time
  }

  setWeather(weather: Weather): void {
    this.weather = weather
    this.applyWeather()
  }

  private applyWeather(): void {
    if (!this.ctx || !this.rainGain) return
    const target = this.weather === 'rain' ? 0.045 : this.weather === 'mist' ? 0.012 : 0
    this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 1.1)
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    return buffer
  }

  private buildAmbient(ctx: AudioContext): void {
    if (!this.master) return
    const ambient = ctx.createGain()
    ambient.gain.value = 0.75
    ambient.connect(this.master)

    if (!this.noiseBuffer) return

    // Low lapping water.
    const lap = ctx.createBufferSource()
    lap.buffer = this.noiseBuffer
    lap.loop = true
    const lapFilter = ctx.createBiquadFilter()
    lapFilter.type = 'lowpass'
    lapFilter.frequency.value = 420
    lapFilter.Q.value = 0.7
    const lapGain = ctx.createGain()
    lapGain.gain.value = 0.022
    lap.connect(lapFilter).connect(lapGain).connect(ambient)
    lap.start()

    const lapLfo = ctx.createOscillator()
    lapLfo.frequency.value = 0.11
    const lapLfoGain = ctx.createGain()
    lapLfoGain.gain.value = 0.011
    lapLfo.connect(lapLfoGain).connect(lapGain.gain)
    lapLfo.start()

    const lapLfo2 = ctx.createOscillator()
    lapLfo2.frequency.value = 0.27
    const lapLfo2Gain = ctx.createGain()
    lapLfo2Gain.gain.value = 0.006
    lapLfo2.connect(lapLfo2Gain).connect(lapGain.gain)
    lapLfo2.start()

    // Clear little ripples near the dock.
    const ripple = ctx.createBufferSource()
    ripple.buffer = this.noiseBuffer
    ripple.loop = true
    const rippleFilter = ctx.createBiquadFilter()
    rippleFilter.type = 'bandpass'
    rippleFilter.frequency.value = 1150
    rippleFilter.Q.value = 0.9
    const rippleGain = ctx.createGain()
    rippleGain.gain.value = 0.006
    ripple.connect(rippleFilter).connect(rippleGain).connect(ambient)
    ripple.start()

    // Air and pine needles.
    const wind = ctx.createBufferSource()
    wind.buffer = this.noiseBuffer
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 240
    const windGain = ctx.createGain()
    windGain.gain.value = 0.007
    wind.connect(windFilter).connect(windGain).connect(ambient)
    wind.start()

    // Rain layer, normally silent.
    const rainSource = ctx.createBufferSource()
    rainSource.buffer = this.noiseBuffer
    rainSource.loop = true
    const rainFilter = ctx.createBiquadFilter()
    rainFilter.type = 'highpass'
    rainFilter.frequency.value = 1700
    const rainGain = ctx.createGain()
    rainGain.gain.value = 0
    rainSource.connect(rainFilter).connect(rainGain).connect(ambient)
    rainSource.start()
    this.rainGain = rainGain

    // A faint electrical hum when the line is tight.
    const tensionOsc = ctx.createOscillator()
    tensionOsc.type = 'sine'
    tensionOsc.frequency.value = 190
    const tensionGain = ctx.createGain()
    tensionGain.gain.value = 0
    tensionOsc.connect(tensionGain).connect(ambient)
    tensionOsc.start()
    this.tensionOsc = tensionOsc
    this.tensionGain = tensionGain
  }

  setTension(value: number): void {
    if (!this.ctx || !this.tensionGain || !this.tensionOsc) return
    const clamped = Math.max(0, Math.min(1, value))
    const target = this.enabled && !this.paused ? clamped * clamped * 0.035 : 0
    this.tensionGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08)
    this.tensionOsc.frequency.setTargetAtTime(170 + clamped * 150, this.ctx.currentTime, 0.1)
  }

  private scheduleLoon(delay: number): void {
    if (this.loonTimer !== null) window.clearTimeout(this.loonTimer)
    this.loonTimer = window.setTimeout(() => {
      if (this.enabled && !this.paused) this.playLoon()
      const base = this.time === 'golden' ? 34_000 : 22_000
      this.scheduleLoon(base + Math.random() * 26_000)
    }, delay)
  }

  private scheduleBird(delay: number): void {
    if (this.birdTimer !== null) window.clearTimeout(this.birdTimer)
    this.birdTimer = window.setTimeout(() => {
      if (this.enabled && !this.paused && this.time !== 'night') this.playBird()
      this.scheduleBird(11_000 + Math.random() * 21_000)
    }, delay)
  }

  private playLoon(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.045, now + 0.5)
    gain.gain.linearRampToValueAtTime(0.03, now + 1.4)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 950
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.42
    const feedback = ctx.createGain()
    feedback.gain.value = 0.2
    gain.connect(filter).connect(master)
    gain.connect(delay).connect(feedback).connect(delay)
    delay.connect(filter)

    for (let i = 0; i < 2; i += 1) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(620 - i * 80, now)
      osc.frequency.linearRampToValueAtTime(470 - i * 55, now + 0.9)
      osc.frequency.linearRampToValueAtTime(540 - i * 60, now + 1.5)
      osc.frequency.linearRampToValueAtTime(390 - i * 40, now + 2.9)
      const detuneGain = ctx.createGain()
      detuneGain.gain.value = i === 0 ? 1 : 0.38
      osc.connect(detuneGain).connect(gain)
      osc.start(now)
      osc.stop(now + 3.3)
    }
  }

  private playBird(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const now = ctx.currentTime
    for (let i = 0; i < 3; i += 1) {
      const start = now + i * 0.16
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(2100 + Math.random() * 900, start)
      osc.frequency.exponentialRampToValueAtTime(3100 + Math.random() * 700, start + 0.09)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.012, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14)
      osc.connect(gain).connect(master)
      osc.start(start)
      osc.stop(start + 0.17)
    }
  }

  private noiseBurst(
    duration: number,
    volume: number,
    type: BiquadFilterType,
    frequency: number,
    endFrequency?: number,
  ): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuffer || !this.enabled || this.paused) return
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.playbackRate.value = 0.8 + Math.random() * 0.4
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(frequency, now)
    if (endFrequency !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(endFrequency, now + duration)
    }
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    source.connect(filter).connect(gain).connect(master)
    source.start(now)
    source.stop(now + duration + 0.05)
  }

  playCast(): void {
    this.noiseBurst(0.32, 0.035, 'bandpass', 500, 2400)
  }

  playSplash(power = 1): void {
    this.noiseBurst(0.45 + power * 0.2, 0.045 * Math.min(1.5, power), 'lowpass', 1800, 380)
    this.plop(0.35 * Math.min(1.2, power))
  }

  playBite(): void {
    this.plop(0.55)
    this.noiseBurst(0.18, 0.015, 'bandpass', 900, 500)
  }

  playSnap(): void {
    this.noiseBurst(0.16, 0.05, 'highpass', 1400, 2600)
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1150, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.16)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.05, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
    osc.connect(gain).connect(master)
    osc.start(now)
    osc.stop(now + 0.22)
  }

  playCatch(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.enabled || this.paused) return
    const now = ctx.currentTime
    const notes = [
      { f: 392, t: 0.0 },
      { f: 523.25, t: 0.16 },
      { f: 659.25, t: 0.34 },
    ]
    for (const note of notes) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = note.f
      const gain = ctx.createGain()
      const start = now + note.t
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.018, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1)
      osc.connect(gain).connect(master)
      osc.start(start)
      osc.stop(start + 1.15)
    }
  }

  private plop(volume: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.enabled || this.paused) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(360, now)
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.13)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.05 * volume, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    osc.connect(gain).connect(master)
    osc.start(now)
    osc.stop(now + 0.24)
  }

  setReel(active: boolean): void {
    if (active) {
      if (this.reelTimer !== null) return
      this.reelTimer = window.setInterval(() => this.playReelClick(), 56)
    } else if (this.reelTimer !== null) {
      window.clearInterval(this.reelTimer)
      this.reelTimer = null
    }
  }

  private playReelClick(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.enabled || this.paused) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 1750 + Math.random() * 160
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2100
    filter.Q.value = 2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.015, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022)
    osc.connect(filter).connect(gain).connect(master)
    osc.start(now)
    osc.stop(now + 0.03)
  }
}

export const audio = new LakeAudio()
