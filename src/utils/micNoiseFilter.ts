// Active Cabin Ambient Noise Suppression & Voice Clarity Pipeline
// Uses WebRTC Hardware DSP (echoCancellation, noiseSuppression, autoGainControl)
// paired with a Web Audio Voice Bandpass Filter (120Hz–3800Hz) to attenuate
// engine rumble, road vibration, and wind hiss inside the BMW 728Li cabin.

export interface MicNoiseFilterStatus {
  active: boolean;
  hardwareNoiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  voiceLevel: number; // 0..100
}

class CabinMicNoiseController {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private spectrumBuffer: Uint8Array<ArrayBuffer> | null = null;
  private levelTimer: number | null = null;
  private activeCount = 0;

  private status: MicNoiseFilterStatus = {
    active: false,
    hardwareNoiseSuppression: false,
    echoCancellation: false,
    autoGainControl: false,
    voiceLevel: 0,
  };

  private listeners = new Set<(s: MicNoiseFilterStatus) => void>();

  public subscribe(cb: (s: MicNoiseFilterStatus) => void): () => void {
    this.listeners.add(cb);
    cb({ ...this.status });
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit() {
    for (const cb of this.listeners) {
      try {
        cb({ ...this.status });
      } catch {}
    }
  }

  public async acquireNoiseFilter(): Promise<MicNoiseFilterStatus> {
    this.activeCount += 1;
    if (this.stream) {
      this.emit();
      return { ...this.status };
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return { ...this.status };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      this.stream = stream;

      const track = stream.getAudioTracks()[0];
      const settings = track?.getSettings?.() || {};

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.audioCtx = ctx;
        const source = ctx.createMediaStreamSource(stream);

        // 1. Cut low-frequency engine, exhaust, and road tire rumble below 120Hz
        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 120;
        highpass.Q.value = 0.8;

        // 2. Cut high-frequency wind hiss & cabin rattle above 3800Hz
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 3800;
        lowpass.Q.value = 0.7;

        // 3. Dynamic voice compressor for consistent speech clarity
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 18;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.15;

        // 4. Silence-connected AnalyserNode (no loopback speakers to avoid feedback)
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        this.analyser = analyser;

        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;

        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(compressor);
        compressor.connect(analyser);
        analyser.connect(silentGain);
        silentGain.connect(ctx.destination);

        const data = new Uint8Array(analyser.frequencyBinCount);
        this.levelTimer = window.setInterval(() => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(data);
          // Focus on speech band bins (approx 150Hz - 3500Hz)
          let sum = 0;
          const startBin = 2;
          const endBin = Math.min(data.length, 46);
          for (let i = startBin; i < endBin; i++) {
            sum += data[i];
          }
          const avg = sum / Math.max(1, endBin - startBin);
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          if (normalized !== this.status.voiceLevel) {
            this.status.voiceLevel = normalized;
            this.emit();
          }
        }, 90);
      }

      this.status = {
        active: true,
        hardwareNoiseSuppression: settings.noiseSuppression !== false,
        echoCancellation: settings.echoCancellation !== false,
        autoGainControl: settings.autoGainControl !== false,
        voiceLevel: 0,
      };
      this.emit();
      return { ...this.status };
    } catch {
      return { ...this.status };
    }
  }

  public releaseNoiseFilter() {
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (this.activeCount > 0) return;

    if (this.levelTimer !== null) {
      window.clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      void this.audioCtx?.close();
    } catch {}
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.spectrumBuffer = null;
    this.status = {
      active: false,
      hardwareNoiseSuppression: false,
      echoCancellation: false,
      autoGainControl: false,
      voiceLevel: 0,
    };
    this.emit();
  }

  public sampleSpectrumBands(bandCount = 15): number[] | null {
    if (!this.analyser || !this.status.active || bandCount <= 0) {
      return null;
    }

    const binCount = this.analyser.frequencyBinCount;
    if (!this.spectrumBuffer || this.spectrumBuffer.length !== binCount) {
      this.spectrumBuffer = new Uint8Array(binCount);
    }

    this.analyser.getByteFrequencyData(this.spectrumBuffer);

    // Speech frequency range (approx 150Hz–3600Hz) maps to bins 2..46
    const startBin = 2;
    const endBin = Math.min(binCount, 46);
    const usableBins = Math.max(1, endBin - startBin);
    const bands = new Array<number>(bandCount);

    for (let b = 0; b < bandCount; b++) {
      const from = startBin + Math.floor((b * usableBins) / bandCount);
      const to = Math.max(from + 1, startBin + Math.floor(((b + 1) * usableBins) / bandCount));
      let sum = 0;
      for (let k = from; k < to; k++) {
        sum += this.spectrumBuffer[k];
      }
      const avg = sum / Math.max(1, to - from);
      bands[b] = Math.min(1, avg / 160);
    }

    return bands;
  }
}

export const cabinMicNoiseFilter = new CabinMicNoiseController();
