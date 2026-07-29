const DEFAULT_AUDIO_SETTINGS = {
  sound: true,
  music: true,
  vibration: true,
  stadium: true,
}

const AUDIO_RUNTIME_BASE = (typeof __DOUYIN_BUILD__ !== 'undefined' && __DOUYIN_BUILD__) ? './match-runtime-min' : '/match-runtime-min'

const MATCH_SAMPLE_ASSETS = Object.freeze({
  ballTouch: `${AUDIO_RUNTIME_BASE}/happyseed/audio/soccer-kick-cc0.mp3`,
  ballShot: `${AUDIO_RUNTIME_BASE}/happyseed/audio/soccer-kick-cc0.mp3`,
  goalCheer: `${AUDIO_RUNTIME_BASE}/happyseed/audio/crowd-cheer-cc0.mp3`,
  postHit: `${AUDIO_RUNTIME_BASE}/happyseed/audio/post-hit.mp3`,
  save: `${AUDIO_RUNTIME_BASE}/happyseed/audio/save.m4a`,
  cardWhistle: `${AUDIO_RUNTIME_BASE}/happyseed/audio/whistle.mp3`,
  periodWhistle: `${AUDIO_RUNTIME_BASE}/happyseed/audio/period-whistle.mp3`,
})

const CROWD_AMBIENT_ASSET = `${AUDIO_RUNTIME_BASE}/happyseed/audio/crowd-ambient.mp3`

