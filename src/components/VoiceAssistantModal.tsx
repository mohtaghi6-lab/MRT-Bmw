import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Send,
  Sparkles,
  Car,
} from "lucide-react";
import { CarState, NavigationRoute } from "../types";
import { carAudio, speakText, stopSpeaking } from "../utils/carSpeech";
import { parseOfflineCarCommand } from "../utils/offlineEngine";
import { answerOfflineConversation } from "../utils/offlineConversation";
import { matchJarvisGoodbye } from "../utils/jarvisVoice";
import {
  JarvisStyleProfile,
  adaptOfflineReplyToUserStyle,
  buildStyleInstructionForAI,
  learnFromUserUtterance,
  loadJarvisStyleProfile,
} from "../utils/jarvisLearning";
import { cabinMicNoiseFilter, MicNoiseFilterStatus } from "../utils/micNoiseFilter";
import VoiceWaveformVisualizer from "./VoiceWaveformVisualizer";

interface MemoryTurn {
  role: "user" | "model";
  text: string;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  onNavigateToRoute?: (route: NavigationRoute) => void;
  onPlayFlashMusic?: () => void;
  onExecuteUiCommand?: (uiCommand: string) => void;
  onAddSessionTurn?: (driverText: string, aiText: string, audioBase64?: string) => void;
  initialWakeCommand?: string | null;
  wokenByJarvis?: boolean;
  onConsumeWakeCommand?: () => void;
}

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  carState,
  onUpdateCarState,
  onNavigateToRoute,
  onPlayFlashMusic,
  onExecuteUiCommand,
  onAddSessionTurn,
  initialWakeCommand,
  wokenByJarvis,
  onConsumeWakeCommand,
}: VoiceAssistantModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveHeardText, setLiveHeardText] = useState("");
  const [jarvisLiveCaption, setJarvisLiveCaption] = useState(
    "آماده مکالمه صوتی آنلاین و آفلاین ب‌ام‌و ۷۲۸Li هستم — مستقیم صحبت کنید."
  );
  const [lastActionBadge, setLastActionBadge] = useState<string>("");
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [activeEngineProvider, setActiveEngineProvider] = useState<string>("جارویز زنده · صوتی");
  const [cloudKeyNotice, setCloudKeyNotice] = useState<boolean>(false);
  const [freeChatMode, setFreeChatMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("bmw728li_free_chat_mode");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  const [typedQuery, setTypedQuery] = useState<string>("");
  const [recentTurns, setRecentTurns] = useState<MemoryTurn[]>([]);
  const [styleProfile, setStyleProfile] = useState<JarvisStyleProfile>(() =>
    loadJarvisStyleProfile()
  );
  const [noiseFilterStatus, setNoiseFilterStatus] = useState<MicNoiseFilterStatus>({
    active: false,
    hardwareNoiseSuppression: false,
    echoCancellation: false,
    autoGainControl: false,
    voiceLevel: 0,
  });

  const memoryTurnsRef = useRef<MemoryTurn[]>([]);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const isOpenRef = useRef<boolean>(isOpen);
  const isProcessingRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const freeChatModeRef = useRef<boolean>(freeChatMode);
  const liveHeardRef = useRef<string>("");
  const finalSegmentsRef = useRef<string[]>([]);
  const silenceTimerRef = useRef<number | null>(null);
  const jarvisEndedRef = useRef<boolean>(false);
  const wakeHandledRef = useRef<boolean>(false);
  const carStateRef = useRef<CarState>(carState);

  useEffect(() => {
    carStateRef.current = carState;
  }, [carState]);

  useEffect(() => {
    freeChatModeRef.current = freeChatMode;
    try {
      localStorage.setItem("bmw728li_free_chat_mode", String(freeChatMode));
    } catch {}
  }, [freeChatMode]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    const unsubSpeak = carAudio.onSpeakingChange((speaking) => {
      isSpeakingRef.current = speaking;
      setIsSpeaking(speaking);
    });
    const unsubNoise = cabinMicNoiseFilter.subscribe(setNoiseFilterStatus);
    return () => {
      unsubSpeak();
      unsubNoise();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => {
        if (cancelled || !status) return;
        const geminiOk = Boolean(status?.primary?.configured) && !status?.lastGeminiError;
        const openAiOk = Boolean(status?.fallback?.configured) && !status?.lastOpenAiError;
        if (status?.needsApiKeyCheck || (!geminiOk && !openAiOk)) {
          setCloudKeyNotice(true);
          setActiveEngineProvider("مکالمه هوشمند جارویز (آفلاین/دانشنامه)");
        } else if (geminiOk) {
          setCloudKeyNotice(false);
          setActiveEngineProvider(`Google Gemini · ${status.primary?.model || "gemini-4-hydrogen"}`);
        } else if (openAiOk) {
          setCloudKeyNotice(false);
          setActiveEngineProvider(`ChatGPT · ${status.fallback?.model || "gpt-4o-mini"}`);
        }
      })
      .catch(() => {});

    const isMobileOrAndroid =
      typeof navigator !== "undefined" && /android|mobile|wv/i.test(navigator.userAgent || "");
    if (isMobileOrAndroid) {
      return () => {
        cancelled = true;
      };
    }
    void cabinMicNoiseFilter.acquireNoiseFilter();
    return () => {
      cancelled = true;
      cabinMicNoiseFilter.releaseNoiseFilter();
    };
  }, [isOpen]);

  const stopListeningInternal = () => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  const startListeningInternal = () => {
    if (!recognitionRef.current || !isOpenRef.current || jarvisEndedRef.current) return;
    if (isProcessingRef.current || isSpeakingRef.current) return;

    finalSegmentsRef.current = [];
    liveHeardRef.current = "";
    setLiveHeardText("");

    try {
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch {
      try {
        recognitionRef.current.stop();
      } catch {}
      window.setTimeout(() => {
        if (!isOpenRef.current || isProcessingRef.current || isSpeakingRef.current || jarvisEndedRef.current) {
          return;
        }
        try {
          recognitionRef.current.start();
          setIsListening(true);
          isListeningRef.current = true;
        } catch {}
      }, 220);
    }
  };

  // Initialize continuous Persian SpeechRecognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setJarvisLiveCaption("مرورگر شما از میکروفون صوتی پشتیبانی نمی‌کند؛ با Chrome باز کنید.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.lang = "fa-IR";

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognition.onresult = (event: any) => {
        if (!isOpenRef.current || isProcessingRef.current || isSpeakingRef.current) return;

        let currentInterim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = (item?.[0]?.transcript || "").trim();
          if (!text) continue;
          if (item.isFinal) {
            finalSegmentsRef.current.push(text);
          } else {
            currentInterim += (currentInterim ? " " : "") + text;
          }
        }

        const fullSpokenText = [...finalSegmentsRef.current, currentInterim]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (!fullSpokenText) return;

        liveHeardRef.current = fullSpokenText;
        setLiveHeardText(fullSpokenText);

        // Immediate goodbye termination
        if (matchJarvisGoodbye(fullSpokenText)) {
          if (jarvisEndedRef.current) return;
          stopListeningInternal();
          void handleVoiceQuery(fullSpokenText);
          return;
        }

        if (silenceTimerRef.current !== null) {
          window.clearTimeout(silenceTimerRef.current);
        }
        const hasFinal = finalSegmentsRef.current.length > 0;
        silenceTimerRef.current = window.setTimeout(() => {
          const readyTxt = liveHeardRef.current.trim();
          if (readyTxt && isListeningRef.current && !isProcessingRef.current) {
            stopListeningInternal();
            void handleVoiceQuery(readyTxt);
          }
        }, hasFinal ? 1050 : 1750);
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setJarvisLiveCaption("دسترسی میکروفون در مرورگر مسدود است. مجوز Microphone را فعال کنید.");
          setIsListening(false);
          isListeningRef.current = false;
        } else if (event.error === "audio-capture" || event.error === "aborted") {
          cabinMicNoiseFilter.releaseNoiseFilter();
        }
      };

      recognition.onend = () => {
        if (
          isOpenRef.current &&
          isListeningRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current &&
          !jarvisEndedRef.current
        ) {
          window.setTimeout(() => {
            if (
              isOpenRef.current &&
              isListeningRef.current &&
              !isProcessingRef.current &&
              !isSpeakingRef.current &&
              !jarvisEndedRef.current
            ) {
              try {
                recognition.start();
                return;
              } catch {}
            }
            setIsListening(false);
          }, 180);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      setSpeechSupported(true);
    } catch {
      setSpeechSupported(false);
    }

    return () => {
      stopListeningInternal();
    };
  }, []);

  // Open/Close lifecycle
  useEffect(() => {
    if (!isOpen) {
      wakeHandledRef.current = false;
      jarvisEndedRef.current = false;
      stopListeningInternal();
      return;
    }

    jarvisEndedRef.current = false;
    setLastActionBadge("");
    setLiveHeardText("");

    if (wokenByJarvis && !wakeHandledRef.current) {
      wakeHandledRef.current = true;
      const wakeCmd = initialWakeCommand?.trim() || "";
      onConsumeWakeCommand?.();

      if (wakeCmd) {
        const t = window.setTimeout(() => {
          if (isOpenRef.current) {
            void handleVoiceQuery(wakeCmd);
          }
        }, 280);
        return () => window.clearTimeout(t);
      }

      let cancelled = false;
      const runWakeGreet = async () => {
        carAudio.unlockAudio();
        const greet = adaptOfflineReplyToUserStyle(
          "جانم راننده عزیز، گوش می‌دم بفرمایید.",
          loadJarvisStyleProfile()
        );
        setJarvisLiveCaption(greet);
        await speakText(greet);
        isSpeakingRef.current = false;
        if (!cancelled && isOpenRef.current && !jarvisEndedRef.current) {
          window.setTimeout(() => {
            if (!cancelled && isOpenRef.current && !jarvisEndedRef.current && !isProcessingRef.current) {
              setJarvisLiveCaption("در حال گوش دادن هستم... فارسی صحبت کنید.");
              startListeningInternal();
            }
          }, 120);
        }
      };
      const t = window.setTimeout(() => {
        void runWakeGreet();
      }, 140);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    if (speechSupported) {
      const t = window.setTimeout(() => {
        if (isOpenRef.current && !isListeningRef.current && !isProcessingRef.current) {
          carAudio.unlockAudio();
          setJarvisLiveCaption("در حال گوش دادن هستم... فارسی صحبت کنید.");
          startListeningInternal();
        }
      }, 180);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, speechSupported]);

  const handleResetMemory = async () => {
    carAudio.playButtonTap();
    carAudio.unlockAudio();
    stopListeningInternal();
    stopSpeaking();
    memoryTurnsRef.current = [];
    setRecentTurns([]);
    const resetMsg = "حافظه مکالمه پاک شد، درباره چه موضوعی صحبت کنیم؟";
    setJarvisLiveCaption(resetMsg);
    setLastActionBadge("ریست حافظه (MRT)");
    await speakText(resetMsg);
    isSpeakingRef.current = false;
    if (isOpenRef.current && !jarvisEndedRef.current) {
      window.setTimeout(() => {
        if (isOpenRef.current && !jarvisEndedRef.current) {
          startListeningInternal();
        }
      }, 120);
    }
  };

  const handleVoiceQuery = async (spokenText: string) => {
    const query = spokenText.trim();
    if (!query || isProcessingRef.current || jarvisEndedRef.current) return;

    stopListeningInternal();
    stopSpeaking();
    finalSegmentsRef.current = [];
    liveHeardRef.current = "";
    setLiveHeardText("");

    // Immediate "خداحافظ جارویز" termination
    if (matchJarvisGoodbye(query)) {
      jarvisEndedRef.current = true;
      const byeText = "خداحافظ راننده، سفر بی‌خطری داشته باشید. هر وقت صدام زدید «جارویز» در خدمتم.";
      setJarvisLiveCaption(byeText);
      setLastActionBadge("پایان مکالمه صوتی");
      await speakText(byeText);
      if (isOpenRef.current) {
        onClose();
      }
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setJarvisLiveCaption(`«${query}»`);

    let closeAfterSpeak = false;
    const stateSnapshot = carStateRef.current;
    const learnedProfile = learnFromUserUtterance(query);
    setStyleProfile(learnedProfile);

    const historySnapshot = memoryTurnsRef.current.slice(-20);

    const isFreeChat = freeChatModeRef.current;
    try {
      const hasInternet = typeof navigator === "undefined" || navigator.onLine !== false;
      if (!hasInternet) {
        throw new Error("OFFLINE_MODE");
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 16000);
      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: query,
            history: historySnapshot,
            carState: stateSnapshot,
            styleInstruction: buildStyleInstructionForAI(learnedProfile),
            styleProfile: learnedProfile,
            freeChatMode: isFreeChat,
          }),
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!res.ok) {
        throw new Error("پاسخ سرور نامعتبر است");
      }

      const data = await res.json();
      if (data.provider) {
        setActiveEngineProvider(data.provider);
      }
      setCloudKeyNotice(Boolean(data.needsApiKeyCheck));

      const replyText =
        (typeof data.reply === "string" && data.reply.trim()) ||
        "بله متوجه شدم، در خدمتم.";
      let actionLabel = "";

      const hasAiPatch =
        data.carStatePatch &&
        typeof data.carStatePatch === "object" &&
        Object.keys(data.carStatePatch).length > 0;
      if (hasAiPatch) {
        onUpdateCarState(data.carStatePatch);
        actionLabel = "تنظیم خودرو انجام شد";
      }

      if (typeof data.uiCommand === "string" && data.uiCommand.trim()) {
        const uiCmd = data.uiCommand.trim();
        onExecuteUiCommand?.(uiCmd);
        actionLabel = actionLabel || `اجرای دستور (${uiCmd})`;
        if (uiCmd.startsWith("open_") || uiCmd === "close_modals") {
          closeAfterSpeak = true;
        }
      }

      if (data.closeVoiceModal === true) {
        closeAfterSpeak = true;
      }

      if (data.action) {
        switch (data.action) {
          case "reset_history":
            memoryTurnsRef.current = [];
            actionLabel = "حافظه ریست شد (MRT)";
            break;
          case "jarvis_goodbye":
            jarvisEndedRef.current = true;
            closeAfterSpeak = true;
            actionLabel = "پایان مکالمه جارویز";
            break;
          case "lock_doors":
            onUpdateCarState({ doorsLocked: true });
            carAudio.playLockBeep(true);
            actionLabel = "قفل مرکزی فعال شد";
            break;
          case "unlock_doors":
            onUpdateCarState({ doorsLocked: false });
            carAudio.playLockBeep(false);
            actionLabel = "قفل مرکزی باز شد";
            break;
          case "ac_on":
            onUpdateCarState({ acActive: true });
            actionLabel = "تهویه روشن شد";
            break;
          case "ac_off":
            onUpdateCarState({ acActive: false });
            actionLabel = "تهویه خاموش شد";
            break;
          case "toggle_hazard":
          case "hazard_on":
            onUpdateCarState({ hazardActive: true });
            carAudio.playHazardTick(true);
            actionLabel = "جفت‌راهنما روشن شد";
            break;
          case "hazard_off":
            onUpdateCarState({ hazardActive: false });
            actionLabel = "جفت‌راهنما خاموش شد";
            break;
          case "sport_mode":
            onUpdateCarState({ driveMode: "sport" });
            actionLabel = "حالت SPORT فعال شد";
            break;
          case "comfort_mode":
            onUpdateCarState({ driveMode: "comfort" });
            actionLabel = "حالت COMFORT فعال شد";
            break;
          case "eco_mode":
            onUpdateCarState({ driveMode: "eco" });
            actionLabel = "حالت ECO فعال شد";
            break;
          case "adaptive_mode":
            onUpdateCarState({ driveMode: "adaptive" });
            actionLabel = "حالت ADAPTIVE فعال شد";
            break;
          case "play_flash":
            onPlayFlashMusic?.();
            actionLabel = "پخش موزیک فلش";
            break;
          case "play_music":
            onUpdateCarState({ musicPlaying: true });
            actionLabel = "پخش موزیک";
            break;
          case "pause_music":
            onUpdateCarState({ musicPlaying: false });
            actionLabel = "توقف موزیک";
            break;
          case "next_music":
            onExecuteUiCommand?.("next_music");
            actionLabel = "آهنگ بعدی";
            break;
          case "prev_music":
            onExecuteUiCommand?.("prev_music");
            actionLabel = "آهنگ قبلی";
            break;
          case "headlights_on":
            onUpdateCarState({ headlightsActive: true });
            actionLabel = "چراغ جلو روشن شد";
            break;
          case "headlights_off":
            onUpdateCarState({ headlightsActive: false });
            actionLabel = "چراغ جلو خاموش شد";
            break;
          case "reset_app":
            onExecuteUiCommand?.("reset_app");
            actionLabel = "ریست کامل سیستم";
            break;
          case "navigate":
            if (data.navigationData && onNavigateToRoute) {
              onNavigateToRoute({
                origin: data.navigationData.origin || "مبدا",
                destination: data.navigationData.destination || "مقصد",
                distance: data.navigationData.distance || "نامشخص",
                duration: data.navigationData.duration || "نامشخص",
                nextTurn: data.navigationData.nextTurn || "در مسیر ادامه دهید.",
                turnDistance: "۳۰۰ متر",
                speedLimit: 120,
                eta: "۱۸:۰۰",
              });
              actionLabel = `مسیریابی به ${data.navigationData.destination}`;
              closeAfterSpeak = true;
            }
            break;
        }
      }

      // Local recognizer safety-net ONLY when Free-Chat Mode is OFF, cloud AI wasn't connected, and LLM didn't emit a structured action
      if (
        !isFreeChat &&
        data.cloudAiConnected !== true &&
        (!data.action || data.action === "none") &&
        !hasAiPatch &&
        !data.uiCommand &&
        !data.navigationData?.destination
      ) {
        const localFallback = parseOfflineCarCommand(query, stateSnapshot, historySnapshot);
        if (
          localFallback.matched &&
          localFallback.action !== "jarvis_greet" &&
          localFallback.action !== "mic_check"
        ) {
          if (localFallback.updatedState) {
            onUpdateCarState(localFallback.updatedState);
            actionLabel = actionLabel || "اجرای فرمان روی خودرو";
          }
          if (localFallback.uiCommand) {
            onExecuteUiCommand?.(localFallback.uiCommand);
            actionLabel = actionLabel || "اجرای فرمان مانیتور";
          }
          if (localFallback.action === "play_flash") {
            onPlayFlashMusic?.();
            actionLabel = actionLabel || "پخش موزیک فلش";
          }
          if (localFallback.navigationData && onNavigateToRoute) {
            onNavigateToRoute({
              origin: localFallback.navigationData.origin || "مبدا",
              destination: localFallback.navigationData.destination || "مقصد",
              distance: localFallback.navigationData.distance || "نامشخص",
              duration: localFallback.navigationData.duration || "نامشخص",
              nextTurn: localFallback.navigationData.nextTurn || "در مسیر ادامه دهید.",
              turnDistance: localFallback.navigationData.turnDistance || "۳۰۰ متر",
              speedLimit: localFallback.navigationData.speedLimit || 110,
              eta: localFallback.navigationData.eta || "۱۷:۳۰",
            });
            actionLabel = `مسیریابی به ${localFallback.navigationData.destination}`;
          }
          if (localFallback.closeVoiceModal) {
            closeAfterSpeak = true;
          }
        }
      }

      if (data.action === "reset_history") {
        setRecentTurns([]);
      } else {
        const updatedTurns: MemoryTurn[] = [
          ...memoryTurnsRef.current.slice(-18),
          { role: "user", text: query },
          { role: "model", text: replyText },
        ];
        memoryTurnsRef.current = updatedTurns;
        setRecentTurns(updatedTurns.slice(-6));
      }

      setJarvisLiveCaption(replyText);
      setLastActionBadge(actionLabel);
      onAddSessionTurn?.(query, replyText, data.audioBase64);

      isProcessingRef.current = false;
      setIsProcessing(false);
      await speakText(
        replyText,
        data.audioBase64,
        data.audioMimeType || "audio/mp3",
        data.ttsSource
      );
    } catch {
      const offlineRes = isFreeChat
        ? { matched: false, action: "none", reply: "" }
        : parseOfflineCarCommand(query, stateSnapshot, historySnapshot);
      setActiveEngineProvider(isFreeChat ? "Free-Chat محلی جارویز" : "هوش آفلاین BMW ECU");

      if (offlineRes.matched) {
        if (offlineRes.updatedState) onUpdateCarState(offlineRes.updatedState);
        if (offlineRes.uiCommand) onExecuteUiCommand?.(offlineRes.uiCommand);
        if (offlineRes.action === "play_flash") onPlayFlashMusic?.();
        if (offlineRes.navigationData && onNavigateToRoute) {
          onNavigateToRoute({
            origin: offlineRes.navigationData.origin || "مبدا",
            destination: offlineRes.navigationData.destination || "مقصد",
            distance: offlineRes.navigationData.distance || "نامشخص",
            duration: offlineRes.navigationData.duration || "نامشخص",
            nextTurn: offlineRes.navigationData.nextTurn || "در مسیر ادامه دهید.",
            turnDistance: offlineRes.navigationData.turnDistance || "۳۰۰ متر",
            speedLimit: offlineRes.navigationData.speedLimit || 110,
            eta: offlineRes.navigationData.eta || "۱۷:۳۰",
          });
        }
        if (offlineRes.isJarvisEnd) jarvisEndedRef.current = true;
        if (offlineRes.closeVoiceModal) closeAfterSpeak = true;

        const styledReply = adaptOfflineReplyToUserStyle(offlineRes.reply, learnedProfile);
        if (offlineRes.isMrtEnd) {
          memoryTurnsRef.current = [];
          setRecentTurns([]);
        } else {
          const updatedTurns: MemoryTurn[] = [
            ...memoryTurnsRef.current.slice(-18),
            { role: "user", text: query },
            { role: "model", text: styledReply },
          ];
          memoryTurnsRef.current = updatedTurns;
          setRecentTurns(updatedTurns.slice(-6));
        }
        setJarvisLiveCaption(styledReply);
        setLastActionBadge("اجرا توسط کامپیوتر آفلاین BMW");
        isProcessingRef.current = false;
        setIsProcessing(false);
        await speakText(styledReply);
      } else {
        const convReply = answerOfflineConversation(query, stateSnapshot, historySnapshot);
        const fallbackText = adaptOfflineReplyToUserStyle(
          convReply ||
            "این موضوع نیاز به اتصال فعال ChatGPT یا Gemini دارد؛ کلید را در Settings > Secrets بررسی کنید یا سؤال دیگری بپرسید.",
          learnedProfile
        );
        const updatedTurns: MemoryTurn[] = [
          ...memoryTurnsRef.current.slice(-18),
          { role: "user", text: query },
          { role: "model", text: fallbackText },
        ];
        memoryTurnsRef.current = updatedTurns;
        setRecentTurns(updatedTurns.slice(-6));
        setJarvisLiveCaption(fallbackText);
        setLastActionBadge(convReply ? "هم‌صحبت هوشمند فارسی" : "");
        isProcessingRef.current = false;
        setIsProcessing(false);
        await speakText(fallbackText);
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);

      if (jarvisEndedRef.current || closeAfterSpeak) {
        stopListeningInternal();
        if (isOpenRef.current) onClose();
      } else if (isOpenRef.current && speechSupported) {
        window.setTimeout(() => {
          if (
            isOpenRef.current &&
            !jarvisEndedRef.current &&
            !isSpeakingRef.current &&
            !isProcessingRef.current
          ) {
            setJarvisLiveCaption("در حال گوش دادن هستم...");
            startListeningInternal();
          }
        }, 280);
      }
    }
  };

  const handleOrbTap = () => {
    carAudio.playButtonTap();
    carAudio.unlockAudio();
    if (isSpeaking) {
      stopSpeaking();
      isSpeakingRef.current = false;
      window.setTimeout(() => {
        if (isOpenRef.current && !isProcessingRef.current) {
          startListeningInternal();
        }
      }, 120);
      return;
    }
    if (isListening) {
      const ready = liveHeardRef.current.trim();
      stopListeningInternal();
      if (ready) {
        void handleVoiceQuery(ready);
      } else {
        setJarvisLiveCaption("میکروفون متوقف شد — برای ادامه صحبت، دایره جارویز را لمس کنید.");
      }
    } else {
      setJarvisLiveCaption("در حال گوش دادن هستم... فارسی صحبت کنید.");
      startListeningInternal();
    }
  };

  if (!isOpen) return null;

  const voiceWaveScale = 1 + Math.min(0.28, (noiseFilterStatus.voiceLevel / 100) * 0.28);

  return (
    <div
      id="voice-assistant-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#020809]/92 backdrop-blur-2xl flex items-center justify-center p-4 select-none animate-fadeIn"
      dir="rtl"
      onClick={() => {
        stopSpeaking();
        stopListeningInternal();
        onClose();
      }}
    >
      <div
        id="voice-assistant-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-3xl bg-gradient-to-b from-[#0a2224]/95 via-[#051214]/98 to-[#030809] border border-teal-300/20 shadow-[0_0_80px_rgba(249,115,22,0.18)] p-5 sm:p-7 flex flex-col items-center justify-between gap-6 text-slate-100 relative overflow-hidden min-h-[420px]"
      >
        {/* Minimal Top Live Status Strip */}
        <div className="w-full flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-neutral-950 border border-white/25 p-0.5 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="48" fill="#0b0e14" stroke="#cbd5e1" strokeWidth="3" />
                <text x="50" y="22" fill="#fff" fontSize="12" fontWeight="900" textAnchor="middle" letterSpacing="2">BMW</text>
                <circle cx="50" cy="58" r="28" fill="#000" stroke="#fff" strokeWidth="2" />
                <path d="M 50 58 L 50 30 A 28 28 0 0 1 78 58 Z" fill="#0066b2" />
                <path d="M 50 58 L 50 86 A 28 28 0 0 1 22 58 Z" fill="#0066b2" />
                <path d="M 50 58 L 22 58 A 28 28 0 0 1 50 30 Z" fill="#ffffff" />
                <path d="M 50 58 L 78 58 A 28 28 0 0 1 50 86 Z" fill="#ffffff" />
              </svg>
            </div>
            <div className="text-right">
              <h2 className="text-sm font-extrabold text-white">مکالمه صوتی آنلاین جارویز</h2>
              <span className="text-[11px] text-teal-200/75 block">{activeEngineProvider}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="voice-free-chat-mode-toggle"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                const next = !freeChatMode;
                setFreeChatMode(next);
                setLastActionBadge(next ? "Free-Chat Mode فعال" : "حالت کنترل خودرو فعال");
                setJarvisLiveCaption(
                  next
                    ? "حالت گفت‌وگوی آزاد (Free-Chat Mode) فعال شد — درباره هر موضوعی مستقیماً صحبت کنید."
                    : "حالت کنترل خودرو و مانیتور فعال شد — آماده اجرای فرمان‌های ب‌ام‌و هستم."
                );
              }}
              aria-pressed={freeChatMode}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                freeChatMode
                  ? "bg-teal-500/20 border-teal-300/50 text-teal-200 hover:bg-teal-500/30"
                  : "bg-amber-500/15 border-amber-300/40 text-amber-200 hover:bg-amber-500/25"
              }`}
              title={
                freeChatMode
                  ? "حالت گفت‌وگوی آزاد (پاسخ مستقیم LLM بدون محدودیت مانیتور)"
                  : "حالت کنترل خودرو و مانیتور"
              }
            >
              {freeChatMode ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                  <span>Free-Chat Mode</span>
                </>
              ) : (
                <>
                  <Car className="w-3.5 h-3.5 text-amber-300" />
                  <span>حالت مانیتور</span>
                </>
              )}
            </button>
            {noiseFilterStatus.active && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold hidden sm:flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>حذف نویز فعال</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                stopSpeaking();
                stopListeningInternal();
                onClose();
              }}
              className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center transition"
              aria-label="پایان مکالمه"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Acoustic Living Jarvis Voice Orb (Zero Text Chat UI) */}
        <div className="flex flex-col items-center justify-center gap-5 my-2 z-10 w-full">
          <button
            id="voice-live-orb-btn"
            type="button"
            onClick={handleOrbTap}
            className="relative w-40 h-40 rounded-full flex items-center justify-center focus:outline-none group"
            aria-label="میکروفون زنده جارویز"
          >
            {/* Outer breathing aura */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-150 ${
                isSpeaking
                  ? "bg-amber-500/25 ring-2 ring-amber-400/70 shadow-[0_0_55px_rgba(245,158,11,0.55)] animate-pulse"
                  : isProcessing
                  ? "bg-sky-500/20 ring-2 ring-sky-400/70 shadow-[0_0_50px_rgba(56,189,248,0.45)] animate-pulse"
                  : isListening
                  ? "bg-emerald-500/20 ring-2 ring-emerald-400/70 shadow-[0_0_55px_rgba(16,185,129,0.45)]"
                  : "bg-teal-900/30 ring-1 ring-teal-300/30"
              }`}
              style={
                isListening && !isSpeaking && !isProcessing
                  ? { transform: `scale(${voiceWaveScale})` }
                  : undefined
              }
            />

            {/* Inner dark glass sphere */}
            <div
              className={`relative w-28 h-28 rounded-full border flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 ${
                isSpeaking
                  ? "bg-gradient-to-b from-amber-500/30 to-amber-950/90 border-amber-300/70 text-amber-200"
                  : isProcessing
                  ? "bg-gradient-to-b from-sky-500/25 to-slate-950/95 border-sky-300/60 text-sky-200"
                  : isListening
                  ? "bg-gradient-to-b from-emerald-500/25 to-[#041b17] border-emerald-400/70 text-emerald-200"
                  : "bg-gradient-to-b from-teal-950 to-black border-teal-300/30 text-teal-200"
              }`}
            >
              {isSpeaking ? (
                <Volume2 className="w-9 h-9 animate-pulse" />
              ) : isListening ? (
                <Mic className="w-9 h-9" />
              ) : (
                <MicOff className="w-9 h-9 opacity-80" />
              )}
              <span className="text-[11px] font-bold">
                {isSpeaking
                  ? "در حال صحبت"
                  : isProcessing
                  ? "در حال پاسخ..."
                  : isListening
                  ? "گوش می‌دهم"
                  : "متوقف"}
              </span>
            </div>
          </button>

          {/* Subtle Real-Time Acoustic Waveform Visualizer */}
          <VoiceWaveformVisualizer
            isOpen={isOpen}
            isListening={isListening}
            isProcessing={isProcessing}
            isSpeaking={isSpeaking}
            voiceLevel={noiseFilterStatus.voiceLevel}
            liveTranscript={liveHeardText}
          />

          {/* Clean Live Subtitle Display + Optional Recent Turn History */}
          <div className="w-full max-w-lg text-center space-y-2.5 px-2">
            {cloudKeyNotice && (
              <div className="text-[11px] px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-400/40 text-amber-200 leading-relaxed">
                در حال استفاده از حالت محلی — برای پاسخ‌های آنلاین Gemini، کلید <span className="font-mono">GEMINI_API_KEY</span> را در <strong>Settings &gt; Secrets</strong> بررسی کنید.
              </div>
            )}

            <p className="text-sm sm:text-base font-semibold text-white leading-relaxed min-h-[3rem] flex items-center justify-center">
              {liveHeardText || jarvisLiveCaption}
            </p>

            {recentTurns.length > 0 && (
              <div className="max-h-28 overflow-y-auto rounded-2xl bg-black/35 border border-white/[0.07] p-2.5 space-y-1.5 text-right text-xs">
                {recentTurns.slice(-4).map((turn, idx) => (
                  <div
                    key={idx}
                    className={`px-2.5 py-1 rounded-xl ${
                      turn.role === "user"
                        ? "bg-white/[0.05] text-slate-300"
                        : "bg-teal-950/55 text-teal-100 border border-teal-400/20"
                    }`}
                  >
                    <span className="font-bold opacity-75 ml-1">
                      {turn.role === "user" ? "شما:" : "جارویز:"}
                    </span>
                    <span>{turn.text}</span>
                  </div>
                ))}
              </div>
            )}

            {lastActionBadge && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lastActionBadge}</span>
              </div>
            )}
          </div>
        </div>

        {/* Optional Quick Text Input for Complex / ChatGPT-Style Requests */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = typedQuery.trim();
            if (!q || isProcessingRef.current) return;
            carAudio.unlockAudio();
            setTypedQuery("");
            void handleVoiceQuery(q);
          }}
          className="w-full flex items-center gap-2 z-10"
        >
          <input
            id="voice-assistant-text-input"
            type="text"
            value={typedQuery}
            onFocus={() => stopListeningInternal()}
            onChange={(e) => setTypedQuery(e.target.value)}
            placeholder="هر سؤال یا درخواستی دارید بپرسید یا تایپ کنید..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/45 border border-white/[0.12] focus:border-teal-400/60 focus:outline-none text-xs sm:text-sm text-white placeholder:text-slate-400"
          />
          <button
            id="voice-assistant-send-btn"
            type="submit"
            disabled={!typedQuery.trim() || isProcessing}
            className="px-3.5 py-2.5 rounded-xl bg-teal-600/85 hover:bg-teal-500 disabled:opacity-40 text-white font-bold flex items-center justify-center transition"
            aria-label="ارسال پیام به جارویز"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Voice Call Bottom Bar */}
        <div className="w-full flex items-center justify-between gap-3 pt-2.5 border-t border-white/[0.08] z-10 text-xs">
          <button
            type="button"
            onClick={handleResetMemory}
            className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-slate-200 font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>ریست حافظه (MRT)</span>
          </button>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            تطبیق لهجه: {styleProfile.dialectTraits[styleProfile.dialectTraits.length - 1] || "طبیعی"}
          </span>

          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              stopSpeaking();
              stopListeningInternal();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-600/85 hover:bg-rose-600 text-white font-bold flex items-center gap-1.5 transition"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>خداحافظ جارویز</span>
          </button>
        </div>
      </div>
    </div>
  );
}
