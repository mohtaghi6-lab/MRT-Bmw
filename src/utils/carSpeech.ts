// In-Car Audio & Neural Speech Voice Synthesizer Utility (MRT Enhanced Audio Engine)

class CarAudioController {
  private ctx: AudioContext | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  public enabled: boolean = true;
  public isSpeaking: boolean = false;
  public mrtAudioEngineActive: boolean = true; // MRT Mode flag
  private onSpeakingStateChangeCallbacks: Array<(speaking: boolean) => void> = [];

  public onSpeakingChange(cb: (speaking: boolean) => void) {
    this.onSpeakingStateChangeCallbacks.push(cb);
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
      // BMW harmonic chord: F#5 (739.99 Hz) & C#6 (1108.73 Hz)
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
      const freq = locked ? 1760 : 1320; // A6 or E6 high chirp
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
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    this.setSpeaking(false);
  }

  // Play Neural Audio from server Base64
  public async playBase64Audio(base64: string): Promise<boolean> {
    if (!this.enabled || !base64) return false;
    this.stopSpeaking();

    return new Promise((resolve) => {
      try {
        const audioSrc = `data:audio/mp3;base64,${base64}`;
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
          console.warn("Audio play catch:", err);
          this.setSpeaking(false);
          this.currentAudioElement = null;
          resolve(false);
        });
      } catch (err) {
        this.setSpeaking(false);
        resolve(false);
      }
    });
  }

  // Speak text with MRT Speech Synthesis & Server Fallback
  public async speak(text: string, serverAudioBase64?: string | null): Promise<void> {
    if (!this.enabled || !text) return;

    // 1. First priority: Server-generated Neural Persian Voice (Farid/Dilara)
    if (serverAudioBase64) {
      const success = await this.playBase64Audio(serverAudioBase64);
      if (success) return;
    }

    // 2. Second priority: Request TTS from server if not provided
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const success = await this.playBase64Audio(data.audioBase64);
          if (success) return;
        }
      }
    } catch (err) {
      console.warn("TTS API fetch fallback to MRT browser synthesis:", err);
    }

    // 3. Third priority: MRT Native Web Speech Synthesis in Browser (fa-IR)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        this.stopSpeaking();
        const clean = text.replace(/[*_#`]/g, "").trim();
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = "fa-IR";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to pick a Persian voice if installed in OS
        const voices = window.speechSynthesis.getVoices();
        const faVoice = voices.find(
          (v) => v.lang.includes("fa") || v.lang.includes("FA") || v.name.toLowerCase().includes("persian")
        );
        if (faVoice) {
          utterance.voice = faVoice;
        }

        utterance.onstart = () => {
          this.setSpeaking(true);
          if (this.speechKeepAliveTimer) clearInterval(this.speechKeepAliveTimer);
          this.speechKeepAliveTimer = setInterval(() => {
            if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.speaking) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            }
          }, 8000);
        };
        utterance.onend = () => {
          if (this.speechKeepAliveTimer) {
            clearInterval(this.speechKeepAliveTimer);
            this.speechKeepAliveTimer = null;
          }
          this.setSpeaking(false);
        };
        utterance.onerror = () => {
          if (this.speechKeepAliveTimer) {
            clearInterval(this.speechKeepAliveTimer);
            this.speechKeepAliveTimer = null;
          }
          this.setSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("MRT SpeechSynthesis error:", e);
        this.setSpeaking(false);
      }
    }
  }
}

export const carAudio = new CarAudioController();

export function stopSpeaking() {
  carAudio.stopSpeaking();
}

export function speakText(text: string, serverAudioBase64?: string | null) {
  return carAudio.speak(text, serverAudioBase64);
}

export function calculateSpeedVolumeBoost(speedKmH: number = 0) {
  if (speedKmH <= 40) {
    return { gainMultiplier: 1.0, roadNoiseDbCompensation: 0 };
  } else if (speedKmH <= 80) {
    return { gainMultiplier: 1.15, roadNoiseDbCompensation: 2 };
  } else if (speedKmH <= 110) {
    return { gainMultiplier: 1.30, roadNoiseDbCompensation: 4 };
  } else {
    return { gainMultiplier: 1.45, roadNoiseDbCompensation: 6 };
  }
}
