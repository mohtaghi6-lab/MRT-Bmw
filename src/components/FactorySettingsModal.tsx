import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Radio,
  Volume2,
  Monitor,
  Cpu,
  Car,
  Wifi,
  Sparkles,
  Lock,
  Unlock,
  Check,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Settings2,
  GitBranch,
  CloudUpload,
  CloudDownload,
  Trash2,
  ExternalLink,
  Copy,
  Terminal,
  Wand2,
} from "lucide-react";
import { carAudio } from "../utils/carSpeech";
import { CarState, PreConditioningSchedule, RecordedSession } from "../types";
import {
  BmwSyncPayload,
  DEFAULT_GITHUB_COMMIT_URL,
  DEFAULT_GITHUB_REPO_URL,
  GitHubSyncConfig,
  autoMatchAndEnsureGitHubRepo,
  clearGitHubToken,
  loadGitHubConfig,
  pushProjectSourceToGitHub,
  restoreStateFromGitHub,
  saveGitHubConfig,
  syncStateToGitHub,
  verifyGitHubRepoConnection,
} from "../utils/githubSync";
import {
  HeadunitMonitorProfile,
  computeMonitorProfile,
  loadSavedHeadunitProfile,
  runMonitorAutoResetAndMatch,
} from "../utils/headunitAutoSync";
import {
  APP_BUILD_VERSION,
  HeadunitOtaStatus,
  loadSavedOtaStatus,
  runHeadunitAutoUpdateAndResourceSync,
} from "../utils/headunitUpdater";

interface FactorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  carState: CarState;
  onUpdateCarState: (updater: (prev: CarState) => CarState) => void;
  recordedSessions?: RecordedSession[];
  tripSummary?: {
    tripDistanceKm: number;
    tripElapsedSeconds: number;
    oilMileageKm: number;
    oilEngineHours: number;
  };
  preConditionSchedule?: PreConditioningSchedule;
  onRestoreGitHubSnapshot?: (payload: BmwSyncPayload) => void;
  onMonitorCalibrated?: (profile: HeadunitMonitorProfile) => void;
  initialSubTab?: "canbus" | "audio" | "display" | "logo" | "github" | "reset";
}

