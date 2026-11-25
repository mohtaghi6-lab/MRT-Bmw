import React, { useEffect, useRef } from "react";
import { cabinMicNoiseFilter } from "../utils/micNoiseFilter";

interface VoiceWaveformVisualizerProps {
  isOpen: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  voiceLevel: number;
  liveTranscript: string;
}

const BAR_COUNT = 29;

export default function VoiceWaveformVisualizer({
  isOpen,
  isListening,
  isProcessing,
  isSpeaking,
  voiceLevel,
  liveTranscript,
}: VoiceWaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    isListening,
    isProcessing,
    isSpeaking,
    voiceLevel,
  });
  const transcriptPulseRef = useRef<number>(0);
  const smoothedBarsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.06));

  useEffect(() => {
    stateRef.current = {
      isListening,
      isProcessing,
      isSpeaking,
      voiceLevel,
    };
  }, [isListening, isProcessing, isSpeaking, voiceLevel]);

  // Trigger a gentle vocal-cadence impulse whenever live transcript text updates
  // (helps mobile/Android WebView where concurrent Web Audio getUserMedia is bypassed).
  useEffect(() => {
    if (liveTranscript.trim().length > 0 && isListening) {
      transcriptPulseRef.current = Math.min(1, transcriptPulseRef.current + 0.55);
    }
  }, [liveTranscript, isListening]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let rafId = 0;
    let startTime = performance.now();

    const renderFrame = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = canvas.clientWidth || 320;
      const cssHeight = canvas.clientHeight || 44;

      if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const {
        isListening: listening,
        isProcessing: processing,
        isSpeaking: speaking,
        voiceLevel: micLevel,
      } = stateRef.current;

      const elapsed = (now - startTime) / 1000;
      transcriptPulseRef.current = Math.max(0, transcriptPulseRef.current * 0.92);

      const centerIdx = Math.floor(BAR_COUNT / 2);
      const halfCount = centerIdx + 1;
      const fftBands = listening ? cabinMicNoiseFilter.sampleSpectrumBands(halfCount) : null;

      let primaryColor = "rgba(94, 234, 212, 0.28)";
      let secondaryColor = "rgba(20, 184, 166, 0.14)";

      if (speaking) {
        primaryColor = "rgba(251, 191, 36, 0.85)";
        secondaryColor = "rgba(245, 158, 11, 0.28)";
      } else if (processing) {
        primaryColor = "rgba(56, 189, 248, 0.85)";
        secondaryColor = "rgba(14, 165, 233, 0.25)";
      } else if (listening) {
        primaryColor = "rgba(52, 211, 153, 0.88)";
        secondaryColor = "rgba(16, 185, 129, 0.26)";
      }

      const midY = cssHeight / 2;
      const maxBarHeight = cssHeight - 8;
      const gap = 4;
      const totalBarSpace = cssWidth - 16;
      const barWidth = Math.max(2, Math.min(4, (totalBarSpace - gap * (BAR_COUNT - 1)) / BAR_COUNT));
      const totalRenderedWidth = BAR_COUNT * barWidth + (BAR_COUNT - 1) * gap;
      const startX = (cssWidth - totalRenderedWidth) / 2;

      const grad = ctx.createLinearGradient(0, 4, 0, cssHeight - 4);
      grad.addColorStop(0, secondaryColor);
      grad.addColorStop(0.5, primaryColor);
      grad.addColorStop(1, secondaryColor);
      ctx.fillStyle = grad;

      for (let i = 0; i < BAR_COUNT; i++) {
        const distFromCenter = Math.abs(i - centerIdx);
        const normDist = distFromCenter / Math.max(1, centerIdx);
        // Subtle bell taper toward left and right ends
        const envelope = 0.28 + 0.72 * Math.cos(normDist * Math.PI * 0.45);

        let target = 0.06;

        if (prefersReducedMotion) {
          if (speaking) target = 0.36 * envelope;
          else if (processing) target = 0.28 * envelope;
          else if (listening) target = (0.14 + (micLevel / 100) * 0.55) * envelope;
          else target = 0.06;
        } else if (speaking) {
          const syllabicWave =
            0.32 +
            0.26 * Math.sin(elapsed * 7.4 - distFromCenter * 0.55) +
            0.18 * Math.cos(elapsed * 11.2 + i * 0.7);
          target = Math.max(0.08, Math.min(0.92, syllabicWave * envelope));
        } else if (processing) {
          // Subtle traveling harmonic wave while AI processes the command
          const phase = elapsed * 4.2 - i * 0.38;
          const wave = 0.22 + 0.24 * (0.5 + 0.5 * Math.sin(phase));
          const pulse = 0.5 + 0.5 * Math.cos(elapsed * 2.4 - normDist * 2.1);
          target = Math.max(0.08, Math.min(0.68, (wave * 0.65 + pulse * 0.22) * envelope));
        } else if (listening) {
          const scalarMic = Math.min(1, micLevel / 68);
          const transcriptActivity = transcriptPulseRef.current;
          if (fftBands) {
            const bandVal = fftBands[Math.min(fftBands.length - 1, distFromCenter)] ?? 0;
            const ambientBreath = 0.07 + 0.03 * Math.sin(elapsed * 2.6 + i * 0.4);
            target = Math.max(ambientBreath, (bandVal * 0.95 + scalarMic * 0.2) * envelope);
          } else {
            const reactiveLevel = Math.max(scalarMic, transcriptActivity * 0.75);
            const ripple =
              0.55 +
              0.45 * Math.sin(elapsed * 9.5 - distFromCenter * 0.65) * Math.cos(elapsed * 4.1 + i * 0.3);
            const ambientBreath = 0.08 + 0.04 * Math.sin(elapsed * 2.6 + i * 0.4);
            target = Math.max(ambientBreath, (0.08 + reactiveLevel * 0.8 * ripple) * envelope);
          }
        } else {
          target = 0.055;
        }

        const prev = smoothedBarsRef.current[i] ?? 0.06;
        const smoothing = target > prev ? 0.32 : 0.16;
        const next = prev + (target - prev) * smoothing;
        smoothedBarsRef.current[i] = next;

        const barH = Math.max(2.5, Math.min(maxBarHeight, next * maxBarHeight));
        const x = startX + i * (barWidth + gap);
        const y = midY - barH / 2;
        const radius = barWidth / 2;

        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, barWidth, barH, radius);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();
      }

      ctx.restore();

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isOpen, isListening, isProcessing, isSpeaking]);

  const ariaLabel = isSpeaking
    ? "نوار موج صدای جارویز در حال پاسخ‌گویی"
    : isProcessing
    ? "نوار موج پردازش هوش مصنوعی"
    : isListening
    ? "نوار موج زنده میکروفون در حال دریافت صدا"
    : "نوار موج صوتی آماده";

  return (
    <div
      id="voice-waveform-visualizer"
      className="w-full max-w-sm px-4 py-1.5 rounded-2xl bg-black/35 border border-white/[0.06] flex flex-col items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-11 block"
      />
    </div>
  );
}
