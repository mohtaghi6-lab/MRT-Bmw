import { useState, useEffect, useRef } from "react";
import { CarState, MusicTrack, RecordedSession, NavigationRoute, EngineTelemetryPoint, PreConditioningSchedule } from "./types";
import CarHeader from "./components/CarHeader";
import DashboardView from "./components/DashboardView";
import NavigationModule from "./components/NavigationModule";
import CarControlsModule from "./components/CarControlsModule";
import MusicPlayerModule from "./components/MusicPlayerModule";
import SystemSpecsModal from "./components/SystemSpecsModal";
import FactorySettingsModal from "./components/FactorySettingsModal";
import StealthHUDOverlay from "./components/StealthHUDOverlay";
import RecordedSessionsModal from "./components/RecordedSessionsModal";
import VoiceAssistantModal from "./components/VoiceAssistantModal";
import Bmw3DShowroom from "./components/Bmw3DShowroom";
import { Gauge, Compass, Sliders, Music, Mic, Volume2, Box, CheckCircle2, WifiOff, X } from "lucide-react";
import { carAudio } from "./utils/carSpeech";
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

export default function App() {
  const [activeTab, setActiveTab] = useState<"dash" | "nav" | "controls" | "media">("dash");
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [isFactoryOpen, setIsFactoryOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
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
  const [monitorCalibrationBanner, setMonitorCalibrationBanner] = useState<HeadunitMonitorProfile | null>(null);

  // Track speaking status from carAudio
  useEffect(() => {
    carAudio.onSpeakingChange((speaking) => {
      setIsSpeaking(speaking);
    });
  }, []);

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

  // Shared playlist for USB Flash & local storage
  const [playlist, setPlaylist] = useState<MusicTrack[]>([
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
  ]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  const [carState, setCarState] = useState<CarState>({
    speed: 58,
    maxSpeed: 260,
    rpm: 2100,
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

  useEffect(() => {
    currentSpeedRef.current = carState.speed;
    telemetryRef.current.rpm = carState.rpm;
    telemetryRef.current.speed = carState.speed;
    telemetryRef.current.driveMode = carState.driveMode;
  }, [carState.speed, carState.rpm, carState.driveMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      const activeSpeed = currentSpeedRef.current || 0;
      const kmDelta = activeSpeed > 0 ? activeSpeed / 3600 : 0;
      const hrDelta = 1 / 3600;

      setTripElapsedSeconds((prev) => prev + 1);
      if (kmDelta > 0) {
        setTripDistanceKm((prev) => prev + kmDelta);
        setOilMileageKm((prev) => prev + kmDelta);
      }
      setOilEngineHours((prev) => prev + hrDelta);

      const t = telemetryRef.current;
      t.elapsed += 1;

      if (t.elapsed % 2 === 0) {
        const rpmRatio = Math.min(1, Math.max(0, (t.rpm - 750) / 5500));
        const sportBonus = t.driveMode === "sport" ? 0.35 : t.driveMode === "eco" ? -0.15 : 0;
        const pressureNoise = (Math.sin(t.elapsed * 0.45) * 0.14);
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

        setCarState((prev) => ({
          ...prev,
          oilPressureBar: targetPressure,
          engineTemp: Math.round(nextTemp),
        }));

        const nextPoint: EngineTelemetryPoint = {
          time: formatElapsedLabel(t.elapsed),
          elapsedSec: t.elapsed,
          oilPressureBar: targetPressure,
          engineTemp: nextTemp,
        };

        setEngineTelemetryHistory((prev) => [...prev.slice(-29), nextPoint]);
      }
    }, 1000);
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

  useEffect(() => {
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

  const handleUpdateCarState = (partial: Partial<CarState>) => {
    setCarState((prev) => ({ ...prev, ...partial }));
  };

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

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  };

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  const togglePlayMusic = () => {
    handleUpdateCarState({ musicPlaying: !carState.musicPlaying });
  };

  return (
    <div
      id="car-headunit-app"
      className="flex flex-col h-screen w-screen cockpit-canvas text-slate-100 overflow-hidden font-sans select-none relative"
      dir="rtl"
    >
      {/* Universal Headunit Top Status Bar */}
      <CarHeader
        carState={carState}
        onToggleOnline={() => handleUpdateCarState({ isOnline: !carState.isOnline })}
        onOpenSpecs={() => setIsSpecsOpen(true)}
        onOpenFactorySettings={() => setIsFactoryOpen(true)}
        onOpenDatabase={() => setIsDatabaseModalOpen(true)}
        onToggleStealthHud={() => setStealthHudActive(true)}
        onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)}
        onOpen3DShowroom={() => setIs3DShowroomOpen(true)}
        isSpeaking={isSpeaking}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* BMW Interior LED Ambient Light Strip */}
      <div
        aria-hidden="true"
        className="h-[2px] w-full bmw-ambient-strip shrink-0 transition-opacity duration-300"
        style={{ opacity: Math.max(0.2, (carState.ambientLightingBrightness ?? 85) / 100) }}
      />

      {/* Offline Autonomous Status / Auto-Calibration Banner */}
      {(!carState.isOnline || monitorCalibrationBanner) && (
        <div className="px-3 sm:px-5 pt-2 flex flex-col gap-1.5 z-20 shrink-0">
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

      {/* Main View Area with Automotive Sidebar */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Right-Edge (in RTL) iDrive Rotary Control Rail */}
        <aside className="hidden lg:flex w-[84px] bg-[#060910]/95 backdrop-blur-xl border-l border-white/[0.07] flex-col items-center py-4 justify-between z-20 shadow-[4px_0_24px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col items-center gap-2.5 w-full px-2">
            {[
              { id: "dash" as const, domId: "nav-tab-dash", label: "داشبورد", icon: Gauge },
              { id: "nav" as const, domId: "nav-tab-nav", label: "مسیریابی", icon: Compass },
              { id: "controls" as const, domId: "nav-tab-controls", label: "کنترل‌ها", icon: Sliders },
              { id: "media" as const, domId: "nav-tab-media", label: "رسانه", icon: Music },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={item.domId}
                  onClick={() => {
                    carAudio.playButtonTap();
                    setActiveTab(item.id);
                  }}
                  className={`relative h-[62px] w-full rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-95 ${
                    isActive
                      ? "bmw-accent-btn font-bold"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}

            <div className="w-10 h-px bg-white/[0.07] my-1" />

            <button
              id="nav-tab-3d-showroom"
              onClick={() => {
                carAudio.playButtonTap();
                setIs3DShowroomOpen(true);
              }}
              className="h-[62px] w-full rounded-2xl hardware-key flex flex-col items-center justify-center gap-1 transition-all active:scale-95 text-slate-200 hover:text-white"
              title="نمایش سه‌بعدی تعاملی BMW 728Li"
            >
              <Box className="w-5 h-5 bmw-accent-text" />
              <span className="text-[11px] font-semibold whitespace-nowrap">نمای ۳D</span>
            </button>
          </div>

          {/* Quick Voice Assistant Orb in iDrive Rail */}
          <button
            id="sidebar-voice-btn"
            onClick={() => {
              carAudio.playButtonTap();
              setIsVoiceModalOpen(true);
            }}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 shadow-xl border ${
              isSpeaking
                ? "bg-amber-500 border-amber-300 text-slate-950 animate-pulse shadow-amber-500/40"
                : "bmw-accent-btn bmw-accent-border hover:brightness-110"
            }`}
            title="دستیار صوتی و هم‌صحبت آنلاین"
          >
            {isSpeaking ? <Volume2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            <span className="text-[9px] font-bold mt-0.5">صدا</span>
          </button>
        </aside>

        {/* Tab 1: Primary Driving Dashboard */}
        {activeTab === "dash" && (
          <DashboardView
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            currentTrack={currentTrack}
            onPlayFlash={handlePlayFlash}
            onPrevTrack={prevTrack}
            onNextTrack={nextTrack}
            onTogglePlayPause={togglePlayMusic}
            activeRoute={activeCustomRoute}
            onOpenNavTab={() => setActiveTab("nav")}
            onOpenControlsTab={() => setActiveTab("controls")}
            onOpenMediaTab={() => setActiveTab("media")}
            onOpenSpecsModal={() => setIsSpecsOpen(true)}
            onOpenDiagnosticsModal={() => setIsDatabaseModalOpen(true)}
            onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)}
            onOpen3DShowroom={() => setIs3DShowroomOpen(true)}
            isSpeaking={isSpeaking}
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
          />
        )}

        {/* Tab 2: Full GPS Navigation & POI */}
        {activeTab === "nav" && (
          <NavigationModule
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            externalSearchQuery={navSearchQuery}
            externalRoute={activeCustomRoute}
          />
        )}

        {/* Tab 3: Full In-Car CAN-Bus Controls */}
        {activeTab === "controls" && (
          <CarControlsModule
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            preConditionSchedule={preConditionSchedule}
            onUpdatePreConditionSchedule={(partial) =>
              setPreConditionSchedule((prev) => ({ ...prev, ...partial }))
            }
            preConditionTriggeredAt={preConditionTriggeredAt}
          />
        )}

        {/* Tab 4: Full In-Car Media & Radio */}
        {activeTab === "media" && (
          <MusicPlayerModule
            carState={carState}
            onUpdateCarState={handleUpdateCarState}
            playlist={playlist}
            setPlaylist={setPlaylist}
            currentTrackIndex={currentTrackIndex}
            setCurrentTrackIndex={setCurrentTrackIndex}
          />
        )}
      </main>

      {/* Online Conversational Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        carState={carState}
        onUpdateCarState={handleUpdateCarState}
        onNavigateToRoute={(route) => {
          setActiveCustomRoute(route);
          setActiveTab("nav");
        }}
        onPlayFlashMusic={handlePlayFlash}
        onAddSessionTurn={handleAddSessionTurn}
      />

      {/* Android Headunit System Specs Modal */}
      <SystemSpecsModal
        isOpen={isSpecsOpen}
        onClose={() => setIsSpecsOpen(false)}
        onOpenFactorySettings={() => {
          setIsSpecsOpen(false);
          setIsFactoryOpen(true);
        }}
      />

      {/* Android Headunit Factory Settings Modal (PIN 8888) */}
      <FactorySettingsModal
        isOpen={isFactoryOpen}
        onClose={() => setIsFactoryOpen(false)}
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

      {/* Diagnostic & Logs Modal */}
      <RecordedSessionsModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        sessions={recordedSessions}
        onDeleteSession={deleteSessionFromDatabase}
        onClearAll={clearAllSessionsFromDatabase}
      />

      {/* Minimalist Stealth HUD Overlay */}
      {stealthHudActive && (
        <StealthHUDOverlay
          carState={carState}
          onUpdateCarState={handleUpdateCarState}
          onExitStealth={() => setStealthHudActive(false)}
          currentTrack={currentTrack}
        />
      )}

      {/* Full-Bleed Interactive Three.js 3D Showroom & Highway Viewport */}
      {is3DShowroomOpen && (
        <Bmw3DShowroom
          carState={carState}
          onUpdateCarState={handleUpdateCarState}
          onClose={() => setIs3DShowroomOpen(false)}
        />
      )}
    </div>
  );
}
