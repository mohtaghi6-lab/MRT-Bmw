import { useState } from "react";
import {
  TriangleAlert,
  Lock,
  Unlock,
  Fan,
  Play,
  Pause,
  SkipForward,
  Plus,
  Minus,
  Lightbulb,
  Box,
  Mic,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { CarState, MusicTrack, NavigationRoute } from "../types";
import { carAudio } from "../utils/carSpeech";
import AnalogClock from "./AnalogClock";
import WeatherSummaryCard from "./WeatherSummaryCard";

interface DashboardViewProps {
  carState: CarState;
  onUpdateCarState: (update: Partial<CarState>) => void;
  currentTrack: MusicTrack;
  onPlayFlash: () => void;
  onNextTrack?: () => void;
  onTogglePlayPause?: () => void;
  activeRoute?: NavigationRoute | null;
  onOpenNavTab?: () => void;
  onOpenControlsTab?: () => void;
  onOpenMediaTab?: () => void;
  onOpenSettingsTab?: (subTab?: "ecu" | "telemetry" | "visual" | "schedule" | "system") => void;
  onOpenVoiceAssistant?: () => void;
  onOpen3DShowroom?: () => void;
  isSpeaking?: boolean;
  activeAlertsCount?: number;
  topAlertMessage?: string | null;
  micNoiseFilterActive?: boolean;
  gpsConnected?: boolean;
  gpsCoords?: { lat: number; lon: number; accuracy?: number } | null;
  onRequestGpsFix?: () => void;
}

type Id6TileId = "media" | "jarvis" | "navigation" | "ecu" | "vehicle" | "notifications";

export default function DashboardView({
  carState,
  onUpdateCarState,
  currentTrack,
  onPlayFlash,
  onNextTrack,
  onTogglePlayPause,
  onOpenNavTab,
  onOpenControlsTab,
  onOpenMediaTab,
  onOpenSettingsTab,
  onOpenVoiceAssistant,
  onOpen3DShowroom,
  isSpeaking,
  micNoiseFilterActive = false,
  gpsConnected = false,
  gpsCoords = null,
  onRequestGpsFix,
}: DashboardViewProps) {
  const [focusedTile, setFocusedTile] = useState<Id6TileId>("media");
  const [quickControlsOpen, setQuickControlsOpen] = useState(false);

  const tiles: Array<{
    id: Id6TileId;
    title: string;
    onActivate: () => void;
  }> = [
    {
      id: "media",
      title: "رسانه و رادیو",
      onActivate: () => onOpenMediaTab?.(),
    },
    {
      id: "jarvis",
      title: "ارتباط و جارویز",
      onActivate: () => {
        carAudio.playBmwGong();
        onOpenVoiceAssistant?.();
      },
    },
    {
      id: "navigation",
      title: "مسیریابی",
      onActivate: () => onOpenNavTab?.(),
    },
    {
      id: "ecu",
      title: "کامپیوتر خودرو",
      onActivate: () => onOpenSettingsTab?.("ecu"),
    },
    {
      id: "vehicle",
      title: "خودروی من ۷۲۸",
      onActivate: () => onOpenControlsTab?.(),
    },
    {
      id: "notifications",
      title: "تنظیمات و سیستم",
      onActivate: () => onOpenSettingsTab?.("telemetry"),
    },
  ];

  // Subtle 3D perspective carousel depth matching the BMW iDrive ID6 monitor photo
  const getTileDepthClasses = (idx: number) => {
    switch (idx) {
      case 0:
        return "lg:scale-y-[1.06] lg:[transform:perspective(1100px)_rotateY(7deg)] origin-right";
      case 1:
        return "lg:scale-y-[1.02] lg:[transform:perspective(1100px)_rotateY(3deg)] origin-right";
      case 2:
        return "lg:scale-y-[0.99]";
      case 3:
        return "lg:scale-y-[0.99]";
      case 4:
        return "lg:scale-y-[1.02] lg:[transform:perspective(1100px)_rotateY(-3deg)] origin-left";
      case 5:
        return "lg:scale-y-[1.06] lg:[transform:perspective(1100px)_rotateY(-7deg)] origin-left";
      default:
        return "";
    }
  };

  return (
    <div
      id="dash-tab-content"
      className="flex-1 flex flex-col overflow-hidden bg-[#010203] select-none relative"
      dir="rtl"
    >
      {/* Brushed Metallic Upper Monitor Bezel Rim */}
      <div
        aria-hidden="true"
        className="h-[3px] w-full bg-gradient-to-r from-[#0f1416] via-[#5a666b] to-[#0f1416] opacity-75 shrink-0"
      />

      {/* Full-Bleed BMW iDrive ID6 Widescreen Monitor Stage */}
      <section
        aria-label="صفحه اصلی مانیتور BMW 728Li"
        className="relative flex-1 flex flex-col justify-between overflow-hidden px-3 sm:px-8 lg:px-12 pb-3 pt-0"
        style={{
          background:
            "radial-gradient(ellipse 68% 58% at 50% 48%, rgba(16, 72, 76, 0.44) 0%, rgba(5, 25, 28, 0.24) 56%, #010203 100%)",
        }}
      >
        {/* Subtle Curved Diagonal Light Horizon Streaks matching the Reference Photo */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 420"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-65"
        >
          <defs>
            <linearGradient id="id6StreakLeft" x1="0%" y1="0%" x2="100%" y2="55%">
              <stop offset="0%" stopColor="#ccfbf1" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#5eead4" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="id6StreakRight" x1="100%" y1="0%" x2="0%" y2="55%">
              <stop offset="0%" stopColor="#ccfbf1" stopOpacity="0.42" />
              <stop offset="55%" stopColor="#5eead4" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 35 0 Q 250 75 490 132" stroke="url(#id6StreakLeft)" strokeWidth="1.4" fill="none" />
          <path d="M 1405 0 Q 1190 75 950 132" stroke="url(#id6StreakRight)" strokeWidth="1.4" fill="none" />
        </svg>

        {/* Top Row: Interactive Stationary Weather Summary Card (Left) + Status Capsule (Right) */}
        <div className="relative z-20 flex flex-wrap items-start justify-between gap-3 pt-1" dir="ltr">
          <WeatherSummaryCard
            carState={carState}
            gpsCoords={gpsCoords}
            onUpdateCarState={onUpdateCarState}
            onRequestGpsFix={onRequestGpsFix}
          />

          <div
            className="flex items-center gap-3.5 pl-6 pr-4 py-1 bg-[#040c0d]/92 border-b border-l border-teal-200/20 shadow-[0_8px_22px_rgba(0,0,0,0.8)] ml-auto"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 16px 100%)" }}
          >
            {/* Ascending Signal Strength Bars */}
            <div
              className="flex items-end gap-[2px] h-3"
              title={carState.isOnline ? "متصل به اینترنت" : "حالت آفلاین خودرو"}
            >
              {[1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  style={{ height: `${bar * 3}px` }}
                  className={`w-[2.5px] rounded-[1px] ${
                    carState.isOnline
                      ? "bg-teal-100/90"
                      : bar <= 1
                        ? "bg-amber-400"
                        : "bg-slate-700"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                carAudio.playBmwGong();
                onOpenVoiceAssistant?.();
              }}
              className={`flex items-center gap-1 transition ${
                isSpeaking || micNoiseFilterActive
                  ? "text-[#ff6b1a]"
                  : "text-teal-100/85 hover:text-white"
              }`}
              title="گفتگوی صوتی زنده با جارویز"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Centered & Enlarged 6 Dominant BMW iDrive ID6 Translucent Teal Glass Tiles */}
        <div className="relative z-10 flex-1 flex items-center justify-center w-full py-1" dir="ltr">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5 items-stretch w-full max-w-[1440px]">
          {tiles.map((tile, idx) => {
            const isSelected = focusedTile === tile.id;
            return (
              <div
                key={tile.id}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="dashboard-card-enter flex flex-col items-stretch"
              >
                <div
                  className={`flex-1 flex flex-col items-center justify-end relative group transition-transform duration-200 ${getTileDepthClasses(idx)}`}
                >
                {/* Floating Crisp White Title ABOVE Each Card (Exactly like Reference Photo) */}
                <span
                  dir="rtl"
                  className={`text-xs sm:text-sm lg:text-[15px] font-bold mb-2.5 tracking-tight truncate max-w-full transition-colors ${
                    isSelected
                      ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                      : "text-slate-200/85 group-hover:text-white"
                  }`}
                >
                  {tile.title}
                </span>

                {/* Tall 3D Luminous Gradient-Framed BMW iDrive ID6 Glass Tile */}
                <button
                  id={`id6-tile-${tile.id}`}
                  type="button"
                  onMouseEnter={() => setFocusedTile(tile.id)}
                  onFocus={() => setFocusedTile(tile.id)}
                  onClick={() => {
                    carAudio.playButtonTap();
                    setFocusedTile(tile.id);
                    tile.onActivate();
                  }}
                  style={{
                    background: isSelected
                      ? "linear-gradient(142deg, var(--bmw-accent) 0%, rgba(204, 251, 241, 0.78) 38%, rgba(45, 212, 191, 0.48) 72%, var(--bmw-accent-2) 100%)"
                      : "linear-gradient(142deg, rgba(153, 246, 228, 0.56) 0%, rgba(45, 212, 191, 0.22) 44%, rgba(13, 148, 136, 0.14) 76%, rgba(153, 246, 228, 0.36) 100%)",
                    boxShadow: isSelected
                      ? "0 22px 44px rgba(0, 0, 0, 0.94), 0 0 34px var(--bmw-accent-glow), 0 0 18px rgba(45, 212, 191, 0.24)"
                      : "0 16px 32px rgba(0, 0, 0, 0.85), 0 0 20px rgba(20, 184, 166, 0.16)",
                  }}
                  className={`relative w-full flex-1 min-h-[175px] sm:min-h-[205px] lg:min-h-[228px] rounded-[8px] p-[1.5px] flex items-stretch justify-center transition-transform duration-200 cursor-pointer ${
                    isSelected ? "-translate-y-1" : "hover:-translate-y-0.5"
                  }`}
                >
                  {/* Inner Smoked Glass Surface with 3D Specular Depth & Gradient Sheen */}
                  <div
                    style={{
                      background:
                        "linear-gradient(165deg, rgba(18, 70, 75, 0.42) 0%, rgba(3, 12, 14, 0.88) 54%, rgba(1, 5, 7, 0.96) 100%)",
                      boxShadow: isSelected
                        ? "inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 0 26px var(--bmw-accent-soft), inset 0 -16px 28px rgba(0, 0, 0, 0.78)"
                        : "inset 0 1px 0 rgba(204, 251, 241, 0.24), inset 0 0 16px rgba(20, 184, 166, 0.08), inset 0 -14px 24px rgba(0, 0, 0, 0.75)",
                    }}
                    className="relative w-full h-full rounded-[6.5px] p-3 flex items-center justify-center overflow-hidden backdrop-blur-md"
                  >
                    {/* Top Luminous Specular Edge Glint */}
                    <div
                      aria-hidden="true"
                      className={`absolute inset-x-3 top-0 h-[1.5px] bg-gradient-to-r from-transparent to-transparent pointer-events-none ${
                        isSelected ? "via-white/85" : "via-teal-100/70"
                      }`}
                    />
                    {/* Subtle Diagonal 3D Glass Bevel Sheen */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/50 pointer-events-none"
                    />
                    {/* Ambient Radial Bloom inside Active Tile */}
                    {isSelected && (
                      <div
                        aria-hidden="true"
                        style={{
                          background:
                            "radial-gradient(circle at 50% 50%, var(--bmw-accent-soft) 0%, rgba(45, 212, 191, 0.08) 48%, transparent 76%)",
                        }}
                        className="absolute inset-0 pointer-events-none"
                      />
                    )}

                    {/* Centered Enlarged Icon Well with Glowing Gradient Rim */}
                    <div
                      style={{
                        background: isSelected
                          ? "linear-gradient(145deg, var(--bmw-accent) 0%, rgba(204, 251, 241, 0.55) 50%, var(--bmw-accent-2) 100%)"
                          : "linear-gradient(145deg, rgba(153, 246, 228, 0.34) 0%, rgba(20, 184, 166, 0.12) 55%, rgba(153, 246, 228, 0.22) 100%)",
                        boxShadow: isSelected
                          ? "0 0 26px var(--bmw-accent-glow)"
                          : "0 6px 16px rgba(0, 0, 0, 0.65)",
                      }}
                      className="w-[88%] aspect-square max-w-[162px] rounded-[5px] p-[1.5px] flex items-center justify-center relative transition-all duration-200"
                    >
                      <div
                        style={{
                          boxShadow: isSelected
                            ? "inset 0 0 20px var(--bmw-accent-soft), inset 0 1px 0 rgba(255,255,255,0.18)"
                            : "inset 0 1px 0 rgba(204,251,241,0.12), inset 0 -8px 16px rgba(0,0,0,0.65)",
                        }}
                        className={`w-full h-full rounded-[3.5px] flex items-center justify-center relative ${
                          isSelected ? "bg-[#020a0c]/88" : "bg-[#02090b]/82"
                        }`}
                      >
                        {/* Inner Double-Rim Ambient Bevel matching System Lighting */}
                        {isSelected && (
                          <div
                            aria-hidden="true"
                            style={{ borderColor: "var(--bmw-accent-border)" }}
                            className="absolute inset-[3px] border rounded-[2px] pointer-events-none"
                          />
                        )}

                    {/* Card 1: Media/Radio Hardware Deck + Translucent Musical Note */}
                    {tile.id === "media" && (
                      <svg viewBox="0 0 96 96" className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
                        <defs>
                          <linearGradient id="deckGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1b4347" />
                            <stop offset="60%" stopColor="#081a1c" />
                            <stop offset="100%" stopColor="#030a0b" />
                          </linearGradient>
                          <linearGradient id="noteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#ccfbf1" stopOpacity="0.92" />
                            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.45" />
                          </linearGradient>
                        </defs>
                        {/* 3D Isometric Receiver Chassis */}
                        <polygon points="16,44 64,34 80,46 32,58" fill="#133437" stroke="#99f6e4" strokeOpacity="0.35" strokeWidth="1" />
                        <polygon points="16,44 32,58 32,76 16,62" fill="url(#deckGrad)" stroke="#5eead4" strokeOpacity="0.28" strokeWidth="1" />
                        <polygon points="32,58 80,46 80,64 32,76" fill="#061618" stroke="#99f6e4" strokeOpacity="0.32" strokeWidth="1" />
                        <line x1="38" y1="62" x2="64" y2="55.5" stroke="#99f6e4" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
                        <circle cx="72" cy="54" r="3" fill="#99f6e4" fillOpacity="0.55" />
                        {/* Floating Musical Eighth-Note */}
                        <path
                          d="M54 45 V18 L73 14 V38"
                          fill="none"
                          stroke="url(#noteGrad)"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <ellipse cx="48.5" cy="46" rx="6.5" ry="4.4" transform="rotate(-15 48.5 46)" fill="url(#noteGrad)" />
                        <ellipse cx="68" cy="39.5" rx="5.5" ry="3.8" transform="rotate(-15 68 39.5)" fill="url(#noteGrad)" />
                      </svg>
                    )}

                    {/* Card 2: Communication / Jarvis Frosted Dual Speech Bubbles */}
                    {tile.id === "jarvis" && (
                      <svg viewBox="0 0 96 96" className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]">
                        <defs>
                          <linearGradient id="bubbleBack" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#134246" stopOpacity="0.85" />
                            <stop offset="100%" stopColor="#051719" stopOpacity="0.95" />
                          </linearGradient>
                          <linearGradient id="bubbleFront" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1e6065" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#082427" stopOpacity="0.96" />
                          </linearGradient>
                        </defs>
                        {/* Back Speech Bubble */}
                        <path
                          d="M44 46 H78 A6 6 0 0 1 84 52 V68 A6 6 0 0 1 78 74 H72 V83 L61 74 H44 A6 6 0 0 1 38 68 V52 A6 6 0 0 1 44 46 Z"
                          fill="url(#bubbleBack)"
                          stroke="#5eead4"
                          strokeOpacity="0.35"
                          strokeWidth="1.4"
                        />
                        {/* Front Speech Bubble */}
                        <path
                          d="M16 20 H58 A7 7 0 0 1 65 27 V50 A7 7 0 0 1 58 57 H34 L21 69 V57 H16 A7 7 0 0 1 9 50 V27 A7 7 0 0 1 16 20 Z"
                          fill="url(#bubbleFront)"
                          stroke="#ccfbf1"
                          strokeOpacity="0.58"
                          strokeWidth="1.6"
                        />
                        {/* Silver Handset / Voice Wave Silhouette */}
                        <path
                          d="M27 30 C25 32 25 35 27 38 C31 44 37 48 44 49 C47 49 49 48 50 45 L46 41 L42 43 C38 41 35 38 33 34 L35 31 Z"
                          fill="none"
                          stroke={isSpeaking ? "#ff8533" : "#e2f8f5"}
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}

                    {/* Card 3: Navigation Map Plate + Circular Orange Pointer */}
                    {tile.id === "navigation" && (
                      <svg viewBox="0 0 96 96" className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
                        <defs>
                          <linearGradient id="mapBlock" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#174d52" />
                            <stop offset="100%" stopColor="#041315" />
                          </linearGradient>
                        </defs>
                        <rect
                          x="10"
                          y="16"
                          width="76"
                          height="60"
                          rx="4"
                          fill="url(#mapBlock)"
                          stroke="#99f6e4"
                          strokeOpacity="0.42"
                          strokeWidth="1.5"
                        />
                        {/* Street Grid Lines */}
                        <path
                          d="M10 38 H86 M10 56 H86 M36 16 V76 M58 16 V76"
                          stroke="#5eead4"
                          strokeOpacity="0.28"
                          strokeWidth="2.2"
                        />
                        <path d="M12 72 L82 22" stroke="#ccfbf1" strokeOpacity="0.38" strokeWidth="3" />
                        {/* Glowing Circular Navigation Beacon */}
                        <circle cx="58" cy="54" r="14" fill="#030b0c" stroke="#e2f8f5" strokeWidth="2.2" />
                        <circle cx="58" cy="54" r="10.5" fill="none" stroke="#e85d04" strokeWidth="1.5" strokeOpacity="0.8" />
                        <polygon points="58,44 65,61 58,57 51,61" fill="#ff731d" />
                      </svg>
                    )}

                    {/* Card 4: ConnectedDrive / Car ECU Glossy Sphere + Orbital Rings */}
                    {tile.id === "ecu" && (
                      <svg viewBox="0 0 96 96" className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 drop-shadow-[0_6px_14px_rgba(0,0,0,0.88)]">
                        <defs>
                          <radialGradient id="ecuGlobe" cx="35%" cy="30%" r="70%">
                            <stop offset="0%" stopColor="#267379" stopOpacity="0.82" />
                            <stop offset="55%" stopColor="#09292c" stopOpacity="0.92" />
                            <stop offset="100%" stopColor="#020b0c" stopOpacity="0.98" />
                          </radialGradient>
                        </defs>
                        <circle cx="48" cy="48" r="29" fill="url(#ecuGlobe)" stroke="#99f6e4" strokeOpacity="0.48" strokeWidth="1.6" />
                        <ellipse
                          cx="48"
                          cy="48"
                          rx="27"
                          ry="10"
                          transform="rotate(-32 48 48)"
                          fill="none"
                          stroke="#ccfbf1"
                          strokeOpacity="0.58"
                          strokeWidth="1.8"
                        />
                        <ellipse
                          cx="48"
                          cy="48"
                          rx="26"
                          ry="9"
                          transform="rotate(28 48 48)"
                          fill="none"
                          stroke="#5eead4"
                          strokeOpacity="0.32"
                          strokeWidth="1.2"
                        />
                        {/* Metallic 'A' / ECU Crest */}
                        <path
                          d="M34 62 L48 28 L62 62 M39 52 H57"
                          fill="none"
                          stroke="#e6fffa"
                          strokeOpacity="0.92"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}

                    {/* Card 5: My Vehicle — Front-Facing Silver Metallic BMW 728Li on Dark Studio Ground */}
                    {tile.id === "vehicle" && (
                      <svg
                        viewBox="0 0 120 96"
                        className="w-full h-full p-1 drop-shadow-[0_10px_14px_rgba(0,0,0,0.95)]"
                        aria-label="BMW 728Li Front Silhouette"
                      >
                        <defs>
                          <linearGradient id="bmwSilverBody" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#f8fafc" />
                            <stop offset="35%" stopColor="#cbd5e1" />
                            <stop offset="70%" stopColor="#64748b" />
                            <stop offset="100%" stopColor="#0f172a" />
                          </linearGradient>
                          <linearGradient id="bmwWindshield" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#0f172a" />
                            <stop offset="100%" stopColor="#334155" />
                          </linearGradient>
                          <radialGradient id="angelEyeGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                            <stop offset="45%" stopColor="#bae6fd" stopOpacity="0.7" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                          </radialGradient>
                        </defs>

                        {/* Ground Shadow */}
                        <ellipse cx="60" cy="78" rx="48" ry="6" fill="#000000" fillOpacity="0.9" />

                        {/* Tires */}
                        <rect x="14" y="64" width="12" height="14" rx="2.5" fill="#020617" />
                        <rect x="94" y="64" width="12" height="14" rx="2.5" fill="#020617" />

                        {/* Side Mirrors */}
                        <path d="M18 42 L11 40 C9.5 40 9.5 44 12 45 L19 46 Z" fill="#cbd5e1" />
                        <path d="M102 42 L109 40 C110.5 40 110.5 44 108 45 L101 46 Z" fill="#cbd5e1" />

                        {/* Roof & Windshield */}
                        <path
                          d="M27 42 L34 26 C36 22 44 21 60 21 C76 21 84 22 86 26 L93 42 Z"
                          fill="url(#bmwSilverBody)"
                        />
                        <path
                          d="M31 41 L36 27 C38 24 46 23.5 60 23.5 C74 23.5 82 24 84 27 L89 41 Z"
                          fill="url(#bmwWindshield)"
                        />

                        {/* Sculpted Hood & Wide Front Fenders */}
                        <path
                          d="M15 50 C16 44 22 41 30 41 H90 C98 41 104 44 105 50 L107 63 C107 67 103 70 98 70 H22 C17 70 13 67 13 63 Z"
                          fill="url(#bmwSilverBody)"
                          stroke="#e2e8f0"
                          strokeOpacity="0.35"
                          strokeWidth="0.7"
                        />

                        {/* Hood Power Bulge Lines */}
                        <path d="M36 42 L48 53 M84 42 L72 53" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" />

                        {/* Classic BMW Roundel on Hood Nose */}
                        <circle cx="60" cy="49" r="2.2" fill="#e2e8f0" stroke="#0f172a" strokeWidth="0.6" />
                        <circle cx="60" cy="49" r="1.2" fill="#0284c7" />

                        {/* Iconic Twin Kidney Grilles with Chrome Surround */}
                        <rect x="48" y="53" width="10.5" height="7.5" rx="2.5" fill="#0b1116" stroke="#f8fafc" strokeWidth="1.3" />
                        <rect x="61.5" y="53" width="10.5" height="7.5" rx="2.5" fill="#0b1116" stroke="#f8fafc" strokeWidth="1.3" />
                        <line x1="51" y1="53.5" x2="51" y2="60" stroke="#94a3b8" strokeWidth="0.7" />
                        <line x1="53.5" y1="53.5" x2="53.5" y2="60" stroke="#94a3b8" strokeWidth="0.7" />
                        <line x1="56" y1="53.5" x2="56" y2="60" stroke="#94a3b8" strokeWidth="0.7" />
                        <line x1="64" y1="53.5" x2="64" y2="60" stroke="#94a3b8" strokeWidth="0.7" />
                        <line x1="66.5" y1="53.5" x2="66.5" y2="60" stroke="#94a3b8" strokeWidth="0.7" />
                        <line x1="69" y1="53.5" x2="69" y2="60" stroke="#94a3b8" strokeWidth="0.7" />

                        {/* Lower Bumper Air Dam & Fog Lamps */}
                        <path d="M31 64 H89 L86 68 H34 Z" fill="#090d11" />
                        <ellipse cx="26" cy="65.5" rx="3" ry="1.6" fill="#e0f2fe" fillOpacity="0.65" />
                        <ellipse cx="94" cy="65.5" rx="3" ry="1.6" fill="#e0f2fe" fillOpacity="0.65" />

                        {/* Quad Angel-Eye Headlights */}
                        <rect x="19" y="52.5" width="21" height="7" rx="2.2" fill="#0b1318" stroke="#94a3b8" strokeWidth="0.7" />
                        <rect x="80" y="52.5" width="21" height="7" rx="2.2" fill="#0b1318" stroke="#94a3b8" strokeWidth="0.7" />
                        <circle cx="25.5" cy="56" r="4.8" fill="url(#angelEyeGlow)" />
                        <circle cx="33.5" cy="56" r="4.2" fill="url(#angelEyeGlow)" />
                        <circle cx="86.5" cy="56" r="4.2" fill="url(#angelEyeGlow)" />
                        <circle cx="94.5" cy="56" r="4.8" fill="url(#angelEyeGlow)" />
                        <circle cx="25.5" cy="56" r="2.2" fill="none" stroke="#ffffff" strokeWidth="0.9" />
                        <circle cx="33.5" cy="56" r="2" fill="none" stroke="#e0f2fe" strokeWidth="0.8" />
                        <circle cx="86.5" cy="56" r="2" fill="none" stroke="#e0f2fe" strokeWidth="0.8" />
                        <circle cx="94.5" cy="56" r="2.2" fill="none" stroke="#ffffff" strokeWidth="0.9" />
                      </svg>
                    )}

                    {/* Card 6: Notifications & Settings Layered Envelope */}
                    {tile.id === "notifications" && (
                      <div className="relative flex items-center justify-center">
                        <svg viewBox="0 0 96 96" className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
                          <defs>
                            <linearGradient id="envLayer" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#1b595e" stopOpacity="0.82" />
                              <stop offset="100%" stopColor="#05181a" stopOpacity="0.96" />
                            </linearGradient>
                          </defs>
                          {/* Back Layered Square */}
                          <rect
                            x="21"
                            y="18"
                            width="60"
                            height="56"
                            rx="4"
                            fill="#092629"
                            stroke="#5eead4"
                            strokeOpacity="0.32"
                            strokeWidth="1.2"
                          />
                          {/* Front Frosted Frame */}
                          <rect
                            x="14"
                            y="24"
                            width="60"
                            height="54"
                            rx="4"
                            fill="url(#envLayer)"
                            stroke="#99f6e4"
                            strokeOpacity="0.52"
                            strokeWidth="1.5"
                          />
                          {/* Envelope Icon */}
                          <rect
                            x="24"
                            y="37"
                            width="40"
                            height="28"
                            rx="2.5"
                            fill="#0b2c30"
                            stroke="#ccfbf1"
                            strokeOpacity="0.68"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M25.5 39 L44 53 L62.5 39"
                            fill="none"
                            stroke="#ccfbf1"
                            strokeOpacity="0.82"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Signature Ambient Floor Reflection Pool beneath Selected Card */}
                <div
                  aria-hidden="true"
                  style={
                    isSelected
                      ? {
                          background:
                            "linear-gradient(90deg, transparent 0%, var(--bmw-accent) 50%, transparent 100%)",
                          boxShadow: "0 0 26px var(--bmw-accent-glow)",
                        }
                      : undefined
                  }
                  className={`mt-2.5 h-2 w-[88%] rounded-full transition-opacity duration-200 blur-[3px] ${
                    isSelected
                      ? "opacity-100"
                      : "opacity-15 bg-gradient-to-r from-transparent via-teal-300/30 to-transparent"
                  }`}
                />
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Collapsible Minimal Quick Controls Strip (Hidden by default so the 6-card monitor stays pristine like the Photo) */}
        {quickControlsOpen && (
          <div className="relative z-20 mx-auto mb-2 px-3 py-2 rounded-xl bg-[#041012]/95 border border-teal-200/20 shadow-2xl flex flex-wrap items-center justify-center gap-2">
            <button
              id="btn-quick-lock"
              type="button"
              onClick={() => {
                const nextLock = !carState.doorsLocked;
                carAudio.playLockBeep(nextLock);
                onUpdateCarState({ doorsLocked: nextLock });
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                carState.doorsLocked
                  ? "bg-white/[0.04] border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/70 border-rose-500/60 text-rose-200"
              }`}
            >
              {carState.doorsLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{carState.doorsLocked ? "قفل" : "باز"}</span>
            </button>

            <button
              id="btn-quick-hazard"
              type="button"
              onClick={() => {
                const nextState = !carState.hazardActive;
                carAudio.playHazardTick(nextState);
                onUpdateCarState({ hazardActive: nextState });
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                carState.hazardActive
                  ? "bg-[#e85d04] text-white border-orange-300"
                  : "bg-white/[0.04] border-white/15 text-slate-200"
              }`}
            >
              <TriangleAlert className="w-3.5 h-3.5" />
              <span>جفت‌راهنما</span>
            </button>

            <button
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                onUpdateCarState({ headlightsActive: !carState.headlightsActive });
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                carState.headlightsActive
                  ? "bg-amber-500/20 border-amber-400 text-amber-200"
                  : "bg-white/[0.04] border-white/15 text-slate-200"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>چراغ</span>
            </button>

            <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-lg px-2 py-1">
              <button
                id="btn-quick-ac"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ acActive: !carState.acActive });
                }}
                className={`px-1.5 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${
                  carState.acActive ? "text-amber-300" : "text-slate-400"
                }`}
              >
                <Fan className={`w-3.5 h-3.5 ${carState.acActive ? "animate-spin" : ""}`} />
                <span>تهویه</span>
              </button>
              <button
                id="btn-ac-temp-minus"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ acTemp: Math.max(16, (carState.acTemp || 22) - 1), acActive: true });
                }}
                className="w-6 h-6 rounded bg-white/[0.07] text-white flex items-center justify-center"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono text-xs font-black text-amber-300 px-1 tabular-nums">
                {carState.acTemp || 22}°
              </span>
              <button
                id="btn-ac-temp-plus"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ acTemp: Math.min(30, (carState.acTemp || 22) + 1), acActive: true });
                }}
                className="w-6 h-6 rounded bg-white/[0.07] text-white flex items-center justify-center"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {onOpen3DShowroom && (
              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onOpen3DShowroom();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-xs font-bold text-teal-200 flex items-center gap-1 transition"
              >
                <Box className="w-3.5 h-3.5 text-[#ff731d]" />
                <span>نمای ۳D</span>
              </button>
            )}
          </div>
        )}

        {/* Centered Instrument Cluster: Enlarged GPS Speedometer + RPM Tachometer + Analog Clock */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-3 pt-2 border-t border-teal-200/10">
          {/* Side A: Monitor GPS Sync Trigger + Tabular Vehicle Vitals */}
          <div className="order-2 lg:order-1 flex flex-wrap items-center justify-center lg:justify-start gap-2.5 font-mono tabular-nums text-xs text-slate-300" dir="ltr">
            <button
              id="dashboard-gps-sync-btn"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                onRequestGpsFix?.();
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${
                gpsConnected
                  ? "border-emerald-400/50 bg-emerald-950/55 text-emerald-300 hover:bg-emerald-900/55"
                  : "border-amber-400/45 bg-amber-950/45 text-amber-200 hover:bg-amber-900/50"
              }`}
              title="همگام‌سازی مستقیم سرعت‌سنج و دور موتور با GPS مانیتور"
            >
              <span>{gpsConnected ? "GPS مانیتور متصل" : "اتصال به GPS مانیتور"}</span>
            </button>
            <span className="text-[#ff731d] font-bold">{carState.gear || "D"}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-teal-300">FUEL {carState.fuelPercent}%</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-300">{carState.engineTemp}°C</span>
          </div>

          {/* CENTER: All Three Enlarged & High-Contrast Circular BMW Dials (Speedometer, RPM, Clock) */}
          <div
            id="dashboard-center-instrument-cluster"
            className="order-1 lg:order-2 flex items-center justify-center gap-4 sm:gap-7 lg:gap-9 mx-auto"
          >
            {/* 1. Enlarged GPS-Synced Analog Speedometer (0-260 KM/H) */}
            {(() => {
              const speedVal = Math.max(0, Math.min(260, carState.speed || 0));
              const speedAngle = -135 + (speedVal / 260) * 270;
              const speedMarks = [0, 60, 130, 200, 260];
              return (
                <div
                  id="cluster-speedometer"
                  className="flex flex-col items-center gap-1 select-none"
                  title="سرعت‌سنج متصل به GPS مانیتور خودرو"
                >
                  <div
                    className="w-20 h-20 sm:w-24 sm:h-24 lg:w-[104px] lg:h-[104px] rounded-full relative shrink-0 shadow-[0_0_24px_rgba(0,0,0,0.9)]"
                    style={{
                      background:
                        "radial-gradient(circle at 35% 30%, #172a2e 0%, #071114 68%, #020506 100%)",
                      border: "2px solid rgba(204,251,241,0.34)",
                    }}
                  >
                    <svg viewBox="0 0 120 120" className="w-full h-full">
                      <circle cx="60" cy="60" r="56" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.4" />
                      <path
                        d="M 22 92 A 48 48 0 1 1 98 92"
                        fill="none"
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                      />
                      {Array.from({ length: 13 }).map((_, idx) => {
                        const deg = -135 + (idx * 270) / 12;
                        const major = idx % 2 === 0;
                        return (
                          <line
                            key={idx}
                            x1="60"
                            y1={major ? 10 : 12}
                            x2="60"
                            y2={major ? 20 : 17}
                            stroke={major ? "#ffffff" : "rgba(148,163,184,0.55)"}
                            strokeWidth={major ? "2.4" : "1.1"}
                            strokeLinecap="round"
                            transform={`rotate(${deg} 60 60)`}
                          />
                        );
                      })}
                      {speedMarks.map((val) => {
                        const rad = ((-135 + (val / 260) * 270 - 90) * Math.PI) / 180;
                        const tx = 60 + 34 * Math.cos(rad);
                        const ty = 60 + 34 * Math.sin(rad) + 2.8;
                        return (
                          <text
                            key={val}
                            x={tx}
                            y={ty}
                            textAnchor="middle"
                            fill="#cbd5e1"
                            fontSize="7.5"
                            fontWeight="700"
                            fontFamily="monospace"
                          >
                            {val}
                          </text>
                        );
                      })}
                      <text
                        x="60"
                        y="85"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="20"
                        fontWeight="900"
                        fontFamily="monospace"
                      >
                        {Math.round(speedVal)}
                      </text>
                      <text
                        x="60"
                        y="97"
                        textAnchor="middle"
                        fill="rgba(148,163,184,0.9)"
                        fontSize="8"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        KM/H
                      </text>
                      <g transform={`rotate(${speedAngle} 60 60)`}>
                        <line
                          x1="60"
                          y1="68"
                          x2="60"
                          y2="19"
                          stroke="var(--bmw-accent, #ff731d)"
                          strokeWidth="3.6"
                          strokeLinecap="round"
                        />
                      </g>
                      <circle cx="60" cy="60" r="5.2" fill="#0f172a" stroke="#ffffff" strokeWidth="1.6" />
                      <circle cx="60" cy="60" r="2.2" fill="var(--bmw-accent, #ff731d)" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                    <span>سرعت</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className={`font-mono text-[10px] ${gpsConnected ? "text-emerald-400" : "text-amber-300"}`}>
                      GPS
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 2. Enlarged Analog Tachometer / RPM (0-7 x1000) */}
            {(() => {
              const rpmVal = Math.max(0, Math.min(7000, carState.rpm || 0));
              const rpmAngle = -135 + (rpmVal / 7000) * 270;
              return (
                <div
                  id="cluster-tachometer"
                  className="flex flex-col items-center gap-1 select-none"
                  title="دور موتور خودرو (RPM)"
                >
                  <div
                    className="w-20 h-20 sm:w-24 sm:h-24 lg:w-[104px] lg:h-[104px] rounded-full relative shrink-0 shadow-[0_0_24px_rgba(0,0,0,0.9)]"
                    style={{
                      background:
                        "radial-gradient(circle at 35% 30%, #172a2e 0%, #071114 68%, #020506 100%)",
                      border: "2px solid rgba(204,251,241,0.34)",
                    }}
                  >
                    <svg viewBox="0 0 120 120" className="w-full h-full">
                      <circle cx="60" cy="60" r="56" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.4" />
                      <path
                        d="M 22 92 A 48 48 0 1 1 98 92"
                        fill="none"
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                      />
                      {/* Redline zone 6k-7k */}
                      <path
                        d="M 103 42 A 48 48 0 0 1 98 92"
                        fill="none"
                        stroke="#ef4444"
                        strokeOpacity="0.88"
                        strokeWidth="4.8"
                        strokeLinecap="round"
                      />
                      {Array.from({ length: 15 }).map((_, idx) => {
                        const deg = -135 + (idx * 270) / 14;
                        const major = idx % 2 === 0;
                        const isRed = idx >= 12;
                        return (
                          <line
                            key={idx}
                            x1="60"
                            y1={major ? 10 : 12}
                            x2="60"
                            y2={major ? 20 : 17}
                            stroke={isRed ? "#f87171" : major ? "#ffffff" : "rgba(148,163,184,0.55)"}
                            strokeWidth={major ? "2.4" : "1.1"}
                            strokeLinecap="round"
                            transform={`rotate(${deg} 60 60)`}
                          />
                        );
                      })}
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
                        const rad = ((-135 + (n / 7) * 270 - 90) * Math.PI) / 180;
                        const tx = 60 + 34 * Math.cos(rad);
                        const ty = 60 + 34 * Math.sin(rad) + 3;
                        return (
                          <text
                            key={n}
                            x={tx}
                            y={ty}
                            textAnchor="middle"
                            fill={n >= 6 ? "#fca5a5" : "#cbd5e1"}
                            fontSize="8.5"
                            fontWeight="800"
                            fontFamily="monospace"
                          >
                            {n}
                          </text>
                        );
                      })}
                      <text
                        x="60"
                        y="85"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="17"
                        fontWeight="900"
                        fontFamily="monospace"
                      >
                        {(rpmVal / 1000).toFixed(1)}
                      </text>
                      <text
                        x="60"
                        y="97"
                        textAnchor="middle"
                        fill="rgba(148,163,184,0.9)"
                        fontSize="7.5"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        x1000
                      </text>
                      <g transform={`rotate(${rpmAngle} 60 60)`}>
                        <line
                          x1="60"
                          y1="68"
                          x2="60"
                          y2="19"
                          stroke="#ff731d"
                          strokeWidth="3.6"
                          strokeLinecap="round"
                        />
                      </g>
                      <circle cx="60" cy="60" r="5.2" fill="#0f172a" stroke="#ffffff" strokeWidth="1.6" />
                      <circle cx="60" cy="60" r="2.2" fill="#ff731d" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-slate-200">دور موتور</span>
                </div>
              );
            })()}

            {/* 3. Enlarged Analog-Only BMW Clock */}
            <div id="cluster-analog-clock" className="flex flex-col items-center gap-1 select-none" title="ساعت عقربه‌ای">
              <AnalogClock variant="cluster" showDate={false} />
              <span className="text-[11px] font-bold text-slate-200">ساعت</span>
            </div>
          </div>

          {/* Side B: Minimal Music Resume + Expandable Quick Controls */}
          <div className="order-3 flex items-center justify-center lg:justify-end gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/55 border border-teal-200/15">
              <button
                id="btn-quick-music-flash"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onTogglePlayPause ? onTogglePlayPause() : onPlayFlash();
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-teal-100 hover:text-white transition"
              >
                {carState.musicPlaying ? (
                  <Pause className="w-3.5 h-3.5 text-[#ff731d]" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-[#ff731d] fill-current" />
                )}
                <span className="truncate max-w-[110px]">{currentTrack?.title || "فلش USB"}</span>
              </button>
              {onNextTrack && (
                <button
                  id="btn-quick-next"
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onNextTrack();
                  }}
                  className="p-0.5 text-slate-400 hover:text-white"
                  title="آهنگ بعدی"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setQuickControlsOpen((prev) => !prev);
              }}
              className="px-3 py-1.5 rounded-xl bg-black/55 hover:bg-teal-950/60 border border-teal-200/15 text-xs font-semibold text-teal-100/90 flex items-center gap-1 transition whitespace-nowrap"
            >
              <span>کنترل سریع</span>
              {quickControlsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </section>

      {/* Brushed Metallic Lower Monitor Bezel Rim */}
      <div
        aria-hidden="true"
        className="h-[4px] w-full bg-gradient-to-r from-[#090d0f] via-[#4a5559] to-[#090d0f] opacity-80 shrink-0"
      />
    </div>
  );
}
