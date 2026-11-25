import { useState, useEffect, useRef, useCallback, lazy, Suspense, type ComponentType } from "react";
import { CarState, MusicTrack, RecordedSession, NavigationRoute, EngineTelemetryPoint, PreConditioningSchedule } from "./types";
import CarHeader, { MainAppTab } from "./components/CarHeader";
import DashboardView from "./components/DashboardView";
import FactorySettingsModal from "./components/FactorySettingsModal";

function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 3
) {
  return lazy(async () => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await importer();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    const FallbackView = ((props: { onClose?: () => void; onExitStealth?: () => void }) => (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
        <div className="cockpit-panel rounded-2xl p-5 max-w-sm w-full flex flex-col gap-3 text-center">
          <p className="text-sm font-bold text-white">خطا در بارگذاری این بخش</p>
          <p className="text-xs text-amber-100/80">ارتباط با سرور یا حافظه موقت دچار وقفه شد. صفحه را مجدد بارگذاری کنید.</p>
          <div className="flex items-center justify-center gap-2">
            {(props?.onClose || props?.onExitStealth) && (
              <button
                type="button"
                onClick={() => (props.onClose ? props.onClose() : props.onExitStealth?.())}
                className="px-4 py-2 rounded-xl hardware-key text-xs font-semibold text-white"
              >
                بستن
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bmw-accent-btn text-xs font-bold"
            >
              بارگذاری مجدد صفحه
            </button>
          </div>
        </div>
      </div>
    )) as unknown as T;
    return { default: FallbackView };
  });
}

const NavigationModule = lazyWithRetry(() => import("./components/NavigationModule"));
const CarControlsModule = lazyWithRetry(() => import("./components/CarControlsModule"));
const MusicPlayerModule = lazyWithRetry(() => import("./components/MusicPlayerModule"));
const SettingsHubModule = lazyWithRetry(() => import("./components/SettingsHubModule"));
const SystemSpecsModal = lazyWithRetry(() => import("./components/SystemSpecsModal"));
const StealthHUDOverlay = lazyWithRetry(() => import("./components/StealthHUDOverlay"));
const RecordedSessionsModal = lazyWithRetry(() => import("./components/RecordedSessionsModal"));
const VoiceAssistantModal = lazyWithRetry(() => import("./components/VoiceAssistantModal"));
const Bmw3DShowroom = lazyWithRetry(() => import("./components/Bmw3DShowroom"));
const SosEmergencyModal = lazyWithRetry(() => import("./components/SosEmergencyModal"));
import { CheckCircle2, WifiOff, X, SunMedium, CloudDownload } from "lucide-react";
import { carAudio, speakText } from "./utils/carSpeech";
import {
  AMBIENT_LIGHTING_THEMES,
  AmbientLightingThemeId,
  DEFAULT_AMBIENT_THEME_ID,
  applyAmbientThemeCssVars,
  getAmbientTheme,
} from "./utils/ambientThemes";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import {
  HeadunitMonitorProfile,
  applyMonitorCssCalibration,
  loadSavedHeadunitProfile,
  runMonitorAutoResetAndMatch,
  shouldAutoRunHeadunitCalibration,
} from "./utils/headunitAutoSync";
import { matchJarvisWake, matchJarvisWakeFromAlternatives } from "./utils/jarvisVoice";
import {
  TimeGreetingInfo,
  evaluateCopilotAlerts,
  getTimeOfDayGreeting,
} from "./utils/jarvisCopilot";
import { carEcuBridge } from "./utils/carEcuBridge";
import { cabinMicNoiseFilter } from "./utils/micNoiseFilter";
import {
  HeadunitOtaStatus,
  runHeadunitAutoUpdateAndResourceSync,
} from "./utils/headunitUpdater";
import {
  clearUsbVault,
  isDirectoryPickerSupported,
  loadLastTrackPosition,
  loadUsbTracksFromVault,
  pickAndPersistUsbFolder,
  removeUsbTrackFromVault,
  saveLastTrackPosition,
  saveUsbFilesToVault,
  syncSavedUsbFolderIfPermitted,
} from "./utils/usbMusicVault";

const DEFAULT_SAMPLE_TRACKS: MusicTrack[] = [
  {
    id: "track-1",
    title: "Phantom Thread (موسیقی فیلم)",
    artist: "Jonny Greenwood - ارکسترال ویژه رانندگی",
    duration: "03:45",
    isFlash: true,
  },
  {
    id: "track-2",
    title: "ریتم انرژی‌بخش اتوبان و سفر",
    artist: "BMW Hi-Fi Sound Experience",
    duration: "04:12",
    isFlash: true,
  },
  {
    id: "track-3",
    title: "نوستالژی شبانه در اتوبان",
    artist: "پیانو و ویولن سنتی",
    duration: "03:20",
    isFlash: false,
  },
  {
    id: "track-4",
    title: "پلی‌لیست سفرهای طولانی",
    artist: "موسیقی بی‌کلام آرامش‌بخش",
    duration: "03:55",
    isFlash: true,
  },
];

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// BMW 728Li (M52TUB28 + ZF 5HP19 5-speed automatic) RPM estimation from GPS/vehicle speed
function computeBmwRpmFromSpeed(
  speedKmh: number,
  driveMode: CarState["driveMode"],
  gear: string
): number {
  const cleanSpeed = Math.max(0, Math.min(260, Number.isFinite(speedKmh) ? speedKmh : 0));
  const modeOffset = driveMode === "sport" ? 320 : driveMode === "eco" ? -140 : 0;

  if (gear === "P" || gear === "N" || cleanSpeed < 2) {
    const idleBase = driveMode === "sport" ? 860 : driveMode === "eco" ? 760 : 810;
    return idleBase;
  }

  // Approximate shift curve across ZF 5HP19 gears 1..5
  let ratioRpm: number;
  if (cleanSpeed < 28) {
    ratioRpm = 950 + cleanSpeed * 58;
  } else if (cleanSpeed < 56) {
    ratioRpm = 1350 + (cleanSpeed - 28) * 42;
  } else if (cleanSpeed < 92) {
    ratioRpm = 1650 + (cleanSpeed - 56) * 34;
  } else if (cleanSpeed < 135) {
    ratioRpm = 1950 + (cleanSpeed - 92) * 30;
  } else {
    ratioRpm = 2400 + (cleanSpeed - 135) * 27;
  }

  return Math.max(720, Math.min(6500, Math.round(ratioRpm + modeOffset)));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MainAppTab>("dash");
  const [settingsSubTab, setSettingsSubTab] = useState<
    "ecu" | "telemetry" | "visual" | "schedule" | "system"
  >("ecu");
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isFactoryOpen, setIsFactoryOpen] = useState(false);
  const [factoryInitialTab, setFactoryInitialTab] = useState<
    "canbus" | "audio" | "display" | "logo" | "github" | "reset"
  >("canbus");
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [jarvisStandbyEnabled, setJarvisStandbyEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("bmw728li_jarvis_wake");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  const [jarvisStandbyListening, setJarvisStandbyListening] = useState(false);
  const [jarvisMicStatus, setJarvisMicStatus] = useState<
    "listening" | "initializing" | "paused_speaking" | "blocked" | "unsupported" | "disabled"
  >(() => (jarvisStandbyEnabled ? "initializing" : "disabled"));
  const [micNoiseFilterActive, setMicNoiseFilterActive] = useState(false);
  const [wokenByJarvis, setWokenByJarvis] = useState(false);
  const [pendingWakeCommand, setPendingWakeCommand] = useState<string | null>(null);
  const [is3DShowroomOpen, setIs3DShowroomOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [stealthHudActive, setStealthHudActive] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState<string>("");
  const [activeCustomRoute, setActiveCustomRoute] = useState<NavigationRoute | null>({
    origin: "شیراز",
    destination: "اصفهان",
    distance: "۴۸۵ کیلومتر",
    duration: "۵ ساعت و ۲۰ دقیقه",
    nextTurn: "در بزرگراه خلیج فارس به سمت آباده و اصفهان ادامه دهید.",
    turnDistance: "۳۰۰ متر",
    speedLimit: 110,
    eta: "۱۷:۳۰",
  });

  const { isOnline: browserOnline, isOfflineReady } = useOnlineStatus();
  const [gpsConnected, setGpsConnected] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [monitorCalibrationBanner, setMonitorCalibrationBanner] = useState<HeadunitMonitorProfile | null>(null);
  const [ignitionGreetingBanner, setIgnitionGreetingBanner] = useState<TimeGreetingInfo | null>(null);
  const [otaSyncBanner, setOtaSyncBanner] = useState<HeadunitOtaStatus | null>(null);
  const otaSyncedOnlineRef = useRef<boolean>(false);
  const spokenAlertsRef = useRef<Set<string>>(new Set());
  const continuousDrivingSecRef = useRef<number>(0);
  const stationarySecRef = useRef<number>(0);

  const isSpeakingRef = useRef<boolean>(false);

  // Track speaking status from carAudio & cabin mic noise filter + unlock audio on first interaction
  useEffect(() => {
    const unsubSpeak = carAudio.onSpeakingChange((speaking) => {
      isSpeakingRef.current = speaking;
      setIsSpeaking(speaking);
    });
    const unsubNoise = cabinMicNoiseFilter.subscribe((st) => {
      setMicNoiseFilterActive(st.active);
    });
    const onUnlock = () => {
      carAudio.unlockAudio();
    };
    window.addEventListener("pointerdown", onUnlock, { passive: true });
    window.addEventListener("keydown", onUnlock, { passive: true });
    return () => {
      unsubSpeak();
      unsubNoise();
      window.removeEventListener("pointerdown", onUnlock);
      window.removeEventListener("keydown", onUnlock);
    };
  }, []);

  // Persist Jarvis wake-word standby preference
  useEffect(() => {
    try {
      localStorage.setItem("bmw728li_jarvis_wake", String(jarvisStandbyEnabled));
    } catch {}
  }, [jarvisStandbyEnabled]);

  // Automatic Time-of-Day Ignition Greeting ("صبح بخیر" / "وقت بخیر" / "عصر بخیر" / "شب بخیر")
  useEffect(() => {
    if (typeof window === "undefined") return;
    const greeting = getTimeOfDayGreeting(new Date());
    setIgnitionGreetingBanner(greeting);

    let spoken = false;
    const triggerGreetingVoice = () => {
      if (spoken) return;
      spoken = true;
      window.removeEventListener("pointerdown", triggerGreetingVoice);
      window.removeEventListener("keydown", triggerGreetingVoice);
      carAudio.playBmwGong();
      window.setTimeout(() => {
        void speakText(greeting.greetingText);
      }, 320);
    };

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as any).standalone === true;
    const hasActivation = Boolean((navigator as any).userActivation?.hasBeenActive);

    const timer = window.setTimeout(() => {
      if (isStandalone || hasActivation) {
        triggerGreetingVoice();
      }
    }, 900);

    window.addEventListener("pointerdown", triggerGreetingVoice, { once: true });
    window.addEventListener("keydown", triggerGreetingVoice, { once: true });

    const autoHide = window.setTimeout(() => {
      setIgnitionGreetingBanner(null);
    }, 18000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(autoHide);
      window.removeEventListener("pointerdown", triggerGreetingVoice);
      window.removeEventListener("keydown", triggerGreetingVoice);
    };
  }, []);

  // Automatic OTA Update & Required Offline Resource Pre-Download on Internet Connection
  useEffect(() => {
    if (!browserOnline) {
      otaSyncedOnlineRef.current = false;
      return;
    }
    if (otaSyncedOnlineRef.current) return;
    otaSyncedOnlineRef.current = true;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const status = await runHeadunitAutoUpdateAndResourceSync({ silent: true });
      if (!cancelled && (status.updateAvailable || status.cachedAssetsCount > 0)) {
        setOtaSyncBanner(status);
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [browserOnline]);

  // Persistent Background Jarvis Wake-Word Listener ("جارویز" / "جارویس") when Voice Modal is closed
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!jarvisStandbyEnabled) {
      setJarvisStandbyListening(false);
      setJarvisMicStatus("disabled");
      return;
    }
    if (isVoiceModalOpen) {
      setJarvisStandbyListening(false);
      setJarvisMicStatus("listening");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setJarvisStandbyListening(false);
      setJarvisMicStatus("unsupported");
      return;
    }

    setJarvisMicStatus("initializing");

    let cancelled = false;
    let recognition: any = null;
    let restartTimer: number | null = null;
    let wakeDebounceTimer: number | null = null;
    let handoffTimer: number | null = null;
    let gestureAttached = false;
    let wakingUp = false;
    let recognitionActive = false;
    let micPermissionBlocked = false;
    let pendingWakeRemainder = "";

    const cleanupGesture = () => {
      if (!gestureAttached) return;
      gestureAttached = false;
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };

    const startStandby = () => {
      if (
        cancelled ||
        wakingUp ||
        !recognition ||
        recognitionActive ||
        micPermissionBlocked ||
        isSpeakingRef.current
      ) {
        return;
      }
      try {
        recognition.start();
      } catch {}
    };

    const onFirstGesture = () => {
      carAudio.unlockAudio();
      micPermissionBlocked = false;
      cleanupGesture();
      startStandby();
    };

    const finishHandoffToModal = (remainderCommand: string) => {
      if (cancelled) return;
      cancelled = true;
      cleanupGesture();
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      if (wakeDebounceTimer !== null) window.clearTimeout(wakeDebounceTimer);
      if (handoffTimer !== null) window.clearTimeout(handoffTimer);
      setJarvisStandbyListening(false);
      carAudio.unlockAudio();
      carAudio.playAssistantWakeChime();
      setWokenByJarvis(true);
      setPendingWakeCommand(remainderCommand || null);
      setIsVoiceModalOpen(true);
    };

    const triggerWakeHandoff = (remainderCommand: string) => {
      if (cancelled || wakingUp) return;
      wakingUp = true;
      pendingWakeRemainder = remainderCommand;
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      if (wakeDebounceTimer !== null) window.clearTimeout(wakeDebounceTimer);
      try {
        recognition.stop();
      } catch {
        finishHandoffToModal(pendingWakeRemainder);
        return;
      }
      handoffTimer = window.setTimeout(() => {
        finishHandoffToModal(pendingWakeRemainder);
      }, 320);
    };

    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.lang = "fa-IR";

      recognition.onstart = () => {
        recognitionActive = true;
        micPermissionBlocked = false;
        if (!cancelled && !wakingUp) {
          setJarvisStandbyListening(true);
          setJarvisMicStatus("listening");
        }
      };

      recognition.onresult = (event: any) => {
        if (cancelled || wakingUp || isSpeakingRef.current) return;
        let combined = "";
        let matchedWake = { woke: false, remainderCommand: "" };
        let hasFinalSegment = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item?.isFinal) hasFinalSegment = true;
          combined += " " + (item?.[0]?.transcript || "");
          const altMatch = matchJarvisWakeFromAlternatives(item);
          if (altMatch.woke) {
            matchedWake = altMatch;
            if (altMatch.remainderCommand) break;
          }
        }

        const fullMatch = matchJarvisWake(combined);
        const match =
          fullMatch.woke && fullMatch.remainderCommand.length >= matchedWake.remainderCommand.length
            ? fullMatch
            : matchedWake.woke
              ? matchedWake
              : fullMatch;

        if (match.woke) {
          pendingWakeRemainder = match.remainderCommand;
          if (hasFinalSegment || match.remainderCommand.length >= 4) {
            triggerWakeHandoff(match.remainderCommand);
          } else {
            if (wakeDebounceTimer !== null) window.clearTimeout(wakeDebounceTimer);
            wakeDebounceTimer = window.setTimeout(() => {
              triggerWakeHandoff(pendingWakeRemainder);
            }, 260);
          }
        }
      };

      recognition.onerror = (event: any) => {
        recognitionActive = false;
        if (cancelled || wakingUp) return;
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          micPermissionBlocked = true;
          setJarvisStandbyListening(false);
          setJarvisMicStatus("blocked");
          if (!gestureAttached) {
            gestureAttached = true;
            window.addEventListener("pointerdown", onFirstGesture, { once: true });
            window.addEventListener("keydown", onFirstGesture, { once: true });
          }
        }
      };

      recognition.onend = () => {
        recognitionActive = false;
        if (wakingUp && !cancelled) {
          finishHandoffToModal(pendingWakeRemainder);
          return;
        }
        if (!cancelled) {
          setJarvisStandbyListening(false);
          if (!micPermissionBlocked) {
            setJarvisMicStatus(isSpeakingRef.current ? "paused_speaking" : "initializing");
            const delay = isSpeakingRef.current ? 700 : 280;
            restartTimer = window.setTimeout(() => {
              startStandby();
            }, delay);
          }
        }
      };

      // Immediately resume standby right after Jarvis finishes any greeting/alert speech
      const unsubSpeech = carAudio.onSpeakingChange((speaking) => {
        if (!speaking && !cancelled && !wakingUp && !recognitionActive && !micPermissionBlocked) {
          window.setTimeout(() => startStandby(), 220);
        }
      });

      // Boot immediately on startup + periodic watchdog so standby never stays silent
      const bootTimer = window.setTimeout(() => {
        startStandby();
      }, 180);

      const watchdogInterval = window.setInterval(() => {
        if (
          !cancelled &&
          !wakingUp &&
          !recognitionActive &&
          !micPermissionBlocked &&
          !isSpeakingRef.current
        ) {
          startStandby();
        }
      }, 3500);

      gestureAttached = true;
      window.addEventListener("pointerdown", onFirstGesture, { once: true });
      window.addEventListener("keydown", onFirstGesture, { once: true });

      return () => {
        cancelled = true;
        unsubSpeech();
        window.clearTimeout(bootTimer);
        window.clearInterval(watchdogInterval);
        if (restartTimer !== null) window.clearTimeout(restartTimer);
        if (wakeDebounceTimer !== null) window.clearTimeout(wakeDebounceTimer);
        if (handoffTimer !== null) window.clearTimeout(handoffTimer);
        cleanupGesture();
        setJarvisStandbyListening(false);
        try {
          recognition?.stop();
        } catch {}
      };
    } catch {
      setJarvisStandbyListening(false);
    }
  }, [jarvisStandbyEnabled, isVoiceModalOpen]);

  // Diagnostic Logs Database (persisted locally for full offline availability)
  const [recordedSessions, setRecordedSessions] = useState<RecordedSession[]>(() => {
    try {
      const saved = localStorage.getItem("bmw728li_diagnostic_sessions_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: "diag-1",
        startTime: "۱۲:۴۵:۰۰",
        title: "چکاپ کامل سیستم ب‌ام‌و (Bosch DME & CAN-Bus)",
        turns: [
          { id: "t1", sender: "assistant", text: "تمامی سنسورهای سیستم Double-VANOS، فشار روغن و دمای موتور ب‌ام‌و در محدوده استاندارد هستند.", timestamp: "۱۲:۴۵:۰۲" },
          { id: "t2", sender: "assistant", text: "کد خطای فعال (DTC) در حافظه کامپیوتر DME یافت نشد.", timestamp: "۱۲:۴۵:۰۵" },
        ],
        turnCount: 2,
        savedAt: "امروز",
      },
    ];
  });

  // Shared playlist for USB Flash & permanent IndexedDB vault
  const [playlist, setPlaylist] = useState<MusicTrack[]>(DEFAULT_SAMPLE_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [usbSavedCount, setUsbSavedCount] = useState(0);
  const [usbFolderName, setUsbFolderName] = useState<string>(() => {
    try {
      return localStorage.getItem("bmw728li_usb_folder_name") || "";
    } catch {
      return "";
    }
  });
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState("00:00");
  const masterAudioRef = useRef<HTMLAudioElement | null>(null);

  const [carState, setCarState] = useState<CarState>({
    speed: 0,
    maxSpeed: 260,
    rpm: 810,
    fuelPercent: 68,
    batteryVoltage: 14.2,
    engineTemp: 90,
    outsideTemp: 22,
    intakeTemp: 26,
    oilPressureBar: 4.8,
    rangeKm: 640,
    gear: "D",
    ecuConnected: true,
    ecuType: "BMW Bosch DME MS42 / MEVD17",
    carModel: "BMW 728Li iDrive ID6",
    obdProtocol: "BMW D-CAN / ISO 14229",
    dtcErrorCount: 0,
    doorsLocked: true,
    hazardActive: false,
    leftSignal: false,
    rightSignal: false,
    headlightsActive: false,
    highBeamActive: false,
    fogLightsActive: false,
    acActive: true,
    acTemp: 22,
    acFanSpeed: 2,
    acMode: "auto",
    windowsOpen: { fl: false, fr: false, rl: false, rr: false },
    sunroofOpen: false,
    tpms: { fl: 32, fr: 32, rl: 33, rr: 32 },
    musicPlaying: true,
    volume: 65,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    driveMode: "comfort",
    ambientLightingColor: (() => {
      try {
        const saved = localStorage.getItem("bmw728li_ambient_theme") as AmbientLightingThemeId | null;
        if (saved && AMBIENT_LIGHTING_THEMES.some((t) => t.id === saved)) {
          return saved;
        }
      } catch {}
      return DEFAULT_AMBIENT_THEME_ID;
    })(),
    ambientLightingBrightness: 85,
    stealthHudActive: false,
    alwaysListening: false,
    currentTrackIndex: 0,
  });

  // Trip Meter state: tracks distance traveled & elapsed time since engine start
  const [tripDistanceKm, setTripDistanceKm] = useState<number>(0);
  const [tripElapsedSeconds, setTripElapsedSeconds] = useState<number>(0);
  const currentSpeedRef = useRef<number>(carState.speed);

  // Oil Life Monitoring state: tracks mileage & engine hours since last oil service
  const [oilMileageKm, setOilMileageKm] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("bmw728li_oil_life");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.mileageKm === "number" && Number.isFinite(parsed.mileageKm)) {
          return Math.max(0, parsed.mileageKm);
        }
      }
    } catch {}
    return 2840;
  });

  const [oilEngineHours, setOilEngineHours] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("bmw728li_oil_life");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.engineHours === "number" && Number.isFinite(parsed.engineHours)) {
          return Math.max(0, parsed.engineHours);
        }
      }
    } catch {}
    return 72.5;
  });

  const [oilLastResetDate, setOilLastResetDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("bmw728li_oil_life");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lastResetDate === "string" && parsed.lastResetDate.trim()) {
          return parsed.lastResetDate;
        }
      }
    } catch {}
    return new Date().toLocaleDateString("fa-IR");
  });

  // Trip Engine Health Telemetry History (Oil Pressure & Engine Temperature)
  const formatElapsedLabel = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const [engineTelemetryHistory, setEngineTelemetryHistory] = useState<EngineTelemetryPoint[]>(() => [
    { time: "00:00", elapsedSec: 0, oilPressureBar: 2.9, engineTemp: 76 },
    { time: "00:15", elapsedSec: 15, oilPressureBar: 3.4, engineTemp: 81 },
    { time: "00:30", elapsedSec: 30, oilPressureBar: 3.9, engineTemp: 85 },
    { time: "00:45", elapsedSec: 45, oilPressureBar: 4.2, engineTemp: 88 },
    { time: "01:00", elapsedSec: 60, oilPressureBar: 4.0, engineTemp: 90 },
  ]);

  const telemetryRef = useRef({
    rpm: carState.rpm,
    speed: carState.speed,
    driveMode: carState.driveMode,
    engineTemp: carState.engineTemp,
    oilPressureBar: carState.oilPressureBar ?? 4.0,
    elapsed: 60,
  });

  const carStateRef = useRef<CarState>(carState);
  useEffect(() => {
    carStateRef.current = carState;
    currentSpeedRef.current = carState.speed;
    telemetryRef.current.rpm = carState.rpm;
    telemetryRef.current.speed = carState.speed;
    telemetryRef.current.driveMode = carState.driveMode;
    carEcuBridge.syncFromCarState(carState);

    // Speak critical mechanical ECU issues only (no intrusive warning menu banner)
    const immediateAlerts = evaluateCopilotAlerts(
      carState,
      continuousDrivingSecRef.current,
      new Date()
    ).filter((a) => a.severity === "critical");

    const activeIds = new Set(immediateAlerts.map((a) => a.id));
    spokenAlertsRef.current.forEach((spokenId) => {
      if (!activeIds.has(spokenId)) {
        spokenAlertsRef.current.delete(spokenId);
      }
    });

    if (immediateAlerts.length > 0) {
      const topAlert = immediateAlerts[0];
      if (!spokenAlertsRef.current.has(topAlert.id) && !isVoiceModalOpen) {
        spokenAlertsRef.current.add(topAlert.id);
        carAudio.playBmwGong();
        window.setTimeout(() => {
          void speakText(topAlert.spokenMessage);
        }, 280);
      }
    }
  }, [carState, isVoiceModalOpen]);

  // Proactive Co-Pilot Monitor: Critical ECU fault check only
  useEffect(() => {
    let active = true;
    const runCheck = () => {
      if (!active) return;
      const stateNow = carStateRef.current;
      if (stateNow.speed > 5) {
        continuousDrivingSecRef.current += 8;
        stationarySecRef.current = 0;
      } else {
        stationarySecRef.current += 8;
        if (stationarySecRef.current >= 180) {
          continuousDrivingSecRef.current = 0;
        }
      }

      const criticalAlerts = evaluateCopilotAlerts(
        stateNow,
        continuousDrivingSecRef.current,
        new Date()
      ).filter((a) => a.severity === "critical");

      const activeIds = new Set(criticalAlerts.map((a) => a.id));
      spokenAlertsRef.current.forEach((spokenId) => {
        if (!activeIds.has(spokenId)) {
          spokenAlertsRef.current.delete(spokenId);
        }
      });

      if (criticalAlerts.length > 0) {
        const topAlert = criticalAlerts[0];
        if (!spokenAlertsRef.current.has(topAlert.id) && !isVoiceModalOpen) {
          spokenAlertsRef.current.add(topAlert.id);
          carAudio.playBmwGong();
          window.setTimeout(() => {
            void speakText(topAlert.spokenMessage);
          }, 280);
        }
      }
    };

    const bootDelay = window.setTimeout(runCheck, 8000);
    const interval = window.setInterval(runCheck, 8000);
    return () => {
      active = false;
      window.clearTimeout(bootDelay);
      window.clearInterval(interval);
    };
  }, [isVoiceModalOpen]);

  // Connect Speedometer & RPM directly to Car Monitor GPS & Headunit CAN/Android Telemetry Bridge
  useEffect(() => {
    if (typeof window === "undefined") return;
    let watchId: number | null = null;
    let lastPos: { lat: number; lon: number; time: number } | null = null;

    const isHardwareObdActive = () => {
      const transport = carEcuBridge.getSnapshot().transport;
      return transport === "bluetooth-elm327" || transport === "usb-serial-kdcan";
    };

    const applyGpsSpeed = (rawSpeedKmh: number) => {
      if (isHardwareObdActive()) return;
      const clamped = Math.max(0, Math.min(260, Math.round(rawSpeedKmh < 2.5 ? 0 : rawSpeedKmh)));
      setCarState((prev) => {
        const nextRpm = computeBmwRpmFromSpeed(clamped, prev.driveMode, prev.gear);
        if (prev.speed === clamped && Math.abs(prev.rpm - nextRpm) < 12) return prev;
        return {
          ...prev,
          speed: clamped,
          rpm: nextRpm,
        };
      });
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsConnected(true);
          setGpsCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          if (
            typeof pos.coords.speed === "number" &&
            Number.isFinite(pos.coords.speed) &&
            pos.coords.speed >= 0
          ) {
            applyGpsSpeed(pos.coords.speed * 3.6);
          }
          lastPos = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            time: pos.timestamp || Date.now(),
          };
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsConnected(true);
          setGpsCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          const nowTs = pos.timestamp || Date.now();
          const coordsSpeed = pos.coords.speed;

          if (typeof coordsSpeed === "number" && Number.isFinite(coordsSpeed) && coordsSpeed >= 0) {
            applyGpsSpeed(coordsSpeed * 3.6);
            lastPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, time: nowTs };
            return;
          }

          if (lastPos && (pos.coords.accuracy ?? 999) <= 100) {
            const dtHours = (nowTs - lastPos.time) / 3_600_000;
            if (dtHours > 0.00011 && dtHours < 0.05) {
              const distKm = haversineDistanceKm(
                lastPos.lat,
                lastPos.lon,
                pos.coords.latitude,
                pos.coords.longitude
              );
              if (distKm >= 0.004) {
                const computedSpeed = distKm / dtHours;
                if (Number.isFinite(computedSpeed) && computedSpeed <= 260) {
                  applyGpsSpeed(computedSpeed);
                }
              } else {
                applyGpsSpeed(0);
              }
            }
          }

          lastPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, time: nowTs };
        },
        () => {
          setGpsConnected(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 12000,
        }
      );
    }

    // Listen to Android Headunit CAN-Bus / Monitor custom telemetry event or native bridge
    const handleMonitorTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<Partial<CarState> & { lat?: number; lon?: number; latitude?: number; longitude?: number }>)?.detail;
      if (!detail || typeof detail !== "object") return;
      if (typeof detail.speed === "number" || typeof detail.rpm === "number") {
        setGpsConnected(true);
      }
      const bridgeLat = typeof detail.lat === "number" ? detail.lat : detail.latitude;
      const bridgeLon = typeof detail.lon === "number" ? detail.lon : detail.longitude;
      if (typeof bridgeLat === "number" && typeof bridgeLon === "number" && Number.isFinite(bridgeLat) && Number.isFinite(bridgeLon)) {
        setGpsConnected(true);
        setGpsCoords({ lat: bridgeLat, lon: bridgeLon });
      }
      setCarState((prev) => {
        const nextSpeed =
          typeof detail.speed === "number" && Number.isFinite(detail.speed)
            ? Math.max(0, Math.min(260, Math.round(detail.speed)))
            : prev.speed;
        const nextRpm =
          typeof detail.rpm === "number" && Number.isFinite(detail.rpm)
            ? Math.max(0, Math.min(7000, Math.round(detail.rpm)))
            : computeBmwRpmFromSpeed(nextSpeed, prev.driveMode, prev.gear);
        return {
          ...prev,
          ...detail,
          speed: nextSpeed,
          rpm: nextRpm,
        };
      });
    };

    window.addEventListener("bmwTelemetry", handleMonitorTelemetry as EventListener);

    // Optional native Android WebView bridge polling if embedded in Android APK monitor
    const bridgeTimer = window.setInterval(() => {
      const bridge = (window as any).AndroidBridge;
      if (bridge && typeof bridge.getCarTelemetryJson === "function") {
        try {
          const raw = bridge.getCarTelemetryJson();
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (parsed && typeof parsed === "object") {
            window.dispatchEvent(new CustomEvent("bmwTelemetry", { detail: parsed }));
          }
        } catch {}
      }
    }, 1000);

    return () => {
      if (watchId !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      window.removeEventListener("bmwTelemetry", handleMonitorTelemetry as EventListener);
      window.clearInterval(bridgeTimer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const activeSpeed = currentSpeedRef.current || 0;
      const kmDelta = activeSpeed > 0 ? (activeSpeed * 2) / 3600 : 0;
      const hrDelta = 2 / 3600;

      setTripElapsedSeconds((prev) => prev + 2);
      if (kmDelta > 0) {
        setTripDistanceKm((prev) => prev + kmDelta);
        setOilMileageKm((prev) => prev + kmDelta);
      }
      setOilEngineHours((prev) => prev + hrDelta);

      const t = telemetryRef.current;
      t.elapsed += 2;

      const rpmRatio = Math.min(1, Math.max(0, (t.rpm - 750) / 5500));
      const sportBonus = t.driveMode === "sport" ? 0.35 : t.driveMode === "eco" ? -0.15 : 0;
      const pressureNoise = Math.sin(t.elapsed * 0.45) * 0.14;
      const targetPressure = Math.max(
        1.8,
        Math.min(5.6, Number((2.5 + rpmRatio * 2.4 + sportBonus + pressureNoise).toFixed(2)))
      );

      const targetTempBase =
        88 + rpmRatio * 7 + (t.driveMode === "sport" ? 2.5 : 0) + Math.sin(t.elapsed * 0.18) * 0.8;
      const nextTemp = Number(
        (t.engineTemp + (targetTempBase - t.engineTemp) * 0.28).toFixed(1)
      );

      t.oilPressureBar = targetPressure;
      t.engineTemp = nextTemp;

      const transport = carEcuBridge.getSnapshot().transport;
      const hardwareObdActive =
        transport === "bluetooth-elm327" || transport === "usb-serial-kdcan";

      setCarState((prev) => {
        const baseRpm = computeBmwRpmFromSpeed(prev.speed, prev.driveMode, prev.gear);
        const liveRpm = hardwareObdActive
          ? prev.rpm
          : Math.max(700, Math.min(6800, baseRpm + Math.round(Math.sin(t.elapsed * 0.7) * 18)));
        return {
          ...prev,
          rpm: liveRpm,
          oilPressureBar: targetPressure,
          engineTemp: Math.round(nextTemp),
        };
      });

      const nextPoint: EngineTelemetryPoint = {
        time: formatElapsedLabel(t.elapsed),
        elapsedSec: t.elapsed,
        oilPressureBar: targetPressure,
        engineTemp: nextTemp,
      };

      setEngineTelemetryHistory((prev) => [...prev.slice(-29), nextPoint]);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Pre-Conditioning Climate Scheduler state (persisted & evaluated in background)
  const [preConditionSchedule, setPreConditionSchedule] = useState<PreConditioningSchedule>(() => {
    try {
      const saved = localStorage.getItem("bmw728li_precondition_schedule");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.targetTime === "string" && typeof parsed.targetTemp === "number") {
          return {
            enabled: Boolean(parsed.enabled),
            targetTime: parsed.targetTime,
            targetTemp: Math.max(16, Math.min(30, parsed.targetTemp)),
            repeatDaily: parsed.repeatDaily !== false,
            lastTriggeredDate: typeof parsed.lastTriggeredDate === "string" ? parsed.lastTriggeredDate : undefined,
          };
        }
      }
    } catch {}
    return {
      enabled: false,
      targetTime: "07:30",
      targetTemp: 21,
      repeatDaily: true,
    };
  });
  const [preConditionTriggeredAt, setPreConditionTriggeredAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("bmw728li_precondition_schedule", JSON.stringify(preConditionSchedule));
    } catch {}
  }, [preConditionSchedule]);

  useEffect(() => {
    if (!preConditionSchedule.enabled) return;

    const checkSchedule = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentHHMM = `${hh}:${mm}`;
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      if (
        currentHHMM === preConditionSchedule.targetTime &&
        preConditionSchedule.lastTriggeredDate !== todayKey
      ) {
        setCarState((prev) => ({
          ...prev,
          acActive: true,
          acTemp: preConditionSchedule.targetTemp,
          acFanSpeed: Math.max(2, prev.acFanSpeed || 3),
        }));
        carAudio.playBmwGong();
        setPreConditionTriggeredAt(
          now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
        );
        setPreConditionSchedule((prev) => ({
          ...prev,
          lastTriggeredDate: todayKey,
          enabled: prev.repeatDaily ? prev.enabled : false,
        }));
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 1000);
    return () => clearInterval(interval);
  }, [preConditionSchedule]);

  const lastOilSaveRef = useRef<number>(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastOilSaveRef.current < 15000 && oilMileageKm > 0) return;
    lastOilSaveRef.current = now;
    try {
      localStorage.setItem(
        "bmw728li_oil_life",
        JSON.stringify({
          mileageKm: oilMileageKm,
          engineHours: oilEngineHours,
          lastResetDate: oilLastResetDate,
        })
      );
    } catch {}
  }, [oilMileageKm, oilEngineHours, oilLastResetDate]);

  const handleResetTrip = () => {
    carAudio.playButtonTap();
    setTripDistanceKm(0);
    setTripElapsedSeconds(0);
    telemetryRef.current.elapsed = 0;
    setEngineTelemetryHistory([
      {
        time: "00:00",
        elapsedSec: 0,
        oilPressureBar: telemetryRef.current.oilPressureBar,
        engineTemp: Number(telemetryRef.current.engineTemp.toFixed(1)),
      },
    ]);
  };

  const handleResetOilLife = () => {
    carAudio.playButtonTap();
    const todayFa = new Date().toLocaleDateString("fa-IR");
    setOilMileageKm(0);
    setOilEngineHours(0);
    setOilLastResetDate(todayFa);
  };

  // Sync global CSS accent variables with selected BMW Ambient Lighting theme
  useEffect(() => {
    const theme = getAmbientTheme(carState.ambientLightingColor);
    applyAmbientThemeCssVars(theme);
    try {
      localStorage.setItem("bmw728li_ambient_theme", theme.id);
    } catch {}
  }, [carState.ambientLightingColor]);

  // Sync carState.isOnline automatically with browser online/offline state
  useEffect(() => {
    setCarState((prev) => ({ ...prev, isOnline: browserOnline }));
  }, [browserOnline]);

  // Persist diagnostic sessions locally so offline startups retain full history
  useEffect(() => {
    try {
      localStorage.setItem("bmw728li_diagnostic_sessions_v1", JSON.stringify(recordedSessions));
    } catch {}
  }, [recordedSessions]);

  // Auto-reset & auto-match monitor calibration on car headunit launch or PWA installation
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      /android/i.test(navigator.userAgent || "") &&
      typeof document !== "undefined"
    ) {
      document.documentElement.dataset.androidPerf = "lite";
    }
    const savedProfile = loadSavedHeadunitProfile();
    if (savedProfile) {
      applyMonitorCssCalibration(savedProfile);
    }

    const triggerCalibration = (reason: "auto-install" | "appinstalled") => {
      const { profile, matchedCarState } = runMonitorAutoResetAndMatch(reason);
      setCarState((prev) => ({
        ...prev,
        ...matchedCarState,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : prev.isOnline,
      }));
      setMonitorCalibrationBanner(profile);
      carAudio.playBmwGong();
    };

    if (shouldAutoRunHeadunitCalibration()) {
      triggerCalibration("auto-install");
    }

    const handleAppInstalled = () => {
      triggerCalibration("appinstalled");
    };

    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Fetch initial diagnostic logs from backend only when online (with timeout)
  useEffect(() => {
    if (!browserOnline) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);
    const fetchRecordings = async () => {
      try {
        const res = await fetch("/api/recordings", { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setRecordedSessions(data);
          }
        }
      } catch {
        // Offline / localStorage cache already hydrated
      } finally {
        window.clearTimeout(timeoutId);
      }
    };
    void fetchRecordings();
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [browserOnline]);

  const handleUpdateCarState = useCallback((partial: Partial<CarState>) => {
    setCarState((prev) => {
      const next: CarState = { ...prev, ...partial };
      const transport = carEcuBridge.getSnapshot().transport;
      const hardwareObdActive =
        transport === "bluetooth-elm327" || transport === "usb-serial-kdcan";
      if (
        !hardwareObdActive &&
        (partial.speed !== undefined || partial.driveMode !== undefined || partial.gear !== undefined) &&
        partial.rpm === undefined
      ) {
        next.rpm = computeBmwRpmFromSpeed(next.speed, next.driveMode, next.gear);
      }
      return next;
    });
  }, []);

  const requestGpsFix = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsConnected(true);
        setGpsCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        setGpsConnected(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

  const handlePlayFlash = () => {
    const flashIdx = playlist.findIndex((t) => t.isFlash);
    if (flashIdx >= 0) {
      setCurrentTrackIndex(flashIdx);
    }
    handleUpdateCarState({ musicPlaying: true });
  };

  const handleAddSessionTurn = (driverText: string, aiText: string, audioBase64?: string) => {
    const nowTime = new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    const newSession: RecordedSession = {
      id: "diag-voice-" + Date.now(),
      startTime: nowTime,
      title: driverText.slice(0, 35) + "...",
      turns: [
        { id: "t-drv-" + Date.now(), sender: "driver", text: driverText, timestamp: nowTime },
        { id: "t-ai-" + Date.now(), sender: "assistant", text: aiText, timestamp: nowTime },
      ],
      turnCount: 2,
      savedAt: new Date().toLocaleDateString("fa-IR"),
      summary: "گفتگوی صوتی آنلاین با راننده",
    };

    setRecordedSessions((prev) => [newSession, ...prev]);

    // Async persist to server
    fetch("/api/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSession),
    }).catch(() => {});
  };

  const deleteSessionFromDatabase = async (id: string) => {
    setRecordedSessions((prev) => prev.filter((s) => s.id !== id));
    if (browserOnline) {
      fetch(`/api/recordings/${id}`, { method: "DELETE" }).catch(() => {});
    }
  };

  const clearAllSessionsFromDatabase = async () => {
    setRecordedSessions([]);
    if (browserOnline) {
      fetch("/api/recordings", { method: "DELETE" }).catch(() => {});
    }
  };

  const currentTrack = playlist[currentTrackIndex] || playlist[0];

  // Auto-load permanently saved USB Flash tracks from IndexedDB on boot (no re-scanning required)
  useEffect(() => {
    let active = true;
    const hydrateUsbMusic = async () => {
      const stored = await loadUsbTracksFromVault();
      if (!active) return;
      if (stored.length > 0) {
        setPlaylist(stored);
        setUsbSavedCount(stored.length);
        const lastPos = loadLastTrackPosition();
        if (lastPos.trackId) {
          const idx = stored.findIndex((t) => t.id === lastPos.trackId);
          setCurrentTrackIndex(idx >= 0 ? idx : 0);
        } else if (typeof lastPos.trackIndex === "number") {
          setCurrentTrackIndex(Math.max(0, Math.min(stored.length - 1, lastPos.trackIndex)));
        }
      }

      // Silently sync new songs if browser already granted permission to the USB folder handle
      const synced = await syncSavedUsbFolderIfPermitted();
      if (!active) return;
      if (synced.length > stored.length) {
        setPlaylist(synced);
        setUsbSavedCount(synced.length);
      }
    };
    void hydrateUsbMusic();
    return () => {
      active = false;
    };
  }, []);

  // Persist last active track position
  useEffect(() => {
    if (currentTrack?.id) {
      saveLastTrackPosition(currentTrack.id, currentTrackIndex);
    }
  }, [currentTrack?.id, currentTrackIndex]);

  // Master cross-tab HTML5 audio sync (keeps USB MP3s playing on every screen)
  useEffect(() => {
    const el = masterAudioRef.current;
    if (!el) return;
    if (currentTrack?.url) {
      if (el.src !== currentTrack.url) {
        el.src = currentTrack.url;
        setAudioProgress(0);
        setAudioCurrentTime("00:00");
      }
      if (carState.musicPlaying) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    } else {
      el.pause();
      if (el.hasAttribute("src")) {
        el.removeAttribute("src");
      }
    }
  }, [currentTrack?.url, currentTrack?.id, carState.musicPlaying]);

  useEffect(() => {
    if (masterAudioRef.current) {
      const baseVol = Math.max(0, Math.min(1, carState.volume / 100));
      masterAudioRef.current.volume =
        isVoiceModalOpen || isSpeaking ? Math.min(0.12, baseVol * 0.25) : baseVol;
    }
  }, [carState.volume, isVoiceModalOpen, isSpeaking]);

  // Synthetic progress ticker when playing demo tracks without real MP3 url
  useEffect(() => {
    if (!carState.musicPlaying || currentTrack?.url) return;
    const timer = window.setInterval(() => {
      setAudioProgress((prev) => (prev >= 100 ? 0 : prev + 0.6));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [carState.musicPlaying, currentTrack?.url]);

  const handleSeekAudio = (percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    setAudioProgress(clamped);
    const el = masterAudioRef.current;
    if (el && el.duration && Number.isFinite(el.duration)) {
      el.currentTime = (clamped / 100) * el.duration;
    }
  };

  const handleUploadUsbFiles = async (files: FileList | File[]) => {
    const added = await saveUsbFilesToVault(files);
    const allStored = await loadUsbTracksFromVault();
    if (allStored.length > 0) {
      setPlaylist(allStored);
      setUsbSavedCount(allStored.length);
      if (added.length > 0) {
        const firstAddedIdx = allStored.findIndex((t) => t.id === added[0].id);
        setCurrentTrackIndex(firstAddedIdx >= 0 ? firstAddedIdx : 0);
        handleUpdateCarState({ musicPlaying: true });
        setAudioProgress(0);
      }
    }
  };

  const handleConnectUsbFolder = async (): Promise<boolean> => {
    if (!isDirectoryPickerSupported()) return false;
    try {
      const res = await pickAndPersistUsbFolder();
      if (res && res.tracks.length > 0) {
        setPlaylist(res.tracks);
        setUsbSavedCount(res.tracks.length);
        setUsbFolderName(res.folderName);
        try {
          localStorage.setItem("bmw728li_usb_folder_name", res.folderName);
        } catch {}
        setCurrentTrackIndex(0);
        handleUpdateCarState({ musicPlaying: true });
        setAudioProgress(0);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleRemoveUsbTrack = async (trackId: string) => {
    await removeUsbTrackFromVault(trackId);
    const remaining = await loadUsbTracksFromVault();
    if (remaining.length > 0) {
      setPlaylist(remaining);
      setUsbSavedCount(remaining.length);
      setCurrentTrackIndex((prev) => Math.min(prev, remaining.length - 1));
    } else {
      setPlaylist(DEFAULT_SAMPLE_TRACKS);
      setUsbSavedCount(0);
      setCurrentTrackIndex(0);
    }
  };

  const handleClearAllUsbTracks = async () => {
    await clearUsbVault();
    setPlaylist(DEFAULT_SAMPLE_TRACKS);
    setUsbSavedCount(0);
    setUsbFolderName("");
    try {
      localStorage.removeItem("bmw728li_usb_folder_name");
    } catch {}
    setCurrentTrackIndex(0);
    setAudioProgress(0);
    handleUpdateCarState({ musicPlaying: false });
  };

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  };

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  const togglePlayMusic = () => {
    handleUpdateCarState({ musicPlaying: !carState.musicPlaying });
  };

  const executeVoiceUiCommand = (uiCommand: string) => {
    switch (uiCommand) {
      case "open_tab:dash":
        setIs3DShowroomOpen(false);
        setStealthHudActive(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setIsDatabaseModalOpen(false);
        setActiveTab("dash");
        break;
      case "open_tab:nav":
        setIs3DShowroomOpen(false);
        setStealthHudActive(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setIsDatabaseModalOpen(false);
        setActiveTab("nav");
        break;
      case "open_tab:controls":
        setIs3DShowroomOpen(false);
        setStealthHudActive(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setIsDatabaseModalOpen(false);
        setActiveTab("controls");
        break;
      case "open_tab:media":
        setIs3DShowroomOpen(false);
        setStealthHudActive(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setIsDatabaseModalOpen(false);
        setActiveTab("media");
        break;
      case "open_tab:settings":
        setIs3DShowroomOpen(false);
        setStealthHudActive(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setIsDatabaseModalOpen(false);
        setActiveTab("settings");
        break;
      case "open_ecu":
        setIs3DShowroomOpen(false);
        setStealthHudActive(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setIsDatabaseModalOpen(false);
        setSettingsSubTab("ecu");
        setActiveTab("settings");
        break;
      case "open_3d":
        setStealthHudActive(false);
        setIs3DShowroomOpen(true);
        break;
      case "close_3d":
        setIs3DShowroomOpen(false);
        break;
      case "open_hud":
        setIs3DShowroomOpen(false);
        setStealthHudActive(true);
        handleUpdateCarState({ stealthHudActive: true });
        break;
      case "close_hud":
        setStealthHudActive(false);
        handleUpdateCarState({ stealthHudActive: false });
        break;
      case "open_diagnostics":
        setIsDatabaseModalOpen(true);
        break;
      case "open_specs":
        setIsSpecsOpen(true);
        break;
      case "open_factory_github":
        setFactoryInitialTab("github");
        setIsFactoryOpen(true);
        break;
      case "open_factory":
        setFactoryInitialTab("canbus");
        setIsFactoryOpen(true);
        break;
      case "close_modals":
        setIs3DShowroomOpen(false);
        setIsDatabaseModalOpen(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setStealthHudActive(false);
        break;
      case "next_music":
        nextTrack();
        handleUpdateCarState({ musicPlaying: true });
        break;
      case "prev_music":
        prevTrack();
        handleUpdateCarState({ musicPlaying: true });
        break;
      case "reset_trip":
        handleResetTrip();
        break;
      case "reset_oil":
        handleResetOilLife();
        break;
      case "clear_dtc":
        carEcuBridge.clearDtcFaults();
        handleUpdateCarState({ dtcErrorCount: 0 });
        break;
      case "calibrate_monitor": {
        const { profile, matchedCarState } = runMonitorAutoResetAndMatch("auto-install");
        setCarState((prev) => ({
          ...prev,
          ...matchedCarState,
          isOnline: typeof navigator !== "undefined" ? navigator.onLine : prev.isOnline,
        }));
        setMonitorCalibrationBanner(profile);
        carAudio.playBmwGong();
        break;
      }
      case "run_ota_update": {
        void runHeadunitAutoUpdateAndResourceSync({ silent: false }).then((status) => {
          setOtaSyncBanner(status);
          carAudio.playBmwGong();
          void speakText(status.summaryFa);
        });
        break;
      }
      case "reset_app":
        setIs3DShowroomOpen(false);
        setStealthHudActive(false);
        setIsSpecsOpen(false);
        setIsFactoryOpen(false);
        setIsDatabaseModalOpen(false);
        setActiveTab("dash");
        handleResetTrip();
        setCarState((prev) => ({
          ...prev,
          doorsLocked: true,
          hazardActive: false,
          leftSignal: false,
          rightSignal: false,
          headlightsActive: false,
          highBeamActive: false,
          fogLightsActive: false,
          acActive: true,
          acTemp: 22,
          acFanSpeed: 2,
          acMode: "auto",
          windowsOpen: { fl: false, fr: false, rl: false, rr: false },
          sunroofOpen: false,
          musicPlaying: false,
          volume: 65,
          driveMode: "comfort",
          airSuspensionLevel: "normal",
          stealthHudActive: false,
        }));
        break;
    }
  };

  return (
    <div
      id="car-headunit-app"
      className="flex flex-col h-screen w-screen cockpit-canvas text-slate-100 overflow-hidden font-sans select-none relative ring-1 ring-inset ring-teal-200/15 shadow-[inset_0_0_48px_rgba(0,0,0,0.88)]"
      dir="rtl"
    >
      {/* Universal Headunit Top Status Bar */}
      <CarHeader
        carState={carState}
        onToggleOnline={() => handleUpdateCarState({ isOnline: !carState.isOnline })}
        onOpenSpecs={() => setIsSpecsOpen(true)}
        onOpenFactorySettings={() => {
          setFactoryInitialTab("github");
          setIsFactoryOpen(true);
        }}
        onOpenDatabase={() => setIsDatabaseModalOpen(true)}
        onToggleStealthHud={() => setStealthHudActive(true)}
        onOpenVoiceAssistant={() => {
          setWokenByJarvis(false);
          setPendingWakeCommand(null);
          setIsVoiceModalOpen(true);
        }}
        onOpenSos={() => setIsSosModalOpen(true)}
        onOpen3DShowroom={() => setIs3DShowroomOpen(true)}
        isSpeaking={isSpeaking}
        jarvisStandbyActive={jarvisStandbyEnabled}
        jarvisStandbyListening={jarvisStandbyListening}
        onToggleJarvisStandby={() => setJarvisStandbyEnabled((prev) => !prev)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* BMW Interior LED Ambient Light Strip */}
      <div
        aria-hidden="true"
        className="h-[2px] w-full bmw-ambient-strip shrink-0 transition-opacity duration-300"
        style={{ opacity: Math.max(0.2, (carState.ambientLightingBrightness ?? 85) / 100) }}
      />

      {/* Status / Greeting / Auto-Calibration Banners (Menu warning banner removed) */}
      {(!carState.isOnline ||
        monitorCalibrationBanner ||
        ignitionGreetingBanner ||
        otaSyncBanner) && (
        <div className="px-3 sm:px-5 pt-2 flex flex-col gap-1.5 z-20 shrink-0">
          {ignitionGreetingBanner && (
            <div
              id="ignition-greeting-banner"
              className="rounded-xl bg-[#071a1d]/90 backdrop-blur-md border border-teal-300/25 px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs text-teal-50 shadow-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                <SunMedium className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="truncate font-medium">{ignitionGreetingBanner.greetingText}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playBmwGong();
                    void speakText(ignitionGreetingBanner.greetingText);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 text-amber-200 text-[11px] font-bold"
                >
                  پخش صدا
                </button>
                <button
                  type="button"
                  onClick={() => setIgnitionGreetingBanner(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-amber-200"
                  aria-label="بستن خوش‌آمدگویی"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {otaSyncBanner && (
            <div
              id="ota-update-banner"
              className="rounded-xl bg-[#071a1d]/90 backdrop-blur-md border border-teal-300/25 px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs text-teal-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CloudDownload className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="truncate">{otaSyncBanner.summaryFa}</span>
              </div>
              <button
                type="button"
                onClick={() => setOtaSyncBanner(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-amber-200 shrink-0"
                aria-label="بستن اعلان اپدیت"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!carState.isOnline && (
            <div
              id="offline-cockpit-banner"
              className="rounded-2xl bg-amber-950/60 border border-amber-500/40 px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-amber-200"
            >
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  حالت آفلاین مستقل خودرو فعال است — کاکپیت، ساعت عقربه‌ای، داشبورد، موسیقی و فرمان‌های ECU بدون نیاز به اینترنت در دسترس هستند
                  {isOfflineReady ? " (حافظه آفلاین آماده)" : ""}.
                </span>
              </div>
            </div>
          )}

          {monitorCalibrationBanner && (
            <div
              id="headunit-auto-calibration-banner"
              className="rounded-2xl bg-emerald-950/65 border border-emerald-500/45 px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-emerald-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">
                  مانیتور خودرو با موفقیت ریست و کالیبره شد: {monitorCalibrationBanner.matchedResolutionLabel} ·{" "}
                  {monitorCalibrationBanner.canProtocol}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMonitorCalibrationBanner(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-emerald-200 shrink-0"
                aria-label="بستن اعلان کالیبراسیون"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full-Width Widescreen Monitor Viewport (Side Rail Removed for Authentic BMW iDrive ID6 Layout) */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Tab 1: Clean Essential BMW iDrive ID6 Dashboard */}
        {activeTab === "dash" && (
          <DashboardView
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            currentTrack={currentTrack}
            onPlayFlash={handlePlayFlash}
            onNextTrack={nextTrack}
            onTogglePlayPause={togglePlayMusic}
            activeRoute={activeCustomRoute}
            onOpenNavTab={() => setActiveTab("nav")}
            onOpenControlsTab={() => setActiveTab("controls")}
            onOpenMediaTab={() => setActiveTab("media")}
            onOpenSettingsTab={(sub = "ecu") => {
              setSettingsSubTab(sub);
              setActiveTab("settings");
            }}
            onOpenVoiceAssistant={() => {
              setWokenByJarvis(false);
              setPendingWakeCommand(null);
              setIsVoiceModalOpen(true);
            }}
            onOpen3DShowroom={() => setIs3DShowroomOpen(true)}
            isSpeaking={isSpeaking}
            micNoiseFilterActive={micNoiseFilterActive}
            gpsConnected={gpsConnected}
            gpsCoords={gpsCoords}
            onRequestGpsFix={requestGpsFix}
          />
        )}

        {/* Tab 2: Full GPS Navigation & POI */}
        {activeTab === "nav" && (
          <Suspense fallback={null}>
            <NavigationModule
              carState={carState}
              onUpdateCarState={handleUpdateCarState}
              externalSearchQuery={navSearchQuery}
              externalRoute={activeCustomRoute}
            />
          </Suspense>
        )}

        {/* Tab 3: Full In-Car CAN-Bus Controls */}
        {activeTab === "controls" && (
          <Suspense fallback={null}>
            <CarControlsModule
              carState={carState}
              onUpdateCarState={handleUpdateCarState}
              preConditionSchedule={preConditionSchedule}
              onUpdatePreConditionSchedule={(partial) =>
                setPreConditionSchedule((prev) => ({ ...prev, ...partial }))
              }
              preConditionTriggeredAt={preConditionTriggeredAt}
            />
          </Suspense>
        )}

        {/* Tab 4: Full In-Car Media & Radio */}
        {activeTab === "media" && (
          <Suspense fallback={null}>
            <MusicPlayerModule
              carState={carState}
              onUpdateCarState={handleUpdateCarState}
              playlist={playlist}
              setPlaylist={setPlaylist}
              currentTrackIndex={currentTrackIndex}
              setCurrentTrackIndex={setCurrentTrackIndex}
              audioProgress={audioProgress}
              audioCurrentTime={audioCurrentTime}
              onSeekAudio={handleSeekAudio}
              onUploadUsbFiles={handleUploadUsbFiles}
              onConnectUsbFolder={handleConnectUsbFolder}
              onRemoveUsbTrack={handleRemoveUsbTrack}
              onClearUsbVault={handleClearAllUsbTracks}
              usbSavedCount={usbSavedCount}
              usbFolderName={usbFolderName}
            />
          </Suspense>
        )}

        {/* Tab 5: Settings, Car Computer (ECU / OBD-II), Telemetry, Gallery & System Hub */}
        {activeTab === "settings" && (
          <Suspense fallback={null}>
            <SettingsHubModule
              carState={carState}
              onUpdateCarState={handleUpdateCarState}
              currentTrack={currentTrack}
              tripDistanceKm={tripDistanceKm}
              tripElapsedSeconds={tripElapsedSeconds}
              onResetTrip={handleResetTrip}
              oilMileageKm={oilMileageKm}
              oilEngineHours={oilEngineHours}
              oilLastResetDate={oilLastResetDate}
              onResetOilLife={handleResetOilLife}
              engineTelemetryHistory={engineTelemetryHistory}
              onNavigateToMeetingLocation={(location, meetingTitle) => {
                setActiveCustomRoute({
                  origin: "موقعیت فعلی (GPS)",
                  destination: location,
                  distance: "۱۲.۴ کیلومتر",
                  duration: "۱۸ دقیقه",
                  nextTurn: `مسیر به سمت محل جلسه «${meetingTitle}» در ${location} فعال شد.`,
                  turnDistance: "۲۵۰ متر",
                  speedLimit: 80,
                  eta: new Date(Date.now() + 18 * 60_000).toLocaleTimeString("fa-IR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                });
                setNavSearchQuery(location);
                setActiveTab("nav");
              }}
              onOpen3DShowroom={() => setIs3DShowroomOpen(true)}
              onOpenDiagnosticsModal={() => setIsDatabaseModalOpen(true)}
              onOpenSpecsModal={() => setIsSpecsOpen(true)}
              onOpenFactorySettings={() => {
                setFactoryInitialTab("github");
                setIsFactoryOpen(true);
              }}
              onToggleStealthHud={() => setStealthHudActive(true)}
              initialSubTab={settingsSubTab}
              jarvisStandbyEnabled={jarvisStandbyEnabled}
              jarvisStandbyListening={jarvisStandbyListening}
              jarvisMicStatus={jarvisMicStatus}
              micNoiseFilterActive={micNoiseFilterActive}
              onToggleJarvisStandby={() => setJarvisStandbyEnabled((prev) => !prev)}
            />
          </Suspense>
        )}

        {/* Master Persistent Audio Element (plays across Dashboard, Nav, Controls & Media) */}
        <audio
          ref={masterAudioRef}
          className="hidden"
          onEnded={() => {
            setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
            handleUpdateCarState({ musicPlaying: true });
            setAudioProgress(0);
          }}
          onTimeUpdate={() => {
            const el = masterAudioRef.current;
            if (!el || !el.duration || !Number.isFinite(el.duration)) return;
            const pct = (el.currentTime / el.duration) * 100;
            setAudioProgress(pct);
            const m = Math.floor(el.currentTime / 60);
            const s = Math.floor(el.currentTime % 60);
            setAudioCurrentTime(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
          }}
        />
      </main>

      {/* Online Conversational Voice Assistant Modal */}
      {isVoiceModalOpen && (
        <Suspense fallback={null}>
          <VoiceAssistantModal
            isOpen={isVoiceModalOpen}
            onClose={() => {
              setIsVoiceModalOpen(false);
              setWokenByJarvis(false);
              setPendingWakeCommand(null);
            }}
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            onNavigateToRoute={(route) => {
              setActiveCustomRoute(route);
              setActiveTab("nav");
            }}
            onPlayFlashMusic={handlePlayFlash}
            onExecuteUiCommand={executeVoiceUiCommand}
            onAddSessionTurn={handleAddSessionTurn}
            wokenByJarvis={wokenByJarvis}
            initialWakeCommand={pendingWakeCommand}
            onConsumeWakeCommand={() => setPendingWakeCommand(null)}
          />
        </Suspense>
      )}

      {/* Android Headunit System Specs Modal */}
      {isSpecsOpen && (
        <Suspense fallback={null}>
          <SystemSpecsModal
            isOpen={isSpecsOpen}
            onClose={() => setIsSpecsOpen(false)}
            onOpenFactorySettings={() => {
              setIsSpecsOpen(false);
              setFactoryInitialTab("canbus");
              setIsFactoryOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Android Headunit Factory Settings Modal (PIN 8888) */}
      {isFactoryOpen && (
        <FactorySettingsModal
          isOpen={isFactoryOpen}
          onClose={() => setIsFactoryOpen(false)}
          initialSubTab={factoryInitialTab}
          carState={carState}
          onUpdateCarState={setCarState}
          recordedSessions={recordedSessions}
          tripSummary={{
            tripDistanceKm,
            tripElapsedSeconds,
            oilMileageKm,
            oilEngineHours,
          }}
          preConditionSchedule={preConditionSchedule}
          onRestoreGitHubSnapshot={(payload) => {
            if (payload.carState) {
              setCarState((prev) => ({ ...prev, ...payload.carState }));
            }
            if (Array.isArray(payload.diagnosticLogs)) {
              setRecordedSessions(payload.diagnosticLogs);
            }
            if (payload.tripSummary) {
              if (typeof payload.tripSummary.tripDistanceKm === "number") {
                setTripDistanceKm(Math.max(0, payload.tripSummary.tripDistanceKm));
              }
              if (typeof payload.tripSummary.tripElapsedSeconds === "number") {
                setTripElapsedSeconds(Math.max(0, payload.tripSummary.tripElapsedSeconds));
              }
              if (typeof payload.tripSummary.oilMileageKm === "number") {
                setOilMileageKm(Math.max(0, payload.tripSummary.oilMileageKm));
              }
              if (typeof payload.tripSummary.oilEngineHours === "number") {
                setOilEngineHours(Math.max(0, payload.tripSummary.oilEngineHours));
              }
            }
            if (payload.preConditionSchedule) {
              setPreConditionSchedule(payload.preConditionSchedule);
            }
          }}
          onMonitorCalibrated={(profile) => setMonitorCalibrationBanner(profile)}
        />
      )}

      {/* Diagnostic & Logs Modal */}
      {isDatabaseModalOpen && (
        <Suspense fallback={null}>
          <RecordedSessionsModal
            isOpen={isDatabaseModalOpen}
            onClose={() => setIsDatabaseModalOpen(false)}
            sessions={recordedSessions}
            onDeleteSession={deleteSessionFromDatabase}
            onClearAll={clearAllSessionsFromDatabase}
          />
        </Suspense>
      )}

      {/* Minimalist Stealth HUD Overlay */}
      {stealthHudActive && (
        <Suspense fallback={null}>
          <StealthHUDOverlay
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            onExitStealth={() => setStealthHudActive(false)}
            currentTrack={currentTrack}
          />
        </Suspense>
      )}

      {/* Full-Bleed Interactive Three.js 3D Showroom & Highway Viewport */}
      {is3DShowroomOpen && (
        <Suspense fallback={null}>
          <Bmw3DShowroom
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            onClose={() => setIs3DShowroomOpen(false)}
          />
        </Suspense>
      )}

      {/* Emergency SOS Modal */}
      {isSosModalOpen && (
        <Suspense fallback={null}>
          <SosEmergencyModal
            isOpen={isSosModalOpen}
            onClose={() => setIsSosModalOpen(false)}
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            gpsConnected={gpsConnected}
            gpsCoords={gpsCoords}
            onRequestGpsFix={requestGpsFix}
          />
        </Suspense>
      )}
    </div>
  );
}
