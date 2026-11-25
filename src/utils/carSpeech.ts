// In-Car Audio & Neural Persian Speech Voice Synthesizer Utility

class CarAudioController {
  private ctx: AudioContext | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentBufferSource: AudioBufferSourceNode | null = null;
  public enabled: boolean = true;
  public isSpeaking: boolean = false;
  public mrtAudioEngineActive: boolean = true;
  private onSpeakingStateChangeCallbacks: Set<(speaking: boolean) => void> = new Set();
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private clientTtsCache: Map<string, { base64: string; mimeType: string }> = new Map();
  private audioUnlocked = false;

  public onSpeakingChange(cb: (speaking: boolean) => void): () => void {
    this.onSpeakingStateChangeCallbacks.add(cb);
    return () => {
      this.onSpeakingStateChangeCallbacks.delete(cb);
    };
  }

  private setSpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
    this.onSpeakingStateChangeCallbacks.forEach((cb) => {
      try {
        cb(speaking);
      } catch {}
    });
  }

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  // Unlock browser WebAudio & SpeechSynthesis cleanly on the first user tap/key
  public unlockAudio() {
    this.initCtx();
    if (this.audioUnlocked || typeof window === "undefined") return;
    this.audioUnlocked = true;
    try {
      if ("speechSynthesis" in window) {
        this.cachedVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.resume?.();
      }
    } catch {}
  }

  // Soft subtle BMW tactile iDrive click
  public playButtonTap() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(950, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.025);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.025);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.025);
    } catch {}
  }

  // Iconic BMW iDrive Acoustic Gong / Chime
  public playBmwGong() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const frequencies = [739.99, 1108.73];
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.12, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.6);
      });
    } catch {}
  }

  // BMW Acoustic Lock / Chirp
  public playLockBeep(locked: boolean) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = locked ? 1760 : 1320;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  // BMW Blinker / Indicator Tick
  public playHazardTick(active: boolean) {
    if (!this.enabled || !active) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1550, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } catch {}
  }

  // BMW Intelligent Assistant Wake Tone
  public playAssistantWakeChime() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.setValueAtTime(987.77, now + 0.09); // B5

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.51, now + 0.09); // E6

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.09);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch {}
  }

  private speechKeepAliveTimer: any = null;

  public stopSpeaking() {
    if (this.speechKeepAliveTimer) {
      clearInterval(this.speechKeepAliveTimer);
      this.speechKeepAliveTimer = null;
    }
    try {
      if (this.currentAudioElement) {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement = null;
      }
      if (this.currentBufferSource) {
        this.currentBufferSource.stop();
        this.currentBufferSource.disconnect();
        this.currentBufferSource = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    this.setSpeaking(false);
  }

  private async playBase64ViaWebAudio(base64: string): Promise<boolean> {
    try {
      this.initCtx();
      if (!this.ctx) return false;
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      const pureBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
      const binary = atob(pureBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const audioBuffer = await this.ctx.decodeAudioData(bytes.buffer.slice(0));
      return await new Promise<boolean>((resolve) => {
        try {
          const source = this.ctx!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.ctx!.destination);
          this.currentBufferSource = source;
          this.setSpeaking(true);
          source.onended = () => {
            this.currentBufferSource = null;
            this.setSpeaking(false);
            resolve(true);
          };
          source.start(0);
        } catch {
          this.currentBufferSource = null;
          this.setSpeaking(false);
          resolve(false);
        }
      });
    } catch {
      this.setSpeaking(false);
      return false;
    }
  }

  // Play Audio from server Base64 (MP3 or WAV) with WebAudio AudioContext fallback
  public async playBase64Audio(
    base64: string,
    mimeType: string = "audio/wav"
  ): Promise<boolean> {
    if (!this.enabled || !base64) return false;
    this.stopSpeaking();

    const playedHtml = await new Promise<boolean>((resolve) => {
      try {
        const cleanMime = mimeType === "audio/mp3" ? "audio/mp3" : "audio/wav";
        const audioSrc = base64.startsWith("data:")
          ? base64
          : `data:${cleanMime};base64,${base64}`;
        const audio = new Audio(audioSrc);
        this.currentAudioElement = audio;
        this.setSpeaking(true);

        audio.onended = () => {
          this.setSpeaking(false);
          this.currentAudioElement = null;
          resolve(true);
        };

        audio.onerror = () => {
          this.setSpeaking(false);
          this.currentAudioElement = null;
          resolve(false);
        };

        audio.play().catch((err) => {
          console.warn("Audio play fallback to WebAudio:", err);
          this.setSpeaking(false);
          this.currentAudioElement = null;
          resolve(false);
        });
      } catch {
        this.setSpeaking(false);
        resolve(false);
      }
    });

    if (playedHtml) return true;
    return this.playBase64ViaWebAudio(base64);
  }

  private async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    if (this.cachedVoices.length > 0) return this.cachedVoices;

    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length > 0) {
      this.cachedVoices = immediate;
      return immediate;
    }

    return new Promise((resolveVoices) => {
      let done = false;
      const finishVoices = () => {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener?.("voiceschanged", finishVoices);
        const loaded = window.speechSynthesis.getVoices();
        if (loaded.length > 0) this.cachedVoices = loaded;
        resolveVoices(loaded);
      };
      window.speechSynthesis.addEventListener?.("voiceschanged", finishVoices);
      window.setTimeout(finishVoices, 260);
    });
  }

  private findPersianBrowserVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
    return voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith("fa") ||
        v.lang.toLowerCase().includes("fa-ir") ||
        v.name.toLowerCase().includes("persian") ||
        v.name.toLowerCase().includes("farsi")
    );
  }

  private async speakViaBrowserFa(
    text: string,
    faVoice?: SpeechSynthesisVoice
  ): Promise<boolean> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let started = false;
      let fallbackTimer: number | null = null;
      let startGuardTimer: number | null = null;
      let speakDelayTimer: number | null = null;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (speakDelayTimer !== null) window.clearTimeout(speakDelayTimer);
        if (startGuardTimer !== null) window.clearTimeout(startGuardTimer);
        if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
        if (this.speechKeepAliveTimer) {
          clearInterval(this.speechKeepAliveTimer);
          this.speechKeepAliveTimer = null;
        }
        this.setSpeaking(false);
        resolve(ok);
      };

      try {
        this.stopSpeaking();
        const clean = text.replace(/[*_#`]/g, "").trim();
        if (!clean) {
          finish(true);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = faVoice?.lang || "fa-IR";
        if (faVoice) utterance.voice = faVoice;
        utterance.rate = 0.98;
        utterance.pitch = 1.0;

        const maxWaitMs = Math.min(28000, Math.max(3800, clean.length * 140));
        fallbackTimer = window.setTimeout(() => finish(started), maxWaitMs);

        startGuardTimer = window.setTimeout(() => {
          if (!started && !window.speechSynthesis.speaking) {
            try {
              window.speechSynthesis.cancel();
            } catch {}
            finish(false);
          }
        }, 900);

        this.setSpeaking(true);
        utterance.onstart = () => {
          started = true;
          this.setSpeaking(true);
        };
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);

        this.speechKeepAliveTimer = window.setInterval(() => {
          try {
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
            }
          } catch {}
        }, 3000);

        speakDelayTimer = window.setTimeout(() => {
          try {
            window.speechSynthesis.resume?.();
            window.speechSynthesis.speak(utterance);
          } catch {
            finish(false);
          }
        }, 50);
      } catch {
        finish(false);
      }
    });
  }

  private rememberClientAudio(text: string, base64: string, mimeType: string) {
    const key = text.trim();
    if (!key || !base64) return;
    this.clientTtsCache.set(key, { base64, mimeType });
    if (this.clientTtsCache.size > 40) {
      const oldest = this.clientTtsCache.keys().next().value;
      if (oldest) this.clientTtsCache.delete(oldest);
    }
  }

  // Speak crystal-clear Persian text:
  // 1) Neural server audio (OpenAI / Gemini / Piper fa_IR-amir-medium) ->
  // 2) Client cached Neural audio or /api/tts Neural Piper Persian voice ->
  // 3) Native OS browser fa-IR voice fallback when truly offline
  public async speak(
    text: string,
    serverAudioBase64?: string | null,
    serverAudioMimeType: string = "audio/wav",
    serverAudioSource?: "neural" | "local-fa" | string
  ): Promise<void> {
    if (!this.enabled || !text) return;
    const key = text.trim();

    // 1. Server neural audio attached directly (OpenAI, Gemini, EdgeTTS, or Piper Persian VITS)
    if (serverAudioBase64 && serverAudioSource === "neural") {
      this.rememberClientAudio(key, serverAudioBase64, serverAudioMimeType);
      const success = await this.playBase64Audio(serverAudioBase64, serverAudioMimeType);
      if (success) return;
    }

    // 2. Client cached audio for instant zero-latency greetings/confirmations
    const cached = this.clientTtsCache.get(key);
    if (cached) {
      const success = await this.playBase64Audio(cached.base64, cached.mimeType);
      if (success) return;
    }

    // 3. Fetch server Neural Persian voice (/api/tts -> Piper fa_IR-amir-medium) when reachable
    const isNavigatorOnline = typeof navigator === "undefined" || navigator.onLine !== false;
    if (isNavigatorOnline) {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 12000);
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ text: key }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.audioBase64) {
              const mime = data.audioMimeType || "audio/wav";
              if (data.ttsSource === "neural") {
                this.rememberClientAudio(key, data.audioBase64, mime);
              }
              const success = await this.playBase64Audio(data.audioBase64, mime);
              if (success) return;
            }
          }
        } finally {
          window.clearTimeout(timeoutId);
        }
      } catch (err) {
        console.warn("TTS API fetch warning:", err);
      }
    }

    // 4. Play any attached fallback audio if present
    if (serverAudioBase64) {
      const success = await this.playBase64Audio(serverAudioBase64, serverAudioMimeType);
      if (success) return;
    }

    // 5. Offline OS/browser Persian synthesis fallback
    const voices = await this.getAvailableVoices();
    const faVoice = this.findPersianBrowserVoice(voices);
    await this.speakViaBrowserFa(key, faVoice);
  }
}

export const carAudio = new CarAudioController();

export function stopSpeaking() {
  carAudio.stopSpeaking();
}

export function speakText(
  text: string,
  serverAudioBase64?: string | null,
  serverAudioMimeType: string = "audio/wav",
  serverAudioSource?: "neural" | "local-fa" | string
) {
  return carAudio.speak(text, serverAudioBase64, serverAudioMimeType, serverAudioSource);
}

export function calculateSpeedVolumeBoost(speedKmH: number = 0) {
  if (speedKmH <= 40) {
    return { gainMultiplier: 1.0, roadNoiseDbCompensation: 0 };
  } else if (speedKmH <= 80) {
    return { gainMultiplier: 1.15, roadNoiseDbCompensation: 2 };
  } else if (speedKmH <= 110) {
    return { gainMultiplier: 1.3, roadNoiseDbCompensation: 4 };
  } else {
    return { gainMultiplier: 1.45, roadNoiseDbCompensation: 6 };
  }
}
