import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  X,
  RotateCcw,
  Zap,
  Activity,
  MessageSquare,
  Bot,
  Compass,
  Radio,
  Sliders,
  CheckCircle2,
  BookOpen,
  Car,
  Music,
  ShieldCheck,
} from "lucide-react";
import { CarState, NavigationRoute } from "../types";
import { carAudio, speakText, stopSpeaking } from "../utils/carSpeech";
import { parseOfflineCarCommand } from "../utils/offlineEngine";

interface VoiceTurn {
  id: string;
  sender: "driver" | "system";
  text: string;
  timestamp: string;
  audioBase64?: string;
  actionTaken?: string;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  onNavigateToRoute?: (route: NavigationRoute) => void;
  onPlayFlashMusic?: () => void;
  onAddSessionTurn?: (driverText: string, aiText: string, audioBase64?: string) => void;
}

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  carState,
  onUpdateCarState,
  onNavigateToRoute,
  onPlayFlashMusic,
  onAddSessionTurn,
}: VoiceAssistantModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [micStatusText, setMicStatusText] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [showCommandsSheet, setShowCommandsSheet] = useState(false);
  const [activeEngineProvider, setActiveEngineProvider] = useState<string>("OpenAI (اصلی) • Gemini (پشتیبان)");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300); // 5 minutes = 300s
  const [turns, setTurns] = useState<VoiceTurn[]>([
    {
      id: "init-1",
      sender: "system",
      text: "سلام! سیستم صوتی و دستیار هوشمند BMW 728Li فعال است. تا زمانی که عبارت «ام ار تی» (MRT) را نگویید، تمام موضوعات و جزئیات گفتگوی ما در حافظه پیوسته ذخیره خواهد بود. دکمه صحبت تا ۵ دقیقه کامل فعال است تا با آرامش کامل صحبت کنید.",
      timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>("");
  const finalSegmentsRef = useRef<string[]>([]);
  const countdownIntervalRef = useRef<any>(null);
  const maxListenTimerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync refs with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Sync with CarAudio speaking state
  useEffect(() => {
    carAudio.onSpeakingChange((speaking) => {
      setIsSpeaking(speaking);
    });
  }, []);

  // Initialize resilient continuous SpeechRecognition for Persian
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true; // Stays open
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.lang = "fa-IR"; // Persian language

          recognition.onstart = () => {
            setIsListening(true);
            setMicStatusText("میکروفون فعال است (مهلت ۵ دقیقه)... تمام صحبت‌های شما به طور کامل ثبت می‌شود");
          };

          recognition.onresult = (event: any) => {
            let currentInterim = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const item = event.results[i];
              if (item.isFinal) {
                const finalPiece = item[0].transcript.trim();
                if (finalPiece) {
                  finalSegmentsRef.current.push(finalPiece);
                }
              } else {
                currentInterim += item[0].transcript;
              }
            }

            const fullSpokenText = [
              ...finalSegmentsRef.current,
              currentInterim.trim(),
            ]
              .filter(Boolean)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();

            if (fullSpokenText) {
              setTranscript(fullSpokenText);
              transcriptRef.current = fullSpokenText;
              setInputText(fullSpokenText);
              setMicStatusText("در حال شنیدن و ثبت کامل صحبت شما...");
            }
          };

          recognition.onerror = (event: any) => {
            console.warn("Speech recognition event:", event.error);
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
              setMicStatusText("دسترسی به میکروفون در مرورگر مسدود شده است.");
              setIsListening(false);
            } else if (event.error === "no-speech") {
              // Stay active and keep listening through pauses
              setMicStatusText("در حال شنیدن... با خیال راحت صحبت کنید (تا ۵ دقیقه قطع نمی‌شود)");
            }
          };

          recognition.onend = () => {
            // Auto-restart if user still in listening mode (Chrome auto-stops on silence)
            if (isListeningRef.current) {
              try {
                recognition.start();
                return;
              } catch {}
            }
            setIsListening(false);
          };

          recognitionRef.current = recognition;
        } catch (e) {
          console.warn("SpeechRecognition initialization note:", e);
        }
      }
    }

    return () => {
      stopListeningInternal();
    };
  }, []);

  const stopListeningInternal = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (maxListenTimerRef.current) {
      clearTimeout(maxListenTimerRef.current);
      maxListenTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setSecondsRemaining(300);
  };

  // Auto-scroll to latest turn
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns, isOpen, isProcessing]);

  // Handle Voice Recognition Toggle
  const toggleListening = () => {
    carAudio.playButtonTap();

    if (isListening) {
      // User clicked while listening -> finish and send if we have text
      const currentTxt = transcriptRef.current.trim() || inputText.trim();
      stopListeningInternal();
      if (currentTxt) {
        handleSendMessage(currentTxt);
      }
    } else {
      stopSpeaking();
      finalSegmentsRef.current = [];
      setTranscript("");
      setInputText("");
      setSecondsRemaining(300);
      setMicStatusText("در حال آماده‌سازی میکروفون (۵ دقیقه فعال)...");

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);

          // 5-minute countdown interval (300 seconds)
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = setInterval(() => {
            setSecondsRemaining((prev) => {
              if (prev <= 1) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
                const finalTxt = transcriptRef.current.trim() || inputText.trim();
                stopListeningInternal();
                if (finalTxt) {
                  handleSendMessage(finalTxt);
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          if (maxListenTimerRef.current) clearTimeout(maxListenTimerRef.current);
          maxListenTimerRef.current = setTimeout(() => {
            const finalTxt = transcriptRef.current.trim() || inputText.trim();
            stopListeningInternal();
            if (finalTxt) {
              handleSendMessage(finalTxt);
            }
          }, 300000);
        } catch (e) {
          console.warn("Recognition restart:", e);
          try {
            recognitionRef.current.stop();
          } catch {}
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch (err2) {
              setMicStatusText("میکروفون در دسترس نیست. می‌توانید متن را تایپ کنید.");
            }
          }, 200);
        }
      } else {
        const promptInput = prompt("لطفاً پیام صوتی یا متنی خود را وارد کنید:");
        if (promptInput) {
          handleSendMessage(promptInput);
        }
      }
    }
  };

  // Manual memory reset triggered by button or voice "MRT"
  const handleResetMemory = async () => {
    carAudio.playButtonTap();
    stopSpeaking();
    const resetMsg = "حافظه و زمینه مکالمه طبق دستور شما (MRT) کاملاً ریست شد. آماده شروع موضوع جدید با BMW 728Li هستیم.";
    setTurns([
      {
        id: "init-" + Date.now(),
        sender: "system",
        text: resetMsg,
        timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    speakText(resetMsg);
  };

  // Process User Speech or Text Input
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isProcessing) return;

    stopSpeaking();
    const query = textToSend.trim();
    finalSegmentsRef.current = [];
    setTranscript("");
    setInputText("");

    const userTurn: VoiceTurn = {
      id: "u-" + Date.now(),
      sender: "driver",
      text: query,
      timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    };

    setTurns((prev) => [...prev, userTurn]);
    setIsProcessing(true);

    try {
      const hasInternet =
        carState.isOnline && (typeof navigator === "undefined" || navigator.onLine);
      if (!hasInternet) {
        throw new Error("OFFLINE_MODE");
      }

      // Build full history for continuous contextual conversational memory
      const history = turns
        .filter((t) => t.text && t.text.trim())
        .slice(-25)
        .map((t) => ({
          role: t.sender === "driver" ? "user" : "model",
          text: t.text,
        }));

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: query,
            history,
            carState,
          }),
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!res.ok) {
        throw new Error("پاسخی از سرور دریافت نشد");
      }

      const data = await res.json();
      if (data.provider) {
        setActiveEngineProvider(data.provider);
      }
      const replyText =
        data.reply || "پیام شما دریافت شد. در چه زمینه دیگری می‌توانم کمکتان کنم؟";

      // Execute in-car actions if triggered by AI
      let actionLabel = "";
      if (data.action) {
        switch (data.action) {
          case "reset_history":
            setTurns([
              {
                id: "init-" + Date.now(),
                sender: "system",
                text: replyText,
                timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
            actionLabel = "حافظه و زمینه گفتگو با موفقیت ریست شد (MRT)";
            break;
          case "lock_doors":
            onUpdateCarState({ doorsLocked: true });
            carAudio.playLockBeep(true);
            actionLabel = "قفل مرکزی BMW 728Li فعال شد";
            break;
          case "unlock_doors":
            onUpdateCarState({ doorsLocked: false });
            carAudio.playLockBeep(false);
            actionLabel = "قفل مرکزی باز شد";
            break;
          case "ac_on":
            onUpdateCarState({ acActive: true });
            actionLabel = "تهویه مطبوع ۴ کاناله BMW فعال شد";
            break;
          case "ac_off":
            onUpdateCarState({ acActive: false });
            actionLabel = "سیستم تهویه خاموش شد";
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
            actionLabel = "حالت رانندگی SPORT ب‌ام‌و فعال شد";
            break;
          case "comfort_mode":
            onUpdateCarState({ driveMode: "comfort" });
            actionLabel = "حالت رانندگی COMFORT فعال شد";
            break;
          case "eco_mode":
            onUpdateCarState({ driveMode: "eco" });
            actionLabel = "حالت رانندگی ECO PRO فعال شد";
            break;
          case "play_flash":
            if (onPlayFlashMusic) onPlayFlashMusic();
            actionLabel = "پخش موسیقی سیستم صوتی Hi-Fi";
            break;
          case "play_music":
            onUpdateCarState({ musicPlaying: true });
            actionLabel = "پخش موزیک";
            break;
          case "pause_music":
            onUpdateCarState({ musicPlaying: false });
            actionLabel = "توقف موزیک";
            break;
          case "headlights_on":
            onUpdateCarState({ headlightsActive: true });
            actionLabel = "چراغ‌های جلو روشن شد";
            break;
          case "headlights_off":
            onUpdateCarState({ headlightsActive: false });
            actionLabel = "چراغ‌های جلو خاموش شد";
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
              actionLabel = `BMW Navigation: مسیریابی به ${data.navigationData.destination}`;
            }
            break;
        }
      }

      if (data.action !== "reset_history") {
        const systemTurn: VoiceTurn = {
          id: "s-" + Date.now(),
          sender: "system",
          text: replyText,
          timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
          audioBase64: data.audioBase64,
          actionTaken: actionLabel,
        };

        setTurns((prev) => [...prev, systemTurn]);
      }

      if (onAddSessionTurn) {
        onAddSessionTurn(query, replyText, data.audioBase64);
      }

      // Speak response automatically
      speakText(replyText, data.audioBase64);
    } catch (err: any) {
      console.warn("AI Chat Offline Fallback:", err);
      const historyForOffline = turns
        .filter((t) => t.text && t.text.trim())
        .slice(-10)
        .map((t) => ({
          role: t.sender === "driver" ? "user" : "model",
          text: t.text,
        }));
      const offlineRes = parseOfflineCarCommand(query, carState, historyForOffline);
      if (offlineRes.matched) {
        setActiveEngineProvider("BMW DME Offline ECU");
        if (offlineRes.updatedState) {
          onUpdateCarState(offlineRes.updatedState);
        }
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
        if (offlineRes.action === "play_flash" && onPlayFlashMusic) {
          onPlayFlashMusic();
        }
        if (offlineRes.isMrtEnd) {
          setTurns([
            {
              id: "init-" + Date.now(),
              sender: "system",
              text: offlineRes.reply,
              timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        } else {
          setTurns((prev) => [
            ...prev,
            {
              id: "offline-" + Date.now(),
              sender: "system",
              text: offlineRes.reply,
              timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
              actionTaken: "پاسخ از موتور آفلاین BMW 728Li ECU",
            },
          ]);
        }
        speakText(offlineRes.reply);
      } else {
        const errorTurn: VoiceTurn = {
          id: "err-" + Date.now(),
          sender: "system",
          text: "در حالت آفلاین ECU ب‌ام‌و فعال است؛ می‌توانید وضعیت ماشین، دما، بنزین، کولر، قفل درها یا مسیریابی را بپرسید.",
          timestamp: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
        };
        setTurns((prev) => [...prev, errorTurn]);
        speakText(errorTurn.text);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const sampleVoicePrompts = [
    "وضعیت مصرف بنزین، فشار روغن و دمای موتور ب‌ام‌و چطوره؟",
    "امروز حالم گرفته، یه کم باهام حرف بزن و راهنماییم کن",
    "یه شعر انرژی‌بخش از حافظ یا مولانا برام بخون",
    "حالت رانندگی رو بذار روی اسپرت و تعلیق رو تنظیم کن",
    "مسیر شیراز به اصفهان رو برام بیار",
    "تهویه مطبوع رو روشن کن و دمای کابین رو بذار رو ۲۱ درجه",
  ];

  const voiceCommandCategories = [
    {
      id: "vehicle-control",
      title: "کنترل خودرو و ایمنی",
      icon: Car,
      accentClass: "text-sky-400 border-sky-500/30 bg-sky-950/30",
      commands: [
        { phrase: "درها رو قفل کن", desc: "فعال‌سازی قفل مرکزی خودرو" },
        { phrase: "قفل درها رو باز کن", desc: "باز کردن قفل مرکزی" },
        { phrase: "جفت راهنما روشن", desc: "روشن کردن فلاشر و چراغ خطر" },
        { phrase: "فلاشر رو خاموش کن", desc: "خاموش کردن جفت راهنما" },
        { phrase: "چراغ‌های جلو رو روشن کن", desc: "روشن کردن چراغ‌های جلو" },
        { phrase: "حالت رانندگی رو بذار روی اسپرت", desc: "تغییر مد به Sport / Comfort / Eco" },
      ],
    },
    {
      id: "navigation",
      title: "ناوبری و مسیریابی GPS",
      icon: Compass,
      accentClass: "text-emerald-400 border-emerald-500/30 bg-emerald-950/30",
      commands: [
        { phrase: "مسیر شیراز به اصفهان رو برام بیار", desc: "نمایش نقشه و مسیر ۴۸۵ کیلومتری" },
        { phrase: "مسیر تهران به مشهد رو نشون بده", desc: "تنظیم مسیر تهران - مشهد در GPS" },
        { phrase: "مسیر تهران به رشت رو بیار", desc: "مسیریابی آزادراه قزوین - رشت" },
        { phrase: "نقشه GPS رو باز کن", desc: "باز کردن ماژول ناوبری روی مانیتور" },
      ],
    },
    {
      id: "climate-media",
      title: "تهویه مطبوع و سیستم صوتی",
      icon: Music,
      accentClass: "text-amber-400 border-amber-500/30 bg-amber-950/30",
      commands: [
        { phrase: "کولر رو روشن کن", desc: "فعال‌سازی تهویه ۴ کاناله BMW" },
        { phrase: "بخاری رو روشن کن", desc: "تنظیم گرمایش کابین" },
        { phrase: "تهویه رو خاموش کن", desc: "خاموش کردن سیستم تهویه" },
        { phrase: "آهنگ‌های فلش رو پخش کن", desc: "پخش موزیک از حافظه USB" },
        { phrase: "آهنگ بعدی", desc: "رفتن به ترک بعدی پلی‌لیست" },
        { phrase: "موزیک رو متوقف کن", desc: "توقف پخش موسیقی" },
      ],
    },
    {
      id: "diagnostics",
      title: "گزارش فنی، سنسورها و دستیار",
      icon: ShieldCheck,
      accentClass: "text-violet-400 border-violet-500/30 bg-violet-950/30",
      commands: [
        { phrase: "وضعیت ماشین چطوره؟", desc: "گزارش کامل سرعت، بنزین و دما" },
        { phrase: "وضعیت دیاگ DME چطوره؟", desc: "بررسی خطاهای ECU و Double-VANOS" },
        { phrase: "دمای موتور و آب چقدره؟", desc: "خواندن سنسور دمای خنک‌کننده" },
        { phrase: "بنزین چقدر داریم؟", desc: "اعلام درصد باک و مسافت پیمایش" },
        { phrase: "دمای هوای بیرون چقدره؟", desc: "خواندن سنسور دمای محیط" },
        { phrase: "ام ار تی", desc: "ریست کامل حافظه گفتگوی فعلی (MRT)" },
      ],
    },
  ];

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div
      id="voice-assistant-modal-backdrop"
      className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn"
      dir="rtl"
      onClick={onClose}
    >
      <div
        id="voice-assistant-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-neutral-900 border border-sky-500/50 rounded-3xl shadow-[0_0_60px_rgba(14,165,233,0.25)] overflow-hidden flex flex-col max-h-[90vh] text-neutral-100 relative"
      >
        {/* Top Header */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* BMW Roundel Emblem SVG */}
            <div className="w-11 h-11 rounded-2xl bg-neutral-950 border border-neutral-700 p-1 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="48" fill="#111" stroke="#aaa" strokeWidth="3" />
                <text x="50" y="22" fill="#fff" fontSize="12" fontWeight="900" textAnchor="middle" letterSpacing="2">BMW</text>
                <circle cx="50" cy="58" r="28" fill="#000" stroke="#fff" strokeWidth="2" />
                <path d="M 50 58 L 50 30 A 28 28 0 0 1 78 58 Z" fill="#0066b2" />
                <path d="M 50 58 L 50 86 A 28 28 0 0 1 22 58 Z" fill="#0066b2" />
                <path d="M 50 58 L 22 58 A 28 28 0 0 1 50 30 Z" fill="#ffffff" />
                <path d="M 50 58 L 78 58 A 28 28 0 0 1 50 86 Z" fill="#ffffff" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono">دستیار صوتی هوشمند BMW 728Li</h2>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold transition-all ${
                  activeEngineProvider.toLowerCase().includes("openai")
                    ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                    : "bg-sky-950/80 border-sky-500 text-sky-300"
                }`}>
                  {activeEngineProvider}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                مکالمه پیوسته با حافظه کامل تا دستور MRT • ضبط صدای ۵ دقیقه‌ای
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="voice-commands-sheet-toggle"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setShowCommandsSheet((prev) => !prev);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 flex items-center gap-1.5 ${
                showCommandsSheet
                  ? "bg-sky-500/20 border-sky-400 text-sky-200"
                  : "bg-neutral-800/80 hover:bg-neutral-700 border-neutral-700 text-neutral-200 hover:text-sky-300"
              }`}
              title="مشاهده لیست کامل فرمان‌های صوتی پشتیبانی‌شده"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {showCommandsSheet ? "بازگشت به گفتگو" : "فرمان‌های صوتی"}
              </span>
            </button>

            <button
              onClick={handleResetMemory}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-sky-300 text-xs font-medium transition active:scale-95 flex items-center gap-1.5"
              title="ریست حافظه گفتگو (یا گفتن کلمه MRT)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ریست حافظه (MRT)</span>
            </button>

            {isSpeaking && (
              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  stopSpeaking();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500 text-amber-300 text-xs font-bold transition active:scale-95 flex items-center gap-1.5 animate-pulse"
                title="توقف صحبت گوینده"
              >
                <VolumeX className="w-4 h-4" />
                <span>توقف صدا</span>
              </button>
            )}

            <button
              onClick={() => {
                carAudio.playButtonTap();
                stopSpeaking();
                onClose();
              }}
              className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Memory & 5-minute timer subheader */}
        <div className="bg-neutral-950/95 border-b border-neutral-800/80 px-4 py-2 flex items-center justify-between text-[11px] text-neutral-300 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-300 font-bold">حافظه پیوسته مکالمه فعال است</span>
            <span className="text-neutral-500 font-mono">({turns.length - 1} پیام در حافظه)</span>
          </div>

          <div className="flex items-center gap-3">
            {isListening && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/60 text-rose-300 font-mono font-bold animate-pulse">
                <span>مهلت ۵ دقیقه:</span>
                <span className="tracking-wider">{formatCountdown(secondsRemaining)}</span>
              </div>
            )}

            <span className="text-neutral-400 text-[10px]">
              پاک‌سازی حافظه با: <strong className="text-amber-400 font-mono">«MRT»</strong> یا دکمه ریست
            </span>
          </div>
        </div>

        {/* Conversation Body OR Available Voice Commands Reference Sheet */}
        {showCommandsSheet ? (
          <div
            id="voice-commands-sheet"
            className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[260px] max-h-[380px] bg-neutral-950/60"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-800">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  راهنمای فرمان‌های صوتی پشتیبانی‌شده (Available Voice Commands)
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  برای اجرای سریع هر فرمان، عبارت آن را بیان کنید یا مستقیماً روی کارت کلیک کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  setShowCommandsSheet(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-neutral-200 shrink-0"
              >
                بستن راهنما
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {voiceCommandCategories.map((category) => {
                const IconComp = category.icon;
                return (
                  <div
                    key={category.id}
                    className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2 pb-1.5 border-b border-neutral-800/80">
                      <div
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${category.accentClass}`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-white">{category.title}</h4>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {category.commands.map((cmd, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            carAudio.playButtonTap();
                            setShowCommandsSheet(false);
                            handleSendMessage(cmd.phrase);
                          }}
                          className="text-right p-2 rounded-xl bg-neutral-950/80 hover:bg-neutral-800/90 border border-neutral-800/80 hover:border-sky-500/40 transition active:scale-[0.99] flex flex-col gap-0.5"
                        >
                          <span className="text-xs font-bold text-sky-300">«{cmd.phrase}»</span>
                          <span className="text-[10px] text-neutral-400">{cmd.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 min-h-[260px] max-h-[360px]">
            {turns.map((t) => (
              <div
                key={t.id}
                className={`flex flex-col gap-1 ${
                  t.sender === "driver" ? "items-start" : "items-end"
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                    t.sender === "driver"
                      ? "bg-neutral-800 text-white border border-neutral-700 rounded-tr-sm"
                      : "bg-gradient-to-br from-sky-950/80 via-neutral-900 to-neutral-900 text-sky-100 border border-sky-500/30 rounded-tl-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-neutral-400 font-mono">
                      {t.sender === "driver" ? "🗣️ شما (راننده)" : "🚘 دستیار هوشمند BMW 728Li"}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">{t.timestamp}</span>
                  </div>

                  <p className="whitespace-pre-wrap">{t.text}</p>

                  {t.actionTaken && (
                    <div className="mt-2 pt-2 border-t border-sky-500/20 flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>عملیات ب‌ام‌و: {t.actionTaken}</span>
                    </div>
                  )}

                  {t.sender === "system" && (
                    <div className="mt-2 flex items-center gap-2 pt-1 border-t border-neutral-800">
                      <button
                        onClick={() => {
                          carAudio.playButtonTap();
                          speakText(t.text, t.audioBase64);
                        }}
                        className="text-[11px] text-sky-400 hover:text-sky-200 flex items-center gap-1 font-medium transition active:scale-95"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>پخش مجدد صوت</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex items-end flex-col">
                <div className="bg-neutral-900 border border-sky-500/40 rounded-2xl p-3 text-xs text-sky-300 flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  <span>در حال پردازش هوشمند و آماده‌سازی پاسخ صوتی BMW...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Real-time Voice Wave / Speech Input Indicator (5-minute banner) */}
        {(isListening || micStatusText) && (
          <div className="bg-sky-950/80 border-t border-b border-sky-500/40 px-4 py-3 flex flex-col gap-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-sky-300">
                {isListening && (
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-4 bg-rose-500 rounded-full animate-bounce" />
                    <span className="w-1.5 h-6 bg-rose-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1.5 h-4 bg-rose-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                )}
                <span className="font-bold">
                  {micStatusText || (isListening ? "میکروفون تا ۵ دقیقه فعال است... بفرمایید" : "")}
                </span>
              </div>

              {isListening && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-amber-300 font-bold">
                    ⏱️ زمان باقیمانده: {formatCountdown(secondsRemaining)}
                  </span>
                  <button
                    onClick={() => {
                      const txt = transcriptRef.current.trim() || inputText.trim();
                      stopListeningInternal();
                      if (txt) handleSendMessage(txt);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95"
                  >
                    ارسال صحبت
                  </button>
                </div>
              )}
            </div>

            {/* Display full recognized speech text */}
            {transcript && (
              <div className="bg-neutral-900/90 border border-sky-500/30 p-2.5 rounded-xl text-xs text-white max-h-24 overflow-y-auto leading-relaxed">
                <span className="text-[10px] text-sky-400 font-bold block mb-0.5">متن دریافت شده از صدای شما:</span>
                <p className="whitespace-pre-wrap">{transcript}</p>
              </div>
            )}
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 bg-neutral-950 border-t border-neutral-800 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-neutral-500 shrink-0 font-bold">پیشنهاد گفتگو:</span>
          {sampleVoicePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                carAudio.playButtonTap();
                handleSendMessage(p);
              }}
              className="px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-sky-500/50 hover:bg-sky-950/50 text-neutral-300 hover:text-sky-300 shrink-0 transition active:scale-95"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Bottom Interactive Mic & Text Input Controls */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2">
          {/* Giant Automotive Voice Mic Trigger */}
          <button
            id="voice-modal-mic-btn"
            onClick={toggleListening}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 transition-all active:scale-90 shadow-xl ${
              isListening
                ? "bg-rose-600 text-white animate-pulse shadow-rose-600/50 ring-4 ring-rose-500/40"
                : isSpeaking
                ? "bg-amber-600 text-white animate-pulse shadow-amber-600/40"
                : "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white font-bold hover:brightness-110 shadow-sky-500/30"
            }`}
            title={isListening ? "توقف شنود و ارسال" : "لمس برای صحبت با دستیار صوتی (تا ۵ دقیقه)"}
          >
            {isListening ? (
              <MicOff className="w-6 h-6" />
            ) : isSpeaking ? (
              <Volume2 className="w-6 h-6 animate-spin" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
            <span className="text-[9px] font-black mt-0.5">
              {isListening ? "ارسال (۵د)" : isSpeaking ? "پخش..." : "صحبت (۵د)"}
            </span>
          </button>

          {/* Text input with send button */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex-1 flex items-center gap-1.5 bg-neutral-900 rounded-2xl border border-neutral-800 focus-within:border-sky-500 px-3 py-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="صحبت کنید (تا ۵ دقیقه) یا هر موضوعی را تایپ کنید..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-neutral-950 transition active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
