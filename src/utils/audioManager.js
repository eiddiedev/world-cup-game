const DEFAULT_AUDIO_SETTINGS = {
  sound: true,
  music: true,
  vibration: true,
}

const SOUND_PATTERNS = {
  click: [
    { f: 620, d: 0.055, v: 0.32, type: 'square' },
    { f: 930, d: 0.075, v: 0.24, delay: 0.045, type: 'square' },
  ],
  confirm: [{ f: 520, d: 0.08, v: 0.30 }, { f: 780, d: 0.10, v: 0.28, delay: 0.07 }],
  back: [{ f: 520, d: 0.06, v: 0.24, type: 'triangle' }, { f: 330, d: 0.09, v: 0.22, delay: 0.055, type: 'triangle' }],
  goalNet: [{ f: 110, d: 0.16, v: 0.34, type: 'sawtooth' }, { f: 70, d: 0.18, v: 0.28, delay: 0.08 }],
  save: [
    { f: 180, d: 0.06, v: 0.30, type: 'triangle' },
    { f: 95, d: 0.10, v: 0.34, delay: 0.04, type: 'sawtooth' },
    { f: 520, d: 0.08, v: 0.20, delay: 0.11, type: 'square' },
  ],
  goalCheer: [
    { f: 523, d: 0.14, v: 0.24, delay: 0.02 },
    { f: 659, d: 0.14, v: 0.24, delay: 0.15 },
    { f: 784, d: 0.24, v: 0.28, delay: 0.28 },
  ],
  opponentGoal: [{ f: 320, d: 0.20, v: 0.28, type: 'triangle' }, { f: 190, d: 0.28, v: 0.26, delay: 0.15 }],
  win: [
    { f: 523, d: 0.14, v: 0.28 },
    { f: 659, d: 0.14, v: 0.28, delay: 0.13 },
    { f: 784, d: 0.20, v: 0.30, delay: 0.27 },
    { f: 1046, d: 0.28, v: 0.28, delay: 0.48 },
  ],
  lose: [
    { f: 392, d: 0.18, v: 0.26 },
    { f: 294, d: 0.22, v: 0.26, delay: 0.18 },
    { f: 196, d: 0.30, v: 0.24, delay: 0.40 },
  ],
  card: [{ f: 900, d: 0.08, v: 0.28, type: 'square' }, { f: 900, d: 0.08, v: 0.28, delay: 0.12, type: 'square' }],
  substitution: [{ f: 440, d: 0.08, v: 0.24 }, { f: 660, d: 0.09, v: 0.26, delay: 0.09 }],
  whistle: [{ f: 1200, d: 0.22, v: 0.24, type: 'square' }],
}

const MUSIC_NOTES = [262, 330, 392, 330, 294, 370, 440, 370, 330, 392, 494, 392, 349, 440, 523, 440]

export class AudioManager {
  constructor() {
    this.audioContext = null
    this.sfxContext = null
    this.musicContext = null
    this.masterGain = null
    this.musicGain = null
    this.sounds = {}
    this.soundEnabled = true
    this.musicEnabled = true
    this.vibrationEnabled = true
    this.soundVolume = 0.95
    this.musicVolume = 0.035
    this.musicTimer = null
    this.musicPlaying = false
    this.musicStep = 0
    this.userUnlocked = false
  }

  init(settings = DEFAULT_AUDIO_SETTINGS) {
    this.applySettings(settings)
    this.buildSoundPlayers()
  }

  getAudioContextCtor() {
    if (typeof window === 'undefined') return null
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    return AudioContextCtor || null
  }

  ensureSfxContext() {
    if (this.sfxContext) return this.sfxContext
    const AudioContextCtor = this.getAudioContextCtor()
    if (!AudioContextCtor) return null
    this.sfxContext = new AudioContextCtor()
    this.audioContext = this.sfxContext
    return this.sfxContext
  }

  ensureMusicContext() {
    if (this.musicContext) return this.musicContext
    const AudioContextCtor = this.getAudioContextCtor()
    if (!AudioContextCtor) return null
    this.musicContext = new AudioContextCtor()
    this.masterGain = this.musicContext.createGain()
    this.musicGain = this.musicContext.createGain()
    this.masterGain.gain.value = 1
    this.musicGain.gain.value = 1
    this.musicGain.connect(this.masterGain)
    this.masterGain.connect(this.musicContext.destination)
    return this.musicContext
  }

