import {
  Wifi,
  WifiOff,
  Mic,
  Volume2,
  Settings,
  ArrowRight,
  Compass,
  Sliders,
  Music,
  Cpu,
  ShieldAlert,
} from "lucide-react";
import { CarState } from "../types";
import { carAudio } from "../utils/carSpeech";
import { PWAInstallButton } from "./PWAInstallButton";

export type MainAppTab = "dash" | "nav" | "controls" | "media" | "settings";

interface CarHeaderProps {
  carState: CarState;
  onToggleOnline: () => void;
  onOpenSpecs: () => void;
  onOpenFactorySettings?: () => void;
  onOpenDatabase: () => void;
  onToggleStealthHud: () => void;
  onOpenVoiceAssistant?: () => void;
  onOpenSos?: () => void;
  onOpen3DShowroom?: () => void;
  isSpeaking?: boolean;
  jarvisStandbyActive?: boolean;
  jarvisStandbyListening?: boolean;
  onToggleJarvisStandby?: () => void;
  activeTab: MainAppTab;
  setActiveTab: (tab: MainAppTab) => void;
  activeAlertsCount?: number;
  onAlertStatusClick?: () => void;
}

const SUB_TAB_META: Record<Exclude<MainAppTab, "dash">, { label: string; icon: typeof Compass }> = {
  nav: { label: "ناوبری GPS", icon: Compass },
  controls: { label: "کنترل خودرو ۷۲۸", icon: Sliders },
  media: { label: "رسانه و موسیقی", icon: Music },
  settings: { label: "تنظیمات و ECU", icon: Cpu },
};

