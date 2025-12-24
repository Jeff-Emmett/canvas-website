// Audio analysis utilities for speaker identification and voice activity detection

export interface VoiceCharacteristics {
  pitch: number
  volume: number
  spectralCentroid: number
  mfcc: number[] // Mel-frequency cepstral coefficients
  zeroCrossingRate: number
  energy: number
}

export interface SpeakerProfile {
  id: string
  name: string
  voiceCharacteristics: VoiceCharacteristics
  confidence: number
  lastSeen: number
  totalSpeakingTime: number
}

export interface AudioSegment {
  startTime: number
  endTime: number
  speakerId: string
  transcript: string
  confidence: number
  isFinal: boolean
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private dataArray: Float32Array | null = null
  private speakers: Map<string, SpeakerProfile> = new Map()
  private currentSpeakerId: string | null = null
  private lastVoiceActivity: number = 0
  private voiceActivityThreshold: number = 0.01
  private silenceTimeout: number = 2000 // 2 seconds of silence before considering speaker change

  constructor() {
    this.initializeAudioContext()
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.8
      
      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Float32Array(bufferLength)
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
    }
  }

  async connectMicrophone(stream: MediaStream): Promise<void> {
    if (!this.audioContext || !this.analyser) {
      await this.initializeAudioContext()
    }

    if (this.audioContext && this.analyser) {
      this.microphone = this.audioContext.createMediaStreamSource(stream)
      this.microphone.connect(this.analyser)
    }
  }

  analyzeVoiceCharacteristics(): VoiceCharacteristics | null {
    if (!this.analyser || !this.dataArray) {
      return null
    }

    this.analyser.getFloatTimeDomainData(this.dataArray as any)
    
    // Calculate basic audio features
    const pitch = this.calculatePitch()
    const volume = this.calculateVolume()
    const spectralCentroid = this.calculateSpectralCentroid()
    const mfcc = this.calculateMFCC()
    const zeroCrossingRate = this.calculateZeroCrossingRate()
    const energy = this.calculateEnergy()

    return {
      pitch,
      volume,
      spectralCentroid,
      mfcc,
      zeroCrossingRate,
      energy
    }
  }

  private calculatePitch(): number {
    if (!this.dataArray) return 0

    // Simple autocorrelation-based pitch detection
    const minPeriod = 20 // samples
    const maxPeriod = 200 // samples
    let bestPeriod = 0
    let bestCorrelation = 0

    for (let period = minPeriod; period < maxPeriod && period < this.dataArray.length / 2; period++) {
      let correlation = 0
      for (let i = 0; i < this.dataArray.length - period; i++) {
        correlation += this.dataArray[i] * this.dataArray[i + period]
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestPeriod = period
      }
    }

    // Convert period to frequency (assuming 44.1kHz sample rate)
    return bestPeriod > 0 ? 44100 / bestPeriod : 0
  }

  private calculateVolume(): number {
    if (!this.dataArray) return 0

    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += Math.abs(this.dataArray[i])
    }
    return sum / this.dataArray.length
  }

  private calculateSpectralCentroid(): number {
    if (!this.analyser || !this.dataArray) return 0

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(frequencyData)

    let weightedSum = 0
    let magnitudeSum = 0

    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = frequencyData[i]
      const frequency = (i * this.audioContext!.sampleRate) / (2 * frequencyData.length)
      weightedSum += frequency * magnitude
      magnitudeSum += magnitude
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0
  }

  private calculateMFCC(): number[] {
    // Simplified MFCC calculation - in a real implementation, you'd use a proper FFT
    // For now, return basic frequency domain features
    if (!this.analyser) return []

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(frequencyData)

    // Extract 13 MFCC-like coefficients by averaging frequency bands
    const mfcc = []
    const bandSize = Math.floor(frequencyData.length / 13)

    for (let i = 0; i < 13; i++) {
      let sum = 0
      const start = i * bandSize
      const end = Math.min(start + bandSize, frequencyData.length)
      
      for (let j = start; j < end; j++) {
        sum += frequencyData[j]
      }
      mfcc.push(sum / (end - start))
    }

    return mfcc
  }

  private calculateZeroCrossingRate(): number {
    if (!this.dataArray) return 0

    let crossings = 0
    for (let i = 1; i < this.dataArray.length; i++) {
      if ((this.dataArray[i] >= 0) !== (this.dataArray[i - 1] >= 0)) {
        crossings++
      }
    }
    return crossings / this.dataArray.length
  }

  private calculateEnergy(): number {
    if (!this.dataArray) return 0

    let energy = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      energy += this.dataArray[i] * this.dataArray[i]
    }
    return energy / this.dataArray.length
  }

  detectVoiceActivity(): boolean {
    const volume = this.calculateVolume()
    const isVoiceActive = volume > this.voiceActivityThreshold
    
    if (isVoiceActive) {
      this.lastVoiceActivity = Date.now()
    }
    
    return isVoiceActive
  }

  identifySpeaker(voiceCharacteristics: VoiceCharacteristics): string {
    let bestMatch: string | null = null
    let bestScore = 0
    const threshold = 0.7 // Minimum similarity threshold

    // Compare with existing speakers
    for (const [speakerId, profile] of this.speakers) {
      const similarity = this.calculateSimilarity(voiceCharacteristics, profile.voiceCharacteristics)
      if (similarity > bestScore && similarity > threshold) {
        bestScore = similarity
        bestMatch = speakerId
      }
    }

    // If no good match found, create new speaker
    if (!bestMatch) {
      const newSpeakerId = `speaker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newSpeaker: SpeakerProfile = {
        id: newSpeakerId,
        name: `Speaker ${this.speakers.size + 1}`,
        voiceCharacteristics,
        confidence: 0.8,
        lastSeen: Date.now(),
        totalSpeakingTime: 0
      }
      this.speakers.set(newSpeakerId, newSpeaker)
      bestMatch = newSpeakerId
    } else {
      // Update existing speaker profile
      const speaker = this.speakers.get(bestMatch)!
      speaker.lastSeen = Date.now()
      speaker.confidence = Math.min(1.0, speaker.confidence + 0.1)
      
      // Update voice characteristics with weighted average
      const weight = 0.1
      speaker.voiceCharacteristics = {
        pitch: speaker.voiceCharacteristics.pitch * (1 - weight) + voiceCharacteristics.pitch * weight,
        volume: speaker.voiceCharacteristics.volume * (1 - weight) + voiceCharacteristics.volume * weight,
        spectralCentroid: speaker.voiceCharacteristics.spectralCentroid * (1 - weight) + voiceCharacteristics.spectralCentroid * weight,
        mfcc: speaker.voiceCharacteristics.mfcc.map((val, i) => 
          val * (1 - weight) + (voiceCharacteristics.mfcc[i] || 0) * weight
        ),
        zeroCrossingRate: speaker.voiceCharacteristics.zeroCrossingRate * (1 - weight) + voiceCharacteristics.zeroCrossingRate * weight,
        energy: speaker.voiceCharacteristics.energy * (1 - weight) + voiceCharacteristics.energy * weight
      }
    }

    return bestMatch
  }

  private calculateSimilarity(voice1: VoiceCharacteristics, voice2: VoiceCharacteristics): number {
    // Calculate weighted similarity between voice characteristics
    const pitchSimilarity = 1 - Math.abs(voice1.pitch - voice2.pitch) / Math.max(voice1.pitch, voice2.pitch, 1)
    const volumeSimilarity = 1 - Math.abs(voice1.volume - voice2.volume) / Math.max(voice1.volume, voice2.volume, 0.001)
    const spectralSimilarity = 1 - Math.abs(voice1.spectralCentroid - voice2.spectralCentroid) / Math.max(voice1.spectralCentroid, voice2.spectralCentroid, 1)
    const zcrSimilarity = 1 - Math.abs(voice1.zeroCrossingRate - voice2.zeroCrossingRate) / Math.max(voice1.zeroCrossingRate, voice2.zeroCrossingRate, 0.001)
    const energySimilarity = 1 - Math.abs(voice1.energy - voice2.energy) / Math.max(voice1.energy, voice2.energy, 0.001)

    // MFCC similarity (simplified)
    let mfccSimilarity = 0
    if (voice1.mfcc.length === voice2.mfcc.length) {
      let sum = 0
      for (let i = 0; i < voice1.mfcc.length; i++) {
        sum += 1 - Math.abs(voice1.mfcc[i] - voice2.mfcc[i]) / Math.max(voice1.mfcc[i], voice2.mfcc[i], 1)
      }
      mfccSimilarity = sum / voice1.mfcc.length
    }

    // Weighted average of similarities
    return (
      pitchSimilarity * 0.2 +
      volumeSimilarity * 0.15 +
      spectralSimilarity * 0.2 +
      zcrSimilarity * 0.15 +
      energySimilarity * 0.15 +
      mfccSimilarity * 0.15
    )
  }

  detectSpeakerChange(): boolean {
    const now = Date.now()
    const timeSinceLastActivity = now - this.lastVoiceActivity
    
    // If there's been silence for a while, consider it a potential speaker change
    return timeSinceLastActivity > this.silenceTimeout
  }

  getCurrentSpeaker(): SpeakerProfile | null {
    if (!this.currentSpeakerId) return null
    return this.speakers.get(this.currentSpeakerId) || null
  }

  getAllSpeakers(): SpeakerProfile[] {
    return Array.from(this.speakers.values())
  }

  updateSpeakerName(speakerId: string, name: string): void {
    const speaker = this.speakers.get(speakerId)
    if (speaker) {
      speaker.name = name
    }
  }

  getSpeakerById(speakerId: string): SpeakerProfile | null {
    return this.speakers.get(speakerId) || null
  }

  cleanup(): void {
    if (this.microphone) {
      this.microphone.disconnect()
      this.microphone = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.analyser = null
    this.dataArray = null
  }
}

// Global audio analyzer instance
export const audioAnalyzer = new AudioAnalyzer()