  unlock() {
    this.userUnlocked = true
    const sfxCtx = this.ensureSfxContext()
    if (sfxCtx?.state === 'suspended') sfxCtx.resume().catch(() => {})
    const musicCtx = this.musicEnabled ? this.ensureMusicContext() : null
    if (musicCtx?.state === 'suspended') musicCtx.resume().catch(() => {})
    if (this.musicEnabled && !this.musicPlaying) this.startMusic()
  }

  applySettings(settings = {}) {
    const merged = { ...DEFAULT_AUDIO_SETTINGS, ...settings }
    this.soundEnabled = Boolean(merged.sound)
    this.musicEnabled = Boolean(merged.music)
    this.vibrationEnabled = Boolean(merged.vibration)
    if (!this.musicEnabled) this.stopMusic()
    else if (this.userUnlocked) this.startMusic()
  }

  buildSoundPlayers() {
    Object.keys(SOUND_PATTERNS).forEach((name) => {
      this.sounds[name] = () => this.playPattern(SOUND_PATTERNS[name])
    })
  }

  playPattern(pattern) {
    const ctx = this.ensureSfxContext()
    if (!ctx) return false
    const buffer = this.createPatternBuffer(pattern, ctx)
    const playBuffer = () => {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      // 音效沿用旧版的直连输出路径，避免被 BGM 分轨或增益状态吞掉。
      source.connect(ctx.destination)
      source.start()
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(playBuffer).catch(() => {})
      return true
    }
    playBuffer()
    return true
  }

  createPatternBuffer(pattern, ctx) {
    const totalSeconds = Math.max(...pattern.map(note => (note.delay || 0) + note.d)) + 0.04
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * totalSeconds), ctx.sampleRate)
    const data = buffer.getChannelData(0)

    pattern.forEach((note) => {
      const startIndex = Math.floor((note.delay || 0) * ctx.sampleRate)
      const length = Math.floor(note.d * ctx.sampleRate)
      for (let i = 0; i < length; i += 1) {
        const t = i / ctx.sampleRate
        const phase = (t * note.f) % 1
        const attack = Math.min(1, t / 0.012)
        const release = Math.max(0, 1 - (i / length))
        const env = attack * release
        const wave = this.getWaveSample(note.type || 'square', phase)
        const index = startIndex + i
        data[index] = Math.max(-1, Math.min(1, data[index] + wave * note.v * this.soundVolume * env))
      }
    })
    return buffer
  }

  getWaveSample(type, phase) {
    if (type === 'triangle') return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25))
    if (type === 'sawtooth') return 2 * phase - 1
    if (type === 'sine') return Math.sin(2 * Math.PI * phase)
    return phase < 0.5 ? 1 : -1
  }

  playSound(name) {
    if (!this.soundEnabled) return false
    const ctx = this.ensureSfxContext()
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
    const sound = this.sounds[name]
    if (!sound) return false
    sound()
    return true
  }

  playClick() { return this.playSound('click') }
  playSave() { return this.playSound('save') }
  playGoal() {
    const net = this.playSound('goalNet')
    if (typeof window !== 'undefined') {
      window.setTimeout(() => this.playSound('goalCheer'), 180)
    }
    return net
  }
  playWin() { return this.playSound('win') }
  playLose() { return this.playSound('lose') }

  startMusic() {
    if (!this.musicEnabled || this.musicPlaying) return false
    const ctx = this.ensureMusicContext()
    if (!ctx || !this.musicGain) return false
    this.musicPlaying = true
    this.musicTimer = window.setInterval(() => this.playMusicStep(), 260)
    return true
  }

  stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer)
    this.musicTimer = null
    this.musicPlaying = false
  }

  toggleMusic(force) {
    const enabled = typeof force === 'boolean' ? force : !this.musicEnabled
    this.applySettings({ sound: this.soundEnabled, music: enabled, vibration: this.vibrationEnabled })
    return this.musicEnabled
  }

  playMusicStep() {
    if (!this.musicEnabled) return
    const ctx = this.ensureMusicContext()
    if (!ctx || !this.musicGain) return
    const note = MUSIC_NOTES[this.musicStep % MUSIC_NOTES.length]
    this.musicStep += 1
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = this.musicStep % 4 === 0 ? 'triangle' : 'square'
    osc.frequency.setValueAtTime(note, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(this.musicVolume, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    osc.connect(gain)
    gain.connect(this.musicGain)
    osc.start(now)
    osc.stop(now + 0.16)
  }

  vibrate(pattern = 16) {
    if (!this.vibrationEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return false
    navigator.vibrate(pattern)
    return true
  }
}

export const audioManager = new AudioManager()

export function initAudio(settings) {
  audioManager.init(settings)
}