export default function CarHeader({
  carState,
  onToggleOnline,
  onOpenSpecs,
  onOpenFactorySettings,
  onOpenVoiceAssistant,
  onOpenSos,
  isSpeaking,
  jarvisStandbyActive,
  jarvisStandbyListening,
  onToggleJarvisStandby,
  activeTab,
  setActiveTab,
  activeAlertsCount = 0,
  onAlertStatusClick,
}: CarHeaderProps) {
  const ActiveSubMeta = activeTab !== "dash" ? SUB_TAB_META[activeTab] : null;
  const SubIcon = ActiveSubMeta?.icon;

  return (
    <header
      id="car-system-header"
      className="bg-[#020506]/95 backdrop-blur-xl border-b border-teal-200/12 text-slate-100 px-3 sm:px-5 py-1.5 flex items-center justify-between gap-3 select-none z-30 relative shadow-[0_8px_28px_rgba(0,0,0,0.75)]"
      dir="rtl"
    >
      {/* BMW M-Sport Top Precision Hairline */}
      <div className="absolute top-0 left-0 right-0 h-[2px] flex pointer-events-none">
        <div className="w-1/3 bg-[#0066b2]" />
        <div className="w-1/3 bg-[#1d4ed8]" />
        <div className="w-1/3 bg-[#e21a24]" />
      </div>

      {/* Zone 1: Brand Logo (no clock, no redundant nav menus on dashboard since all 6 icons sit below) */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          id="car-specs-trigger"
          onClick={() => {
            carAudio.playButtonTap();
            onOpenSpecs();
          }}
          className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-white/[0.04] transition active:scale-95 group shrink-0"
          title="مشخصات فنی BMW 728Li"
        >
          {/* Authentic BMW Roundel Emblem SVG */}
          <div className="w-8 h-8 rounded-full bg-neutral-950 border border-white/30 p-0.5 shadow-[0_0_16px_rgba(0,102,178,0.28)] flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="48" fill="#0b0e14" stroke="#cbd5e1" strokeWidth="3" />
              <text x="50" y="22" fill="#fff" fontSize="12" fontWeight="900" textAnchor="middle" letterSpacing="2">
                BMW
              </text>
              <circle cx="50" cy="58" r="28" fill="#000" stroke="#fff" strokeWidth="2" />
              <path d="M 50 58 L 50 30 A 28 28 0 0 1 78 58 Z" fill="#0066b2" />
              <path d="M 50 58 L 50 86 A 28 28 0 0 1 22 58 Z" fill="#0066b2" />
              <path d="M 50 58 L 22 58 A 28 28 0 0 1 50 30 Z" fill="#ffffff" />
              <path d="M 50 58 L 78 58 A 28 28 0 0 1 50 86 Z" fill="#ffffff" />
            </svg>
          </div>

          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-extrabold tracking-wide text-sm text-white font-mono">BMW 728Li</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-[11px] font-mono bmw-accent-text font-semibold">iDrive</span>
            </div>
          </div>
        </button>

        {/* When inside any sub-page, show a clean single Back-to-Dashboard control + current module title */}
        {activeTab !== "dash" && ActiveSubMeta && SubIcon && (
          <div className="flex items-center gap-2 min-w-0">
            <button
              id="tab-btn-dash"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setActiveTab("dash");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bmw-accent-btn text-xs font-bold transition active:scale-95 whitespace-nowrap shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>بازگشت به داشبورد</span>
            </button>
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-teal-100 font-semibold whitespace-nowrap">
              <SubIcon className="w-3.5 h-3.5 bmw-accent-text" />
              <span>{ActiveSubMeta.label}</span>
            </div>
          </div>
        )}
      </div>

      {/* Zone 2: Minimalist BMW iDrive Status Corner (SOS, Jarvis Mic, Online, Android APK, Factory) - NO clock */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

        {onOpenSos && (
          <button
            id="header-sos-btn"
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onOpenSos();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 border border-rose-400/70 text-white text-xs font-extrabold tracking-wider transition active:scale-95 whitespace-nowrap shrink-0 shadow-[0_0_16px_rgba(225,29,72,0.35)]"
            title="امداد و تماس اضطراری (SOS)"
            aria-label="امداد و تماس اضطراری SOS"
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>SOS</span>
          </button>
        )}

        {onToggleJarvisStandby && (
          <button
            id="header-jarvis-wake-toggle"
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onToggleJarvisStandby();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 whitespace-nowrap shrink-0 ${
              jarvisStandbyActive
                ? jarvisStandbyListening
                  ? "bg-emerald-950/75 border-emerald-400/60 text-emerald-300 hover:bg-emerald-900/50"
                  : "bg-amber-950/60 border-amber-400/50 text-amber-200 hover:bg-amber-900/50"
                : "hardware-key text-slate-400 hover:text-slate-200"
            }`}
            title="بیدارباش صوتی دائمی: با گفتن «جارویز» مکالمه شروع می‌شود"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                jarvisStandbyActive
                  ? jarvisStandbyListening
                    ? "bg-emerald-400 animate-ping"
                    : "bg-amber-400 animate-pulse"
                  : "bg-slate-600"
              }`}
            />
            <span className="hidden md:inline">
              {jarvisStandbyActive
                ? jarvisStandbyListening
                  ? "جارویز آماده‌باش"
                  : "در حال آماده‌سازی..."
                : "جارویز خاموش"}
            </span>
          </button>
        )}

        {onOpenVoiceAssistant && (
          <button
            id="header-voice-assistant-trigger"
            onClick={() => {
              carAudio.playBmwGong();
              onOpenVoiceAssistant();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs transition active:scale-95 whitespace-nowrap shrink-0 ${
              isSpeaking
                ? "bg-amber-500 text-slate-950 border-amber-300 animate-pulse shadow-amber-500/40"
                : "bmw-accent-btn bmw-accent-border hover:brightness-110"
            }`}
            title="گفتگوی صوتی زنده با جارویز"
          >
            {isSpeaking ? (
              <Volume2 className="w-4 h-4 animate-spin text-slate-950" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isSpeaking ? "در حال صحبت..." : "جارویز"}</span>
          </button>
        )}

        <button
          id="toggle-online-btn"
          onClick={() => {
            carAudio.playButtonTap();
            onToggleOnline();
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap shrink-0 ${
            carState.isOnline
              ? "bg-emerald-950/50 border-emerald-500/35 text-emerald-300 hover:bg-emerald-900/40"
              : "bg-amber-950/50 border-amber-500/35 text-amber-300 hover:bg-amber-900/40"
          }`}
          title="وضعیت اینترنت"
        >
          {carState.isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">آنلاین</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">آفلاین</span>
            </>
          )}
        </button>

        <PWAInstallButton />

        {onOpenFactorySettings && (
          <button
            id="header-factory-settings-btn"
            onClick={() => {
              carAudio.playButtonTap();
              onOpenFactorySettings();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/45 text-cyan-200 hover:bg-cyan-900/50 hover:text-white text-xs font-bold active:scale-95 whitespace-nowrap shrink-0 transition"
            title="تنظیمات فکتوری و گیت‌هاب (رمز: 8888)"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">فکتوری / گیت‌هاب</span>
          </button>
        )}
      </div>
    </header>
  );
}