export default function FactorySettingsModal({
  isOpen,
  onClose,
  carState,
  onUpdateCarState,
  recordedSessions = [],
  tripSummary = {
    tripDistanceKm: 0,
    tripElapsedSeconds: 0,
    oilMileageKm: 0,
    oilEngineHours: 0,
  },
  preConditionSchedule,
  onRestoreGitHubSnapshot,
  onMonitorCalibrated,
  initialSubTab,
}: FactorySettingsModalProps) {
  const [pinInput, setPinInput] = useState<string>("");
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    "canbus" | "audio" | "display" | "logo" | "github" | "reset"
  >(initialSubTab || "canbus");

  useEffect(() => {
    if (isOpen && initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [isOpen, initialSubTab]);

  // GitHub Sync State
  const [ghConfig, setGhConfig] = useState<GitHubSyncConfig>(() => loadGitHubConfig());
  const [showGhToken, setShowGhToken] = useState<boolean>(false);
  const [ghBusy, setGhBusy] = useState<"verify" | "automatch" | "sync" | "restore" | "pushcode" | null>(null);
  const [copiedGitCmd, setCopiedGitCmd] = useState<boolean>(false);
  const [ghStatus, setGhStatus] = useState<{
    type: "success" | "error" | "info";
    text: string;
    commitUrl?: string;
    pagesUrl?: string;
  } | null>(null);

  // Factory configured parameters (Auto-tuned specifically for BMW 728Li + iDrive Android Widescreen)
  const [factoryConfig, setFactoryConfig] = useState({
    // CAN-Bus & ECU
    carProtocol: "BMW CAN-Bus / I-Bus MUX (7-Series / E38 / F02)",
    baudRate: "500 kbps (High Speed BMW D-CAN)",
    steeringWheelProtocol: "BMW M Multi-function Steering Wheel (I-Bus)",
    ecuLinkMode: "BMW Bosch DME MS42 / OBD-II D-CAN",
    ambientTempSensor: "Front Bumper OEM BMW Sensor (22°C)",
    reverseCameraFormat: "AHD 1080P Wide Angle + PDC Radar Trajectory",
    radarParkDisplay: "Dynamic Trajectory Overlay with BMW PDC Acoustics",
    
    // Display & Resolution
    resolutionTuning: "1920x720 Ultrawide HD Native (60Hz)",
    brightnessNight: "30%",
    brightnessDay: "90%",
    touchSensitivity: "Ultra High (5-point capacitive)",
    colorTemperature: "BMW Natural 6500K Anti-Glare",
    
    // Audio & MCU Amplification
    dspPreset: "BMW Harman Kardon / Hi-Fi DSP Acoustic",
    loudnessGain: "+6dB Hardware Loudness",
    radioRegion: "Middle East / Europe (87.5 - 108.0 MHz)",
    mcuOutputGain: "BMW Professional 4x50W DSP Stage",
    navigationAudioMixing: "Auto Mute BG 40%",
    
    // Boot Logo & Brand
    bootLogo: "BMW Official Roundel (BMW 728Li iDrive)",
    bootAnimation: "BMW M Performance Power-On Sequence",
    fastBoot: "Instant Wake (STR Sleep Enabled)",
  });

  const [detectedProfile, setDetectedProfile] = useState<HeadunitMonitorProfile>(
    () => loadSavedHeadunitProfile() || computeMonitorProfile("manual")
  );
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [isAutoTuning, setIsAutoTuning] = useState<boolean>(false);
  const [autoTunedNotice, setAutoTunedNotice] = useState<string | null>(null);
  const [otaStatus, setOtaStatus] = useState<HeadunitOtaStatus>(() => loadSavedOtaStatus());
  const [isOtaSyncing, setIsOtaSyncing] = useState<boolean>(false);

  const handleRunOtaUpdateNow = async () => {
    carAudio.playButtonTap();
    setIsOtaSyncing(true);
    try {
      const next = await runHeadunitAutoUpdateAndResourceSync({ silent: false });
      setOtaStatus(next);
      carAudio.playBmwGong();
    } finally {
      setIsOtaSyncing(false);
    }
  };

  if (!isOpen) return null;

  // Handle PIN verification (8888, 1234, 0000, 1617, 888888, 3368)
  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pinInput.trim();
    if (
      cleanPin === "8888" ||
      cleanPin === "1234" ||
      cleanPin === "0000" ||
      cleanPin === "1617" ||
      cleanPin === "888888" ||
      cleanPin === "3368" ||
      cleanPin === "5678"
    ) {
      carAudio.playLockBeep(true);
      setIsUnlocked(true);
      setPinError(null);
    } else {
      carAudio.playHazardTick(false);
      setPinError("رمز عبور کارخانه اشتباه است! (رمزهای مجاز: 8888 یا 1234 یا 1617)");
    }
  };

  // Quick PIN button helper
  const handleAppendPin = (digit: string) => {
    carAudio.playButtonTap();
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      if (nextPin === "8888") {
        setTimeout(() => {
          setIsUnlocked(true);
          carAudio.playLockBeep(true);
        }, 150);
      }
    }
  };

  // Perform Full Factory Reset & Auto-Match Monitor Calibration
  const handleFullFactoryResetAndOptimalTune = () => {
    carAudio.playButtonTap();
    setIsResetting(true);
    setResetSuccess(false);
    setAutoTunedNotice(null);

    setTimeout(() => {
      const { profile, matchedCarState } = runMonitorAutoResetAndMatch("manual");
      setDetectedProfile(profile);
      onMonitorCalibrated?.(profile);

      // 1. Reset all car states to optimal baseline matched to detected monitor
      onUpdateCarState((prev) => ({
        ...prev,
        ...matchedCarState,
        speed: 0,
        rpm: 850,
        fuelPercent: 75,
        doorsLocked: true,
        hazardActive: false,
        leftSignal: false,
        rightSignal: false,
        headlightsActive: true,
        driveMode: "comfort",
        gear: "P",
      }));

      // 2. Set optimal calibrated factory configs matched to detected headunit resolution
      setFactoryConfig((prev) => ({
        ...prev,
        carProtocol: "BMW CAN-Bus / I-Bus MUX (7-Series / E38 / F02)",
        baudRate: "500 kbps (High Speed BMW D-CAN)",
        steeringWheelProtocol: "BMW M Multi-function Steering Wheel (I-Bus)",
        ecuLinkMode: "BMW Bosch DME MS42 / OBD-II D-CAN",
        ambientTempSensor: "Front Bumper OEM BMW Sensor (22°C)",
        reverseCameraFormat: "AHD 1080P Wide Angle + PDC Radar Trajectory",
        radarParkDisplay: "Dynamic Trajectory Overlay with BMW PDC Acoustics",
        resolutionTuning: profile.matchedResolutionLabel,
        brightnessNight: "30%",
        brightnessDay: "90%",
        touchSensitivity: "Ultra High (5-point capacitive)",
        colorTemperature: "BMW Natural 6500K Anti-Glare",
        dspPreset: profile.dspPreset,
        loudnessGain: "+6dB Hardware Loudness",
        radioRegion: "Middle East / Europe (87.5 - 108.0 MHz)",
        mcuOutputGain: "BMW Professional 4x50W DSP Stage",
        navigationAudioMixing: "Auto Mute BG 40%",
        bootLogo: "BMW Official Roundel (BMW 728Li iDrive)",
        bootAnimation: "BMW M Performance Power-On Sequence",
        fastBoot: "Instant Wake (STR Sleep Enabled)",
      }));

      carAudio.playBmwGong();
      setIsResetting(false);
      setResetSuccess(true);
      setAutoTunedNotice(
        `مانیتور ریست و با نمایشگر ${profile.screenWidth}×${profile.screenHeight} (Scale ${profile.uiScale}x) مچ شد.`
      );
    }, 900);
  };

  const updateGhField = (patch: Partial<GitHubSyncConfig>) => {
    setGhConfig((prev) => {
      const next = { ...prev, ...patch };
      saveGitHubConfig(next);
      return next;
    });
  };

  const handleAutoMatchGitHub = async () => {
    carAudio.playButtonTap();
    setGhBusy("automatch");
    setGhStatus(null);
    const res = await autoMatchAndEnsureGitHubRepo(ghConfig);
    setGhBusy(null);
    if (res.ok) {
      carAudio.playLockBeep(true);
      updateGhField({
        owner: res.owner || ghConfig.owner,
        repo: res.repo || ghConfig.repo,
        branch: res.branch || ghConfig.branch || "main",
      });
      setGhStatus({
        type: "success",
        text: res.message,
        commitUrl: res.repoUrl,
      });
    } else {
      if (res.owner) {
        updateGhField({ owner: res.owner });
      }
      setGhStatus({
        type: "error",
        text: res.message,
      });
    }
  };

  const handleVerifyGitHub = async () => {
    carAudio.playButtonTap();
    setGhBusy("verify");
    setGhStatus(null);
    const res = await verifyGitHubRepoConnection(ghConfig);
    setGhBusy(null);
    setGhStatus({
      type: res.ok ? "success" : "error",
      text: res.message,
    });
    if (res.ok && res.defaultBranch && !ghConfig.branch) {
      updateGhField({ branch: res.defaultBranch });
    }
  };

  const handleSyncToGitHub = async () => {
    carAudio.playButtonTap();
    setGhBusy("sync");
    setGhStatus(null);
    const payload: BmwSyncPayload = {
      app: "BMW 728Li iDrive ID6",
      exportedAt: new Date().toISOString(),
      carState,
      diagnosticLogs: recordedSessions,
      tripSummary,
      preConditionSchedule,
    };
    const res = await syncStateToGitHub(ghConfig, payload);
    setGhBusy(null);
    if (res.success) {
      carAudio.playLockBeep(true);
      updateGhField({
        lastSyncAt: res.syncedAt,
        lastCommitUrl: res.commitUrl,
      });
      setGhStatus({
        type: "success",
        text: `${res.message}${res.sha ? ` (SHA: ${res.sha.slice(0, 7)})` : ""}`,
        commitUrl: res.commitUrl,
      });
    } else {
      setGhStatus({
        type: "error",
        text: res.message,
      });
    }
  };

  const handleRestoreFromGitHub = async () => {
    carAudio.playButtonTap();
    setGhBusy("restore");
    setGhStatus(null);
    const res = await restoreStateFromGitHub(ghConfig);
    setGhBusy(null);
    if (res.success && res.payload) {
      if (onRestoreGitHubSnapshot) {
        onRestoreGitHubSnapshot(res.payload);
      } else {
        onUpdateCarState((prev) => ({ ...prev, ...res.payload!.carState }));
      }
      carAudio.playBmwGong();
      setGhStatus({
        type: "success",
        text: `${res.message} (${res.payload.diagnosticLogs?.length ?? 0} لاگ دیاگ)`,
      });
    } else {
      setGhStatus({
        type: "error",
        text: res.message,
      });
    }
  };

  const handlePushProjectToGitHub = async () => {
    carAudio.playButtonTap();
    setGhBusy("pushcode");
    setGhStatus(null);
    const res = await pushProjectSourceToGitHub(ghConfig);
    setGhBusy(null);
    if (res.success) {
      carAudio.playBmwGong();
      updateGhField({
        lastSyncAt: new Date().toLocaleString("fa-IR"),
        lastCommitUrl: res.commitUrl,
      });
      setGhStatus({
        type: "success",
        text: res.message,
        commitUrl: res.commitUrl,
        pagesUrl: res.pagesUrl,
      });
    } else {
      setGhStatus({
        type: "error",
        text: res.message,
      });
    }
  };

  return (
    <div
      id="factory-settings-modal"
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      dir="rtl"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  منوی تنظیمات کارخانه مانیتور (BMW iDrive Factory Settings)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  BMW ID6 EVO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                پیکربندی سطح عمیق سخت‌افزار، پروتکل BMW CAN-Bus و سنسورهای BMW 728Li
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              carAudio.playButtonTap();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {!isUnlocked ? (
          /* PIN Entry Screen (Default 8888) */
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-inner">
              <KeyRound className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-base text-white">ورود به تنظیمات محرمانه کارخانه</h4>
              <p className="text-xs text-slate-400">
                رمز عبور کارخانه مانیتور را وارد کنید (رمز پیش‌فرض شما: <span className="font-mono text-cyan-300 font-bold">8888</span>)
              </p>
            </div>

            {/* PIN Input Display */}
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-mono font-bold transition-all ${
                    pinInput.length > idx
                      ? "bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/30"
                      : "bg-slate-950 border-slate-700 text-slate-600"
                  }`}
                >
                  {pinInput.length > idx ? pinInput[idx] : "•"}
                </div>
              ))}
            </div>

            {pinError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/60 border border-rose-800/80 px-3 py-1.5 rounded-lg animate-shake">
                <AlertTriangle className="w-4 h-4" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((btn) => (
                <button
                  key={btn}
                  onClick={() => {
                    if (btn === "C") {
                      carAudio.playButtonTap();
                      setPinInput("");
                      setPinError(null);
                    } else if (btn === "OK") {
                      handleVerifyPin();
                    } else {
                      handleAppendPin(btn);
                    }
                  }}
                  className={`py-3 rounded-xl font-mono font-bold text-base transition active:scale-95 shadow-sm ${
                    btn === "OK"
                      ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                      : btn === "C"
                      ? "bg-slate-800 hover:bg-slate-700 text-rose-400"
                      : btn === "8"
                      ? "bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40"
                      : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Quick 1-Click Unlock with 8888 */}
            <button
              id="factory-quick-unlock-8888"
              onClick={() => {
                setPinInput("8888");
                setIsUnlocked(true);
                if (initialSubTab) {
                  setActiveSubTab(initialSubTab);
                }
                carAudio.playLockBeep(true);
              }}
              className="px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-xs text-cyan-300 hover:bg-cyan-500/25 font-bold flex items-center gap-1.5 transition"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>
                {activeSubTab === "github"
                  ? "ورود مستقیم با رمز ۸۸۸۸ (ورود به بخش گیت‌هاب)"
                  : "ورود مستقیم با رمز ۸۸۸۸"}
              </span>
            </button>
          </div>
        ) : (
          /* Factory Settings Control Panel */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Top Sub-Nav */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800">
              {[
                { id: "canbus", label: "پروتکل CAN-Bus و ECU", icon: Car },
                { id: "audio", label: "آمپلی‌فایر و صدا DSP", icon: Volume2 },
                { id: "display", label: "نمایشگر و تاچ", icon: Monitor },
                { id: "logo", label: "لوگو و بوت", icon: Sparkles },
                { id: "github", label: "همگام‌سازی گیت‌هاب", icon: GitBranch },
                { id: "reset", label: "ریست و کالیبراسیون", icon: RotateCcw },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      carAudio.playButtonTap();
                      setActiveSubTab(tab.id as any);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      activeSubTab === tab.id
                        ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Tab 1: CAN-Bus & BMW 728Li DME */}
            {activeSubTab === "canbus" && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-sky-900/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">پروتکل کن‌باس خودرو (BMW CAN-Bus Box):</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      فعال (BMW D-CAN / I-Bus MUX)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    پروتکل به صورت بهینه روی باس D-CAN هماهنگ با سیستم Double-VANOS و سنسورهای موتور M52TUB28 ب‌ام‌و کالیبره شده است.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">کلیدهای فرمان (SWC):</span>
                      <span className="text-sky-300 font-mono">BMW M Multi-function OK</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">سنسور دمای محیط:</span>
                      <span className="text-amber-300 font-mono">Front Bumper Sensor (22°C)</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">سنسور پارک و دوربین:</span>
                      <span className="text-emerald-400 font-mono">BMW PDC + Trajectory</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">پورت دیاگ DME:</span>
                      <span className="text-sky-300 font-mono">BMW D-CAN 500kbps OK</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Audio & DSP Amplification */}
            {activeSubTab === "audio" && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">آمپلی‌فایر دیجیتال استیج Hi-Fi ب‌ام‌و:</span>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                      BMW Professional DSP 4x50W
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">پروفایل اکولایزر:</span>
                      <span className="text-emerald-300 font-bold">BMW Harman Kardon Spatial</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">گین سخت‌افزاری:</span>
                      <span className="text-sky-300 font-mono">+6dB Dynamic Bass Active</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">منطقه رادیو:</span>
                      <span className="text-slate-200">ایران و اروپا (ECE / Iran FM/AM)</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">میکس صدای نویگیشن:</span>
                      <span className="text-amber-300 font-mono">۴۰٪ ولوم پس‌زمینه</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Display & Touch Settings */}
            {activeSubTab === "display" && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-sky-300">
                      کالیبراسیون خودکار مانیتور ({detectedProfile.matchedResolutionLabel}):
                    </span>
                    <span className="text-xs font-mono text-emerald-400" dir="ltr">
                      {detectedProfile.screenWidth}×{detectedProfile.screenHeight} · DPR {detectedProfile.devicePixelRatio}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">روشنایی روز / شب خودکار:</span>
                      <span className="text-amber-300 font-bold">{detectedProfile.brightnessProfile}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">مقیاس لمس مانیتور خودرو:</span>
                      <span className="text-sky-300 font-mono" dir="ltr">
                        Scale {detectedProfile.uiScale}x ({detectedProfile.orientation})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Headunit OTA Auto-Update & Required Package Pre-Downloader */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/35 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CloudDownload className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-200">
                        بروزرسانی خودکار مانیتور و دانلود بسته‌های ضروری (OTA)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                      نسخه فعلی: v{APP_BUILD_VERSION}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    هنگام اتصال مانیتور خودرو به اینترنت، نسخه جدید برنامه، ماژول‌های آفلاین، آیکون‌ها و تنظیمات کالیبراسیون به‌طور خودکار دانلود و روی حافظه مانیتور ذخیره می‌شوند.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">آخرین همگام‌سازی:</span>
                      <span className="text-amber-300 font-mono">{otaStatus.lastSyncedAt}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between">
                      <span className="text-slate-400">بسته‌های کش‌شده آفلاین:</span>
                      <span className="text-emerald-300 font-mono">{otaStatus.cachedAssetsCount} بسته</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-amber-100/90 bg-amber-950/35 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
                    {otaStatus.summaryFa}
                  </div>

                  <button
                    id="ota-check-download-btn"
                    type="button"
                    onClick={handleRunOtaUpdateNow}
                    disabled={isOtaSyncing}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isOtaSyncing ? "animate-spin" : ""}`} />
                    <span>
                      {isOtaSyncing
                        ? "در حال بررسی آپدیت و دانلود بسته‌های ضروری..."
                        : "بررسی آپدیت مانیتور و دانلود بسته‌های مورد نیاز"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Sub-Tab 4: Boot Logo & Animation */}
            {activeSubTab === "logo" && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-sky-300">لوگوی استارت آپ مانیتور:</span>
                  <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-sky-500/40 flex items-center justify-center p-1.5 shadow-md">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <circle cx="50" cy="50" r="48" fill="#111" stroke="#ccc" strokeWidth="3" />
                        <text x="50" y="22" fill="#fff" fontSize="12" fontWeight="900" textAnchor="middle" letterSpacing="2">BMW</text>
                        <circle cx="50" cy="58" r="28" fill="#000" stroke="#fff" strokeWidth="2" />
                        <path d="M 50 58 L 50 30 A 28 28 0 0 1 78 58 Z" fill="#0066b2" />
                        <path d="M 50 58 L 50 86 A 28 28 0 0 1 22 58 Z" fill="#0066b2" />
                        <path d="M 50 58 L 22 58 A 28 28 0 0 1 50 30 Z" fill="#ffffff" />
                        <path d="M 50 58 L 78 58 A 28 28 0 0 1 50 86 Z" fill="#ffffff" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-white block">لوگوی رسمی ب‌ام‌و (BMW Roundel - 728Li iDrive)</span>
                      <span className="text-[11px] text-slate-400">
                        بوت سریع فوری (Fast STR Sleep) با انیمیشن BMW M Performance
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 4.5: Sync with GitHub (Private Repository Backup & Restore) */}
            {activeSubTab === "github" && (
              <div id="github-sync-panel" className="space-y-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-cyan-400" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          همگام‌سازی با مخزن شخصی گیت‌هاب (Sync with GitHub)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          ذخیره مستقیم لاگ‌های دیاگ ({recordedSessions.length} گزارش) و وضعیت کامل خودرو در مخزن خصوصی
                        </p>
                      </div>
                    </div>

                    {ghConfig.lastSyncAt && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-1 rounded-lg">
                        آخرین بکاپ: {ghConfig.lastSyncAt}
                      </span>
                    )}
                  </div>

                  {/* Personal Access Token Input */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="github-pat-input" className="text-xs font-bold text-slate-200">
                        توکن دسترسی شخصی گیت‌هاب (Personal Access Token)
                      </label>
                      <div className="flex items-center gap-2.5">
                        <a
                          href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=BMW-728Li-iDrive-Cockpit"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-950/70 border border-cyan-500/40 px-2 py-0.5 rounded-lg inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>ساخت توکن آماده در گیت‌هاب</span>
                        </a>
                        {ghConfig.token && (
                          <button
                            type="button"
                            onClick={() => {
                              carAudio.playButtonTap();
                              setGhConfig(clearGitHubToken());
                              setGhStatus({ type: "info", text: "توکن ذخیره شده از حافظه مرورگر پاک شد." });
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف توکن</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="github-pat-input"
                        type={showGhToken ? "text" : "password"}
                        value={ghConfig.token}
                        onChange={(e) => {
                          const cleaned = e.target.value
                            .replace(/^(Bearer|token)\s+/i, "")
                            .replace(/\s+/g, "");
                          updateGhField({ token: cleaned });
                        }}
                        placeholder="github_pat_... یا ghp_..."
                        dir="ltr"
                        autoComplete="off"
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 text-xs font-mono text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGhToken((v) => !v)}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                        title={showGhToken ? "مخفی کردن توکن" : "نمایش توکن"}
                      >
                        {showGhToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {ghConfig.token.trim().length > 0 &&
                      !/^(gh[opusr]_|github_pat_)/i.test(ghConfig.token.trim()) && (
                        <p className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-500/40 rounded-lg px-2.5 py-1">
                          توجه: توکن معتبر گیت‌هاب باید با <span className="font-mono" dir="ltr">ghp_</span> یا{" "}
                          <span className="font-mono" dir="ltr">github_pat_</span> شروع شود (رمز ورود اکانت یا لینک را اینجا نزنید).
                        </p>
                      )}
                    <p className="text-[10px] text-slate-400">
                      اگر خطای Bad credentials گرفتید، روی <strong>«ساخت توکن آماده در گیت‌هاب»</strong> کلیک کنید، پایین صفحه دکمه سبز{" "}
                      <strong>Generate token</strong> را بزنید، توکن جدید (<span className="font-mono" dir="ltr">ghp_...</span>) را کپی و اینجا پیست کنید.
                    </p>
                  </div>

                  {/* Repo Owner, Repo Name, Branch, File Path */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="space-y-1">
                      <label htmlFor="github-owner-input" className="text-[11px] text-slate-300 font-semibold block">
                        نام کاربری گیت‌هاب (Owner)
                      </label>
                      <input
                        id="github-owner-input"
                        type="text"
                        value={ghConfig.owner}
                        onChange={(e) => updateGhField({ owner: e.target.value })}
                        placeholder="username"
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 font-mono text-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="github-repo-input" className="text-[11px] text-slate-300 font-semibold block">
                        نام مخزن خصوصی (Repository)
                      </label>
                      <input
                        id="github-repo-input"
                        type="text"
                        value={ghConfig.repo}
                        onChange={(e) => updateGhField({ repo: e.target.value })}
                        placeholder="bmw728li-diagnostics-backup"
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 font-mono text-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="github-branch-input" className="text-[11px] text-slate-300 font-semibold block">
                        شاخه (Branch)
                      </label>
                      <input
                        id="github-branch-input"
                        type="text"
                        value={ghConfig.branch}
                        onChange={(e) => updateGhField({ branch: e.target.value })}
                        placeholder="main"
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 font-mono text-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="github-path-input" className="text-[11px] text-slate-300 font-semibold block">
                        مسیر فایل بکاپ (File Path)
                      </label>
                      <input
                        id="github-path-input"
                        type="text"
                        value={ghConfig.filePath}
                        onChange={(e) => updateGhField({ filePath: e.target.value })}
                        placeholder="backups/bmw728li-state.json"
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 font-mono text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Linked Repository Reference Pill */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-300">
                      مخزن متصل پیش‌فرض:{" "}
                      <strong className="font-mono text-cyan-300" dir="ltr">
                        {ghConfig.owner || "mohtaghi6-lab"}/{ghConfig.repo || "bmw728li-idrive-cockpit"}
                      </strong>
                    </span>
                    <div className="flex items-center gap-3 font-mono" dir="ltr">
                      <a
                        href={`https://github.com/${ghConfig.owner || "mohtaghi6-lab"}/${ghConfig.repo || "bmw728li-idrive-cockpit"}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Repository</span>
                      </a>
                      <a
                        href={DEFAULT_GITHUB_COMMIT_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                        title={DEFAULT_GITHUB_REPO_URL}
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>79113b0a</span>
                      </a>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      id="github-automatch-btn"
                      type="button"
                      onClick={handleAutoMatchGitHub}
                      disabled={ghBusy !== null}
                      className="py-2.5 px-3 rounded-xl bg-indigo-950/70 hover:bg-indigo-900/70 border border-indigo-400/50 text-indigo-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                      title="تشخیص خودکار نام کاربری گیت‌هاب از روی توکن و ساخت یا اتصال خودکار مخزن"
                    >
                      <Wand2 className={`w-3.5 h-3.5 text-indigo-300 ${ghBusy === "automatch" ? "animate-spin" : ""}`} />
                      <span>{ghBusy === "automatch" ? "در حال مچ کردن..." : "مچ خودکار اکانت و مخزن"}</span>
                    </button>

                    <button
                      id="github-verify-btn"
                      type="button"
                      onClick={handleVerifyGitHub}
                      disabled={ghBusy !== null}
                      className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      <Wifi className={`w-3.5 h-3.5 text-sky-400 ${ghBusy === "verify" ? "animate-spin" : ""}`} />
                      <span>{ghBusy === "verify" ? "در حال بررسی..." : "تست اتصال مخزن"}</span>
                    </button>

                    <button
                      id="github-sync-btn"
                      type="button"
                      onClick={handleSyncToGitHub}
                      disabled={ghBusy !== null}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md disabled:opacity-50"
                    >
                      <CloudUpload className={`w-4 h-4 ${ghBusy === "sync" ? "animate-bounce" : ""}`} />
                      <span>{ghBusy === "sync" ? "در حال ذخیره..." : "همگام‌سازی و ذخیره دیاگ"}</span>
                    </button>

                    <button
                      id="github-restore-btn"
                      type="button"
                      onClick={handleRestoreFromGitHub}
                      disabled={ghBusy !== null}
                      className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      <CloudDownload className={`w-4 h-4 ${ghBusy === "restore" ? "animate-bounce" : ""}`} />
                      <span>{ghBusy === "restore" ? "در حال بازیابی..." : "بازیابی از گیت‌هاب"}</span>
                    </button>
                  </div>

                  {/* Direct 1-Click Source Push to GitHub Repo */}
                  <button
                    id="github-push-project-btn"
                    type="button"
                    onClick={handlePushProjectToGitHub}
                    disabled={ghBusy !== null}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    <GitBranch className={`w-4 h-4 text-emerald-400 ${ghBusy === "pushcode" ? "animate-spin" : ""}`} />
                    <span>
                      {ghBusy === "pushcode"
                        ? "در حال آپلود تمام کدهای پروژه به گیت‌هاب..."
                        : "ارسال مستقیم کل کدهای جدید برنامه به مخزن گیت‌هاب"}
                    </span>
                  </button>

                  {/* Result Status Banner */}
                  {ghStatus && (
                    <div
                      id="github-sync-status"
                      className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 ${
                        ghStatus.type === "success"
                          ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-200"
                          : ghStatus.type === "error"
                            ? "bg-rose-950/70 border-rose-500/50 text-rose-200"
                            : "bg-slate-900 border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {ghStatus.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{ghStatus.text}</span>
                      </div>
                      {(ghStatus.commitUrl || ghConfig.lastCommitUrl || ghStatus.pagesUrl) &&
                        ghStatus.type === "success" && (
                          <div className="flex flex-wrap items-center gap-3 self-start" dir="ltr">
                            {(ghStatus.commitUrl || ghConfig.lastCommitUrl) && (
                              <a
                                href={ghStatus.commitUrl || ghConfig.lastCommitUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>View on GitHub</span>
                              </a>
                            )}
                            {ghStatus.pagesUrl && (
                              <a
                                href={ghStatus.pagesUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open Live App (Pages)</span>
                              </a>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Step-by-Step GitHub Repo Creation, Code Paste & Auto-Build Guide */}
                  {(() => {
                    const targetOwner = ghConfig.owner.trim() || "YOUR_USERNAME";
                    const targetRepo = ghConfig.repo.trim() || "bmw728li-idrive-cockpit";
                    const targetBranch = ghConfig.branch.trim() || "main";
                    const gitPushCommands = [
                      "git init",
                      "git add .",
                      'git commit -m "Initial commit: BMW 728Li iDrive Cockpit"',
                      `git branch -M ${targetBranch}`,
                      `git remote add origin https://github.com/${targetOwner}/${targetRepo}.git`,
                      `git push -u origin ${targetBranch}`,
                    ].join("\n");

                    return (
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                            <Terminal className="w-4 h-4 shrink-0" />
                            <span>راهنمای ساخت مخزن، پیست کدها و Build خودکار در گیت‌هاب</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              carAudio.playButtonTap();
                              navigator.clipboard?.writeText(gitPushCommands).catch(() => {});
                              setCopiedGitCmd(true);
                              setTimeout(() => setCopiedGitCmd(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1 shrink-0"
                          >
                            {copiedGitCmd ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedGitCmd ? "کپی شد" : "کپی دستورات"}</span>
                          </button>
                        </div>

                        <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
                          <li>
                            در سایت گیت‌هاب (<span className="font-mono text-sky-300" dir="ltr">github.com/new</span>) یک مخزن جدید با نام{" "}
                            <span className="font-mono text-emerald-300" dir="ltr">{targetRepo}</span> بسازید (یا دکمه «مچ خودکار اکانت و ساخت مخزن» بالا را بزنید).
                          </li>
                          <li>
                            فایل‌های دانلودشده را از حالت ZIP خارج کنید، داخل پوشه پروژه ترمینال باز کنید و دستورات زیر را پیست و اجرا کنید:
                          </li>
                        </ol>

                        <pre
                          dir="ltr"
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed select-text"
                        >
                          {gitPushCommands}
                        </pre>

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          <strong className="text-slate-200">بیلد خودکار و مچ شدن با گیت‌هاب:</strong> فایل{" "}
                          <span className="font-mono text-cyan-300" dir="ltr">.github/workflows/deploy.yml</span> داخل کدها قرار دارد؛ کافیست در مخزن گیت‌هاب به مسیر{" "}
                          <span className="font-mono text-slate-200" dir="ltr">Settings → Pages → Source: GitHub Actions</span> بروید تا همزمان با هر آپلود کد، بیلد نهایی ساخته شده و نام کاربری و مخزن شما به‌صورت خودکار با برنامه مچ شود.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Sub-Tab 5: Factory Reset & Optimal Re-Configuration */}
            {activeSubTab === "reset" && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/40 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>ریست کامل فکتوری و تنظیم خودکار مانیتور ب‌ام‌و</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    با فشردن دکمه زیر، تمامی تنظیمات مانیتور به تنظیمات کارخانه بازگشته و بلافاصله بر اساس خودروی شما (BMW 728Li با کامپیوتر Bosch DME MS42 و سیستم Double-VANOS) با بالاترین کیفیت، بدون هنگ و مصرف بهینه رم تنظیم خواهد شد.
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleFullFactoryResetAndOptimalTune}
                      disabled={isResetting}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-lg"
                    >
                      <RefreshCw className={`w-4 h-4 ${isResetting ? "animate-spin" : ""}`} />
                      <span>
                        {isResetting
                          ? "در حال ریست و کالیبراسیون هوشمند..."
                          : "🚀 ریست فکتوری و تنظیم خودکار به بهترین حالت (BMW 728Li)"}
                      </span>
                    </button>
                  </div>
                </div>

                {resetSuccess && (
                  <div className="bg-emerald-950/80 border border-emerald-500/60 p-3.5 rounded-xl space-y-1.5 text-xs text-emerald-200 animate-fadeIn">
                    <div className="flex items-center gap-2 font-bold text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>عملیات ریست و تنظیم کارخانه با موفقیت پایان یافت!</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      • پروتکل کن‌باس روی BMW 728Li تنظیم شد.
                      <br />
                      • سنسور دمای بیرون سپر جلو فعال و کالیبره شد (۲۲°C).
                      <br />
                      • حافظه کش پاکسازی و سرعت سیستم iDrive به ۱۰۰٪ افزایش یافت.
                      <br />
                      • اکولایزر صدا و ولوم تقویت‌کننده Hi-Fi ب‌ام‌و تنظیم شد.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 font-mono">
            {isUnlocked ? "✅ دسترسی سطح کارخانه: مجاز" : "🔒 رمز کارخانه: 8888"}
          </span>

          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  handleFullFactoryResetAndOptimalTune();
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ریست و تنظیم بهینه</span>
              </button>
            )}
            <button
              onClick={() => {
                carAudio.playButtonTap();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
