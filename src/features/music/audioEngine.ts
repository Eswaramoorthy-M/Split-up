/**
 * Tiny offline synth used for demo playback. It produces a gentle arpeggio
 * unique to each track (seed/tempo) so the player controls are real without
 * shipping large audio files or relying on a third-party stream.
 */
export class MusicAudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private timer: number | null = null
  private active: OscillatorNode[] = []
  private step = 0
  private seed = 1
  private tempo = 90

  async start(seed: number, tempo: number, volume: number) {
    this.stop()
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    if (!this.context) this.context = new AudioCtor()
    if (this.context.state === 'suspended') {
      try { await this.context.resume() } catch { /* browser can still block; controls remain usable */ }
    }

    const master = this.context.createGain()
    master.gain.value = 0.0001
    master.connect(this.context.destination)
    this.master = master
    this.seed = seed
    this.tempo = tempo
    this.step = 0
    this.setVolume(volume)
    this.schedule()
    const interval = Math.max(130, (60 / tempo) * 1000 / 2)
    this.timer = window.setInterval(() => this.schedule(), interval)
  }

  private schedule() {
    const ctx = this.context
    if (!ctx || !this.master || ctx.state !== 'running') return

    const beat = 60 / this.tempo
    const now = ctx.currentTime + 0.02
    const scale = [0, 3, 5, 7, 10, 12, 15, 17]
    const index = (this.step + this.seed) % scale.length
    const lift = Math.floor(this.step / scale.length) % 2 === 0 ? 0 : 12
    const rootHz = 110 * Math.pow(2, (this.seed % 5) / 12)
    const freq = rootHz * Math.pow(2, (scale[index] + lift) / 12)

    this.tone(freq, now, beat * 0.85, 'triangle', 0.22)
    if (this.step % 4 === 0) this.tone(rootHz / 2, now, beat * 1.6, 'sine', 0.34)
    if (this.step % 3 === 0) this.tone(freq * 2, now, beat * 0.4, 'sine', 0.06)
    this.step++
  }

  private tone(frequency: number, when: number, length: number, type: OscillatorType, level: number) {
    const ctx = this.context
    const master = this.master
    if (!ctx || !master) return

    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, when)
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(level, when + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(when)
    oscillator.stop(when + length + 0.02)
    this.active.push(oscillator)
    oscillator.onended = () => {
      this.active = this.active.filter(node => node !== oscillator)
      gain.disconnect()
    }
  }

  setVolume(volume: number) {
    const master = this.master
    const ctx = this.context
    if (!master || !ctx) return
    const level = Math.max(0.0001, Math.min(1, volume)) * 0.16
    master.gain.setTargetAtTime(level, ctx.currentTime, 0.05)
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.active.forEach(node => {
      try { node.stop() } catch { /* already stopped */ }
    })
    this.active = []
    if (this.master) {
      this.master.disconnect()
      this.master = null
    }
  }

  dispose() {
    this.stop()
    if (this.context) {
      void this.context.close().catch(() => undefined)
      this.context = null
    }
  }
}