const SOUND_PATTERNS = {
  ballTouch: [
    { f: 92, d: 0.045, v: 0.42, type: 'sine' },
    { f: 54, d: 0.07, v: 0.30, delay: 0.012, type: 'triangle' },
  ],
  ballShot: [
    { f: 78, d: 0.055, v: 0.52, type: 'sine' },
    { f: 42, d: 0.10, v: 0.34, delay: 0.015, type: 'triangle' },
  ],
  postHit: [
    { f: 1280, d: 0.055, v: 0.30, type: 'sine' },
    { f: 860, d: 0.12, v: 0.22, delay: 0.035, type: 'sine' },
  ],
  click: [
    { f: 620, d: 0.055, v: 0.32, type: 'square' },
    { f: 930, d: 0.075, v: 0.24, delay: 0.045, type: 'square' },
  ],
  decisionTick: [
    { f: 1180, d: 0.018, v: 0.12, type: 'square' },
    { f: 560, d: 0.026, v: 0.09, delay: 0.018, type: 'triangle' },
  ],
  confirm: [{ f: 520, d: 0.08, v: 0.30 }, { f: 780, d: 0.10, v: 0.28, delay: 0.07 }],
  back: [{ f: 520, d: 0.06, v: 0.24, type: 'triangle' }, { f: 330, d: 0.09, v: 0.22, delay: 0.055, type: 'triangle' }],
  goalNet: [{ f: 110, d: 0.16, v: 0.34, type: 'sawtooth' }, { f: 70, d: 0.18, v: 0.28, delay: 0.08 }],
  save: [
    { f: 155, d: 0.08, v: 0.40, type: 'triangle' },
    { f: 82, d: 0.14, v: 0.38, delay: 0.035, type: 'sawtooth' },
    { f: 610, d: 0.10, v: 0.25, delay: 0.105, type: 'square' },
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
  whistle: [
    { f: 2150, d: 0.18, v: 0.34, type: 'sine' },
    { f: 2460, d: 0.15, v: 0.22, delay: 0.025, type: 'sine' },
    { f: 1980, d: 0.16, v: 0.31, delay: 0.225, type: 'sine' },
    { f: 2330, d: 0.13, v: 0.20, delay: 0.245, type: 'sine' },
  ],
  periodWhistle: [
    { f: 2180, d: 0.56, v: 0.34, type: 'sine' },
    { f: 2520, d: 0.52, v: 0.18, delay: 0.018, type: 'sine' },
    { f: 2050, d: 0.18, v: 0.34, delay: 0.70, type: 'sine' },
    { f: 2380, d: 0.15, v: 0.19, delay: 0.72, type: 'sine' },
  ],
}

// 噪声类音效配置（更真实的纸张/盖章声）
const NOISE_SFX = {
  paperUnfold: { duration: 0.35, filterFreq: 3200, filterQ: 1.2, attack: 0.02, decay: 0.30, volume: 0.38 },
  stampHit: { duration: 0.18, filterFreq: 400, filterQ: 2.5, attack: 0.005, decay: 0.12, volume: 0.55, clickFreq: 1200 },
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
    this.musicVolume = 0.018
    this.musicTimer = null
    this.musicPlaying = false
    this.musicStep = 0
    this.userUnlocked = false
    this.matchSamples = {}
    this._activeMatchAudioNodes = new Set()
    this._activeMatchBufferSources = new Set()
    this._matchSoundTimers = new Set()
    this._rainNode = null
    this._rainRequested = false
    this._crowdNode = null
    this._crowdRequested = false
    this._crowdTimer = null
    this._musicSuspended = false
    this.stadiumEnabled = true
    this.buildSoundPlayers()
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
    this.preloadMatchSamples()
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
    this.stadiumEnabled = Boolean(merged.stadium)
    if (!this.soundEnabled && this._rainNode) this.stopRainAmbient({ preserveRequest: true })
    else if (this.soundEnabled && this._rainRequested && !this._rainNode) this.startRainAmbient()
    if ((!this.soundEnabled || !this.stadiumEnabled) && this._crowdNode) this.stopCrowdAmbient({ preserveRequest: true })
    else if (this.soundEnabled && this.stadiumEnabled && this._crowdRequested && !this._crowdNode) this.startCrowdAmbient()
    if (this._crowdNode) this._crowdNode.volume = Math.max(0, Math.min(1, this.soundVolume * 0.10))
    if (!this.musicEnabled) this.stopMusic()
    else if (this.userUnlocked && !this._musicSuspended) this.startMusic()
  }

  buildSoundPlayers() {
    Object.keys(SOUND_PATTERNS).forEach((name) => {
      this.sounds[name] = () => this.playPattern(SOUND_PATTERNS[name])
    })
    // 注册噪声类音效
    Object.keys(NOISE_SFX).forEach((name) => {
      this.sounds[name] = () => this.playNoiseSfx(name)
    })
  }

  /**
   * 播放基于滤波白噪声的音效（纸张沙沙声、盖章冲击声等）
   */
  playNoiseSfx(name) {
    const ctx = this.ensureSfxContext()
    if (!ctx) return false
    const cfg = NOISE_SFX[name]
    if (!cfg) return false

    const play = () => {
      const sampleRate = ctx.sampleRate
      const length = Math.ceil(sampleRate * cfg.duration)
      const buffer = ctx.createBuffer(1, length, sampleRate)
      const data = buffer.getChannelData(0)

      // 生成白噪声 + 包络
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate
        // 包络：快速 attack + 指数 decay
        const env = t < cfg.attack
          ? t / cfg.attack
          : Math.exp(-(t - cfg.attack) / (cfg.decay * 0.4))
        // 纸张声加入随机幅度调制模拟沙沙感
        const modulation = name === 'paperUnfold'
          ? (0.6 + 0.4 * Math.sin(t * 47) * Math.sin(t * 131))
          : 1.0
        data[i] = (Math.random() * 2 - 1) * env * modulation
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer

      // 带通滤波器塑形
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = cfg.filterFreq
      filter.Q.value = cfg.filterQ

      // 增益
      const gain = ctx.createGain()
      gain.gain.value = cfg.volume * this.soundVolume

      source.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      source.start()

      // 盖章声额外叠加一个短促的 click 瞬态
      if (cfg.clickFreq) {
        const clickLen = Math.ceil(sampleRate * 0.015)
        const clickBuf = ctx.createBuffer(1, clickLen, sampleRate)
        const clickData = clickBuf.getChannelData(0)
        for (let i = 0; i < clickLen; i++) {
          const t = i / sampleRate
          const clickEnv = Math.exp(-t / 0.004)
          clickData[i] = Math.sin(2 * Math.PI * cfg.clickFreq * t) * clickEnv
        }
        const clickSrc = ctx.createBufferSource()
        clickSrc.buffer = clickBuf
        const clickGain = ctx.createGain()
        clickGain.gain.value = 0.35 * this.soundVolume
        clickSrc.connect(clickGain)
        clickGain.connect(ctx.destination)
        clickSrc.start()
      }
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {})
      return true
    }
    play()
    return true
  }

  preloadMatchSamples() {
    // 互动空间包完全离线，且比赛音效使用本地合成音；编译时移除通用网络加载分支。
    if (__DOUYIN_BUILD__) return
    const ctx = this.ensureSfxContext()
    if (!ctx || typeof fetch !== 'function') return
    Object.entries(MATCH_SAMPLE_ASSETS).forEach(([name, url]) => {
      if (this.matchSamples[name]) return
      // 占位：表示正在加载
      this.matchSamples[name] = { buffer: null, loading: true }
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.arrayBuffer()
        })
        .then((raw) => ctx.decodeAudioData(raw))
        .then((decoded) => {
          this.matchSamples[name] = { buffer: decoded, loading: false }
        })
        .catch(() => {
          // 加载失败则移除记录，播放时静默
          this.matchSamples[name] = { buffer: null, loading: false }
        })
    })
  }

  prepareMatchAudio() {
    this.preloadMatchSamples()
    return Object.keys(this.matchSamples).length > 0
  }

  playMatchSample(name) {
    if (!this.userUnlocked) return false
    if (__DOUYIN_BUILD__) return this.playPackagedMatchSample(name)
    const entry = this.matchSamples[name]
    if (!entry) return false
    const ctx = this.ensureSfxContext()
    if (!ctx) return false
    // 音频尚未加载完成：静默（不回退废案合成音）
    if (!entry.buffer) return true
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const volumeScale = name === 'goalCheer' ? 0.78
      : name === 'cardWhistle' ? 0.72
      : name === 'periodWhistle' ? 0.80
      : 0.92
    const gain = ctx.createGain()
    gain.gain.value = Math.max(0, Math.min(1, this.soundVolume * volumeScale))
    gain.connect(ctx.destination)
    const source = ctx.createBufferSource()
    source.buffer = entry.buffer
    source.connect(gain)
    this._activeMatchBufferSources.add(source)
    source.onended = () => this._activeMatchBufferSources.delete(source)
    source.start(0)
    return true
  }

  playPackagedMatchSample(name) {
    const asset = MATCH_SAMPLE_ASSETS[name]
    if (!asset || typeof window === 'undefined' || typeof window.Audio !== 'function') return false
    const audio = new window.Audio(asset)
    const volumeScale = name === 'goalCheer' ? 0.78
      : name === 'cardWhistle' ? 0.72
      : name === 'periodWhistle' ? 0.80
      : 0.92
    audio.preload = 'auto'
    audio.volume = Math.max(0, Math.min(1, this.soundVolume * volumeScale))
    const release = () => this._activeMatchAudioNodes.delete(audio)
    audio.addEventListener('ended', release, { once: true })
    audio.addEventListener('error', release, { once: true })
    this._activeMatchAudioNodes.add(audio)
    const playback = audio.play()
    if (playback?.catch) playback.catch(release)
    return true
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
    // 有真实音频资源的音效：只走音频文件，不回退合成音
    if (MATCH_SAMPLE_ASSETS[name]) {
      return this.playMatchSample(name)
    }
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
      const timer = window.setTimeout(() => {
        this._matchSoundTimers.delete(timer)
        this.playSound('goalCheer')
      }, 180)
      this._matchSoundTimers.add(timer)
    }
    return net
  }
  playWin() { return this.playSound('win') }
  playLose() { return this.playSound('lose') }

  startMusic() {
    if (!this.musicEnabled || this.musicPlaying || this._musicSuspended) return false
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

  /** 比赛界面挂起像素风BGM，离开后恢复 */
  suspendMusic() {
    this._musicSuspended = true
    this.stopMusic()
  }

  resumeMusic() {
    this._musicSuspended = false
    if (this.musicEnabled && this.userUnlocked) this.startMusic()
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

  /* ---------- 观众背景音（22秒播放 + 随机间隔） ---------- */
  startCrowdAmbient() {
    this._crowdRequested = true
    if (this._crowdNode) return false
    if (!this.soundEnabled || !this.stadiumEnabled) return false
    if (typeof window === 'undefined' || typeof window.Audio !== 'function') return false

    const audio = new window.Audio(CROWD_AMBIENT_ASSET)
    audio.loop = false
    audio.preload = 'auto'
    audio.volume = Math.max(0, Math.min(1, this.soundVolume * 0.10))
    // 播放结束后随机等待3~7秒再播下一轮，模拟真实球场助威声波浪感
    audio.addEventListener('ended', () => {
      if (!this._crowdRequested || !this._crowdNode) return
      const gap = 3000 + Math.random() * 4000
      this._crowdTimer = window.setTimeout(() => {
        if (!this._crowdRequested || !this._crowdNode) return
        audio.currentTime = 0
        const p = audio.play()
        if (p?.catch) p.catch(() => {})
      }, gap)
    })
    const playback = audio.play()
    if (playback?.catch) playback.catch(() => {})
    this._crowdNode = audio
    return true
  }

  stopCrowdAmbient({ preserveRequest = false } = {}) {
    if (!preserveRequest) this._crowdRequested = false
    if (this._crowdTimer) {
      window.clearTimeout(this._crowdTimer)
      this._crowdTimer = null
    }
    if (!this._crowdNode) return false
    try {
      this._crowdNode.pause()
      this._crowdNode.currentTime = 0
    } catch { /* already stopped */ }
    this._crowdNode = null
    return true
  }

  /* ---------- 雨天环境音 ---------- */
  startRainAmbient() {
    this._rainRequested = true
    if (this._rainNode) return false
    if (!this.soundEnabled) return false
    const ctx = this.ensureSfxContext()
    if (!ctx) return false
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    // 以明亮的宽频雨幕为底，再混入短促水滴脉冲；避免旧棕噪声的闷、糊感。
    const seconds = 4
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let smoothed = 0
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1
      smoothed = smoothed * 0.58 + white * 0.42
      data[i] = white * 0.16 + smoothed * 0.24
    }

    const dropCount = seconds * 44
    for (let drop = 0; drop < dropCount; drop += 1) {
      const start = Math.floor(Math.random() * (data.length - 240))
      const length = 55 + Math.floor(Math.random() * 150)
      const strength = 0.16 + Math.random() * 0.24
      for (let i = 0; i < length; i += 1) {
        const envelope = Math.exp(-i / (length * 0.22))
        const transient = (Math.random() * 2 - 1) * strength * envelope
        data[start + i] = Math.max(-1, Math.min(1, data[start + i] + transient))
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    // 主雨幕保留中高频质感；并行高通层专门突出清脆雨滴。
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 620
    highpass.Q.value = 0.35
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 7600
    lowpass.Q.value = 0.15
    const bodyGain = ctx.createGain()
    bodyGain.gain.value = 0.042

    const sparkle = ctx.createBiquadFilter()
    sparkle.type = 'highpass'
    sparkle.frequency.value = 3900
    sparkle.Q.value = 0.45
    const sparkleGain = ctx.createGain()
    sparkleGain.gain.value = 0.018

    const outputGain = ctx.createGain()
    outputGain.gain.value = this.soundVolume
    source.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(bodyGain)
    bodyGain.connect(outputGain)
    source.connect(sparkle)
    sparkle.connect(sparkleGain)
    sparkleGain.connect(outputGain)
    outputGain.connect(ctx.destination)
    source.start()
    this._rainNode = { source, outputGain }
    return true
  }

  stopRainAmbient({ preserveRequest = false } = {}) {
    if (!preserveRequest) this._rainRequested = false
    if (!this._rainNode) return false
    try {
      this._rainNode.source.stop()
    } catch { /* already stopped */ }
    this._rainNode = null
    return true
  }

  /** 离开比赛页面时只清理比赛音频，不影响主菜单 BGM 和通用点击音。 */
  stopMatchAudio() {
    this.stopCrowdAmbient()
    this.stopRainAmbient()

    this._matchSoundTimers.forEach((timer) => window.clearTimeout(timer))
    this._matchSoundTimers.clear()

    this._activeMatchAudioNodes.forEach((audio) => {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch { /* already stopped */ }
    })
    this._activeMatchAudioNodes.clear()

    this._activeMatchBufferSources.forEach((source) => {
      try {
        source.stop(0)
      } catch { /* already stopped */ }
    })
    this._activeMatchBufferSources.clear()
  }
}

export const audioManager = new AudioManager()

export function initAudio(settings) {
  audioManager.init(settings)
}
