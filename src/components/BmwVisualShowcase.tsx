import React, { useState, useEffect } from "react";
import {
  Car,
  Eye,
  Gauge,
  Lightbulb,
  Lock,
  Unlock,
  Sun,
  TriangleAlert,
  Volume2,
  Wind,
  Zap,
  Box,
  Monitor,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CarState, MusicTrack } from "../types";
import { carAudio, calculateSpeedVolumeBoost } from "../utils/carSpeech";
import { getAmbientTheme } from "../utils/ambientThemes";
import bmw728LiGoldenImg from "../assets/images/bmw_728li_golden_hero_1795458659658.jpg";
import bmwE38MonitorCabinImg from "../assets/images/bmw_e38_monitor_cabin_1795458659342.jpg";
import exteriorImg from "../assets/images/bmw_728li_exterior_1794767084367.jpg";
import dashboardImg from "../assets/images/bmw_728li_dashboard_1794767085082.jpg";

interface BmwVisualShowcaseProps {
  carState: CarState;
  onUpdateCarState: (update: Partial<CarState>) => void;
  currentTrack: MusicTrack;
  onOpen3DShowroom?: () => void;
}

type VisualViewMode = "monitor" | "cockpit" | "exterior" | "interior";

interface ShowcaseSlide {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  alt: string;
}

const BMW_728LI_GALLERY: ShowcaseSlide[] = [
  {
    id: "e38-monitor",
    title: "نمای واقعی مانیتور و داشبورد BMW 728Li (E38)",
    subtitle: "تریم چوب گردو فابریک، چرم قهوه‌ای روشن کنیاک و نمایشگر لمسی عریض iDrive",
    src: bmwE38MonitorCabinImg,
    alt: "نمای داخلی داشبورد و مانیتور BMW 728Li مدل E38 با تریم چرم قهوه‌ای روشن",
  },
  {
    id: "e38-golden-exterior",
    title: "نمای بیرونی BMW 728Li Executive Sedan",
    subtitle: "بدنه مشکی متالیک، چراغ‌های Angel Eyes و رینگ‌های کلاسیک چندپره BMW",
    src: bmw728LiGoldenImg,
    alt: "نمای بیرونی BMW 728Li مدل E38 در نمایشگاه با نورپردازی گرم",
  },
  {
    id: "e38-classic-exterior",
    title: "رخ جلو و چراغ‌های Angel Eyes خودرو BMW 728Li",
    subtitle: "موتور ۶ سیلندر خطی ۲.۸ لیتری M52TUB28 · شاسی کشیده E38",
    src: exteriorImg,
    alt: "نمای جلو و رخ کلاسیک BMW 728Li مدل E38",
  },
  {
    id: "idrive-night",
    title: "حالت شبانه کاکپیت و مانیتور عریض BMW",
    subtitle: "نمایشگر پیمایش شبانه با نورپردازی محیطی کنیاک طلایی",
    src: dashboardImg,
    alt: "نمای شبانه داشبورد و مانیتور BMW",
  },
];

export default function BmwVisualShowcase({
  carState,
  onUpdateCarState,
  currentTrack,
  onOpen3DShowroom,
}: BmwVisualShowcaseProps) {
  const [viewMode, setViewMode] = useState<VisualViewMode>("monitor");
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [hazardBlink, setHazardBlink] = useState(false);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!carState.hazardActive) {
      setHazardBlink(false);
      return;
    }
    const timer = setInterval(() => {
      setHazardBlink((prev) => !prev);
    }, 450);
    return () => clearInterval(timer);
  }, [carState.hazardActive]);

  const isSport = carState.driveMode === "sport";
  const isEco = carState.driveMode === "eco";
  const ambientTheme = getAmbientTheme(carState.ambientLightingColor);

  const accentHex = ambientTheme.primaryHex;
  const accentGlow = ambientTheme.glowHex;

  // Gauge angle calculation: -125 deg (0) to +125 deg (max)
  const maxSpeed = carState.maxSpeed || 260;
  const speedRatio = Math.min(1, Math.max(0, carState.speed / maxSpeed));
  const speedAngle = -125 + speedRatio * 250;

  const maxRpm = 7000;
  const rpmRatio = Math.min(1, Math.max(0, carState.rpm / maxRpm));
  const rpmAngle = -125 + rpmRatio * 250;

  const arcLength = 2 * Math.PI * 66;
  const maxArcSpan = arcLength * (250 / 360);

  const boost = calculateSpeedVolumeBoost(carState.speed);

  const handleSpeedChange = (nextSpeed: number) => {
    const clamped = Math.max(0, Math.min(maxSpeed, nextSpeed));
    const computedRpm =
      clamped === 0 ? 780 : Math.min(6800, Math.round(900 + clamped * 22 + (isSport ? 450 : 0)));
    onUpdateCarState({ speed: clamped, rpm: computedRpm });
  };

  const activeSlide = BMW_728LI_GALLERY[activeSlideIndex] ?? BMW_728LI_GALLERY[0];

  return (
    <>
      <div
        id="speedometer-hud-card"
        className="cockpit-panel-accent rounded-3xl p-4 sm:p-5 flex flex-col gap-4 relative overflow-hidden"
      >
        {/* Subtle Ambient Top Halo */}
        <div
          aria-hidden="true"
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-32 rounded-full blur-3xl pointer-events-none opacity-35"
          style={{ background: accentHex }}
        />

        {/* Top Bar: Vehicle Identity & Segmented View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3 relative z-10">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm whitespace-nowrap">
            <span className="font-extrabold tracking-wide text-white font-mono">
              BMW 728Li
            </span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="font-mono text-amber-200/80">E38 Monitor</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="bmw-accent-text font-semibold">
              {isSport ? "Sport" : isEco ? "Eco Pro" : "Comfort"}
            </span>
          </div>

          {/* Interactive View Switcher */}
          <div
            className="flex items-center gap-1 p-1 instrument-well rounded-xl overflow-x-auto no-scrollbar"
            role="tablist"
            aria-label="نمای خودرو و داشبورد"
          >
            <button
              id="view-mode-monitor"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setViewMode("monitor");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === "monitor"
                  ? "bg-white/15 text-white shadow-inner"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5 bmw-accent-text" />
              <span>مانیتور ۷۲۸Li</span>
            </button>

            <button
              id="view-mode-cockpit"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setViewMode("cockpit");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === "cockpit"
                  ? "bg-white/15 text-white shadow-inner"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>عقربه و شماتیک</span>
            </button>

            <button
              id="view-mode-exterior"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setViewMode("exterior");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === "exterior"
                  ? "bg-white/15 text-white shadow-inner"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>ظاهر ماشین</span>
            </button>

            <button
              id="view-mode-interior"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setViewMode("interior");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === "interior"
                  ? "bg-white/15 text-white shadow-inner"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>نمای کابین E38</span>
            </button>

            {onOpen3DShowroom && (
              <button
                id="view-mode-3d-studio"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onOpen3DShowroom();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bmw-accent-btn transition-all whitespace-nowrap shrink-0 hover:brightness-110"
              >
                <Box className="w-3.5 h-3.5" />
                <span>نمای ۳D</span>
              </button>
            )}
          </div>
        </div>

        {/* Mode 0 (Default): Authentic BMW 728Li E38 Wide Monitor Appearance + Live Car Photos */}
        {viewMode === "monitor" && (
          <div className="flex flex-col gap-3.5 relative z-10">
            {/* OEM E38 Monitor Frame showcasing Real BMW 728Li Car & Cabin Monitor Photos */}
            <div className="rounded-2xl p-2 bg-gradient-to-b from-[#2b1b11] via-[#1b110a] to-[#120b06] border border-amber-200/25 shadow-[0_14px_34px_rgba(0,0,0,0.65)]">
              {/* Thin OEM Monitor Bezel Header */}
              <div className="flex items-center justify-between gap-2 px-2 pb-2 text-[11px]">
                <div className="flex items-center gap-2 text-amber-100/90 font-medium truncate">
                  <span className="font-mono font-bold text-amber-300">BMW 728Li · E38</span>
                  <span className="text-amber-200/40" aria-hidden="true">/</span>
                  <span className="truncate text-amber-100/80">{activeSlide.title}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    id="bmw-monitor-toggle-photo"
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      setActiveSlideIndex((prev) => (prev === 0 ? 1 : 0));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-amber-200/20 text-amber-100 text-[11px] font-semibold transition whitespace-nowrap"
                  >
                    {activeSlideIndex === 0 ? "نمایش عکس ماشین" : "نمایش عکس مانیتور"}
                  </button>

                  <button
                    id="bmw-monitor-fullscreen-photo"
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      setIsGalleryModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bmw-accent-btn text-[11px] font-bold flex items-center gap-1 transition hover:brightness-110 whitespace-nowrap"
                    title="بزرگ‌نمایی و مشاهده تمام عکس‌های BMW 728Li و مانیتور"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>عکس بزرگ</span>
                  </button>
                </div>
              </div>

              {/* Photo Viewport with Contrast Scrim & Live HUD Readout */}
              <div
                onClick={() => {
                  carAudio.playButtonTap();
                  setIsGalleryModalOpen(true);
                }}
                className="relative rounded-xl overflow-hidden aspect-video bg-[#0d0805] border border-amber-200/15 cursor-pointer group"
              >
                {!imgError[activeSlide.id] ? (
                  <img
                    src={activeSlide.src}
                    alt={activeSlide.alt}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError((prev) => ({ ...prev, [activeSlide.id]: true }))}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#3a2518] to-[#1a1009] text-amber-200 gap-2 p-4">
                    <Car className="w-12 h-12 text-amber-300" />
                    <span className="text-sm font-bold text-white">{activeSlide.title}</span>
                  </div>
                )}

                {/* Measured Scrim for 4.5:1 Contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/25 pointer-events-none" />

                {/* Top Overlay: Live BMW Digital Speed & RPM Telemetry */}
                <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/55 backdrop-blur-md border border-amber-200/20 font-mono tabular-nums" dir="ltr">
                    <span className="text-lg sm:text-xl font-black text-white">{carState.speed}</span>
                    <span className="text-[10px] text-amber-300">KM/H</span>
                    <span className="text-white/25">|</span>
                    <span className="text-xs font-bold text-amber-200">{carState.rpm} RPM</span>
                    <span className="text-white/25">|</span>
                    <span className="text-xs font-extrabold text-emerald-300">{carState.gear || "D"}</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/55 backdrop-blur-md border border-amber-200/20 text-[11px] text-amber-100">
                    <span>چراغ: {carState.headlightsActive ? "روشن" : "خاموش"}</span>
                    <span className="text-white/30">·</span>
                    <span>قفل: {carState.doorsLocked ? "فعال" : "باز"}</span>
                  </div>
                </div>

                {/* Bottom Overlay: Slide Caption + Quick Switcher Dots */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                      {activeSlide.title}
                    </h3>
                    <p className="text-[11px] text-amber-100/80 truncate mt-0.5">
                      {activeSlide.subtitle}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {BMW_728LI_GALLERY.map((slide, idx) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => {
                          carAudio.playButtonTap();
                          setActiveSlideIndex(idx);
                        }}
                        aria-label={slide.title}
                        className={`h-2 rounded-full transition-all ${
                          idx === activeSlideIndex
                            ? "w-6 bmw-accent-fill"
                            : "w-2 bg-white/40 hover:bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 4-Thumbnail Strip for Instant Car & Monitor View Switching */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {BMW_728LI_GALLERY.map((slide, idx) => {
                  const selected = idx === activeSlideIndex;
                  return (
                    <button
                      key={slide.id}
                      id={`bmw-thumb-${slide.id}`}
                      type="button"
                      onClick={() => {
                        carAudio.playButtonTap();
                        setActiveSlideIndex(idx);
                      }}
                      className={`relative rounded-lg overflow-hidden aspect-video border transition ${
                        selected
                          ? "border-amber-300 ring-1 ring-amber-300/60"
                          : "border-white/10 opacity-75 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={slide.src}
                        alt={slide.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 py-0.5 text-[9px] text-white font-semibold truncate text-right">
                        {idx === 0
                          ? "مانیتور E38"
                          : idx === 1
                            ? "خودرو ۷۲۸Li"
                            : idx === 2
                              ? "رخ جلو"
                              : "شبانه"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Vehicle Hardware Bar (Headlights, High Beam, Sunroof, Lock) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ headlightsActive: !carState.headlightsActive });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.headlightsActive
                    ? "bg-amber-500/25 border-amber-400 text-amber-200"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>چراغ: {carState.headlightsActive ? "روشن" : "خاموش"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({
                    highBeamActive: !carState.highBeamActive,
                    headlightsActive: true,
                  });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.highBeamActive
                    ? "bg-sky-500/25 border-sky-400 text-sky-200"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>نور بالا</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ sunroofOpen: !carState.sunroofOpen });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.sunroofOpen
                    ? "bg-sky-500/25 border-sky-400 text-sky-200"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>سانروف: {carState.sunroofOpen ? "باز" : "بسته"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextLock = !carState.doorsLocked;
                  carAudio.playLockBeep(nextLock);
                  onUpdateCarState({ doorsLocked: nextLock });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.doorsLocked
                    ? "bg-emerald-500/15 border-emerald-400/60 text-emerald-200"
                    : "bg-rose-500/20 border-rose-400/60 text-rose-200"
                }`}
              >
                {carState.doorsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{carState.doorsLocked ? "درها قفل" : "درها باز"}</span>
              </button>
            </div>

            {/* Interactive Gear, Drive Mode & Speed Throttle Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
              <div className="flex items-center gap-1 instrument-well rounded-xl p-1">
                {(["P", "R", "N", "D", "S"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      if (g === "P" || g === "N") {
                        onUpdateCarState({ gear: g, speed: 0, rpm: 780 });
                      } else if (g === "S") {
                        onUpdateCarState({ gear: "S", driveMode: "sport" });
                      } else {
                        onUpdateCarState({ gear: g });
                      }
                    }}
                    className={`w-8 h-7 rounded-lg text-xs font-mono font-bold transition-all ${
                      (carState.gear || "D") === g
                        ? "bmw-accent-btn"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
                <span className="text-[11px] text-amber-100/80 whitespace-nowrap">شبیه‌ساز سرعت:</span>
                <input
                  type="range"
                  min={0}
                  max={240}
                  step={2}
                  value={carState.speed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  style={{ accentColor: accentHex }}
                  className="w-full cursor-pointer"
                  aria-label="تنظیم سرعت آزمایشی"
                />
              </div>

              <div className="flex items-center gap-1 instrument-well rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdateCarState({ driveMode: "comfort" });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    carState.driveMode === "comfort"
                      ? "bg-amber-600 text-white shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Comfort
                </button>
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdateCarState({ driveMode: "sport" });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    carState.driveMode === "sport"
                      ? "bg-rose-600 text-white shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Sport
                </button>
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdateCarState({ driveMode: "eco" });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    carState.driveMode === "eco"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Eco Pro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mode 1: Interactive BMW Live Cockpit + Top-Down Car Schematic */}
        {viewMode === "cockpit" && (
          <div className="flex flex-col gap-4 relative z-10">
            {/* Live Twin Dials + Center Car Visual */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center py-1">
              {/* Speedometer Dial */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center">
                <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
                  <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.85)]">
                    <defs>
                      <radialGradient id="dialFaceSpeed" cx="50%" cy="42%" r="60%">
                        <stop offset="0%" stopColor="#141a26" />
                        <stop offset="70%" stopColor="#080b11" />
                        <stop offset="100%" stopColor="#04060a" />
                      </radialGradient>
                      <linearGradient id="bezelRingSpeed" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#475569" stopOpacity="0.65" />
                        <stop offset="50%" stopColor="#1e293b" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#64748b" stopOpacity="0.55" />
                      </linearGradient>
                    </defs>

                    <circle
                      cx="80"
                      cy="80"
                      r="76"
                      fill="url(#dialFaceSpeed)"
                      stroke="url(#bezelRingSpeed)"
                      strokeWidth="2.5"
                    />
                    <circle cx="80" cy="80" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                    <circle
                      cx="80"
                      cy="80"
                      r="66"
                      fill="none"
                      stroke="#161c28"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${maxArcSpan} ${arcLength}`}
                      transform="rotate(145 80 80)"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="66"
                      fill="none"
                      stroke={accentHex}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${maxArcSpan * speedRatio} ${arcLength}`}
                      transform="rotate(145 80 80)"
                      style={{
                        filter: `drop-shadow(0 0 8px ${accentGlow})`,
                        transition: "stroke-dasharray 200ms ease-out",
                      }}
                    />

                    {[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260].map((mark) => {
                      const ratio = mark / 260;
                      const deg = -215 + ratio * 250;
                      const rad = (deg * Math.PI) / 180;
                      const isMajor = mark % 40 === 0;
                      const x1 = 80 + Math.cos(rad) * (isMajor ? 51 : 54);
                      const y1 = 80 + Math.sin(rad) * (isMajor ? 51 : 54);
                      const x2 = 80 + Math.cos(rad) * 59;
                      const y2 = 80 + Math.sin(rad) * 59;
                      return (
                        <line
                          key={mark}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={mark <= carState.speed ? accentHex : "#475569"}
                          strokeWidth={isMajor ? "2" : "1"}
                          strokeLinecap="round"
                        />
                      );
                    })}

                    <g
                      transform={`rotate(${speedAngle} 80 80)`}
                      style={{ transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                      <line
                        x1="80"
                        y1="88"
                        x2="80"
                        y2="22"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="80" cy="80" r="7" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
                      <circle cx="80" cy="80" r="2.5" fill="#ef4444" />
                    </g>
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-9 pointer-events-none">
                    <span className="text-3xl font-black font-mono tabular-nums text-white leading-none tracking-tight">
                      {carState.speed}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 tracking-widest">KM/H</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-300 font-medium mt-1">سرعت‌سنج دیجیتال</span>
              </div>

              {/* Center Col: Live Top-Down Interactive BMW 728Li Silhouette */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center relative py-2">
                <div className="relative w-52 h-64 flex items-center justify-center">
                  <div
                    aria-hidden="true"
                    className="absolute w-28 h-48 rounded-full blur-2xl opacity-25 pointer-events-none"
                    style={{ background: accentHex }}
                  />

                  <div
                    className={`absolute top-12 -right-3 text-[10px] font-mono tabular-nums text-left ${
                      carState.tpms.fr < 28 ? "text-red-400 font-bold" : "text-emerald-400"
                    }`}
                  >
                    <div>{carState.tpms.fr} PSI</div>
                    <div className="text-[9px] text-slate-300">جلو راست</div>
                  </div>
                  <div
                    className={`absolute top-12 -left-3 text-[10px] font-mono tabular-nums text-right ${
                      carState.tpms.fl < 28 ? "text-red-400 font-bold" : "text-emerald-400"
                    }`}
                  >
                    <div>{carState.tpms.fl} PSI</div>
                    <div className="text-[9px] text-slate-300">جلو چپ</div>
                  </div>
                  <div
                    className={`absolute bottom-12 -right-3 text-[10px] font-mono tabular-nums text-left ${
                      carState.tpms.rr < 28 ? "text-red-400 font-bold" : "text-emerald-400"
                    }`}
                  >
                    <div>{carState.tpms.rr} PSI</div>
                    <div className="text-[9px] text-slate-300">عقب راست</div>
                  </div>
                  <div
                    className={`absolute bottom-12 -left-3 text-[10px] font-mono tabular-nums text-right ${
                      carState.tpms.rl < 28 ? "text-red-400 font-bold" : "text-emerald-400"
                    }`}
                  >
                    <div>{carState.tpms.rl} PSI</div>
                    <div className="text-[9px] text-slate-300">عقب چپ</div>
                  </div>

                  <svg viewBox="0 0 180 260" className="w-40 h-56 drop-shadow-[0_18px_28px_rgba(0,0,0,0.9)]">
                    <defs>
                      <linearGradient id="headlightCone" x1="0" y1="1" x2="0" y2="0">
                        <stop
                          offset="0%"
                          stopColor={carState.highBeamActive ? "#e0f2fe" : "#fef08a"}
                          stopOpacity={carState.headlightsActive ? "0.65" : "0"}
                        />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="carPaint" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#263244" />
                        <stop offset="50%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#030712" />
                      </linearGradient>
                    </defs>

                    {carState.headlightsActive && (
                      <g>
                        <polygon points="52,42 28,2 74,2" fill="url(#headlightCone)" />
                        <polygon points="128,42 106,2 152,2" fill="url(#headlightCone)" />
                      </g>
                    )}

                    <rect
                      x="33"
                      y="64"
                      width="10"
                      height="30"
                      rx="3"
                      fill={carState.tpms.fl < 28 ? "#7f1d1d" : "#111827"}
                      stroke={carState.tpms.fl < 28 ? "#ef4444" : "#475569"}
                      strokeWidth={carState.tpms.fl < 28 ? "2" : "1"}
                    />
                    <rect
                      x="137"
                      y="64"
                      width="10"
                      height="30"
                      rx="3"
                      fill={carState.tpms.fr < 28 ? "#7f1d1d" : "#111827"}
                      stroke={carState.tpms.fr < 28 ? "#ef4444" : "#475569"}
                      strokeWidth={carState.tpms.fr < 28 ? "2" : "1"}
                    />
                    <rect
                      x="33"
                      y="168"
                      width="10"
                      height="30"
                      rx="3"
                      fill={carState.tpms.rl < 28 ? "#7f1d1d" : "#111827"}
                      stroke={carState.tpms.rl < 28 ? "#ef4444" : "#475569"}
                      strokeWidth={carState.tpms.rl < 28 ? "2" : "1"}
                    />
                    <rect
                      x="137"
                      y="168"
                      width="10"
                      height="30"
                      rx="3"
                      fill={carState.tpms.rr < 28 ? "#7f1d1d" : "#111827"}
                      stroke={carState.tpms.rr < 28 ? "#ef4444" : "#475569"}
                      strokeWidth={carState.tpms.rr < 28 ? "2" : "1"}
                    />

                    <path d="M 38 92 L 26 96 L 28 103 L 39 101 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <path d="M 142 92 L 154 96 L 152 103 L 141 101 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" />

                    <path
                      d="M 52 40 C 70 34, 110 34, 128 40 C 138 45, 142 62, 142 84 L 142 195 C 142 214, 136 226, 124 229 C 106 233, 74 233, 56 229 C 44 226, 38 214, 38 195 L 38 84 C 38 62, 42 45, 52 40 Z"
                      fill="url(#carPaint)"
                      stroke={carState.doorsLocked ? "#475569" : "#f43f5e"}
                      strokeWidth="2"
                    />

                    <rect x="78" y="36" width="10" height="3" rx="1" fill="#cbd5e1" />
                    <rect x="92" y="36" width="10" height="3" rx="1" fill="#cbd5e1" />

                    <line x1="65" y1="45" x2="60" y2="85" stroke="#475569" strokeWidth="1" opacity="0.7" />
                    <line x1="115" y1="45" x2="120" y2="85" stroke="#475569" strokeWidth="1" opacity="0.7" />

                    <path
                      d="M 52 88 C 70 82, 110 82, 128 88 L 122 114 C 105 110, 75 110, 58 114 Z"
                      fill="#0c4a6e"
                      fillOpacity="0.48"
                      stroke="#38bdf8"
                      strokeOpacity="0.45"
                      strokeWidth="1"
                    />

                    <rect x="57" y="116" width="66" height="62" rx="8" fill="#0b1120" stroke="#334155" strokeWidth="1" />
                    <rect
                      x="65"
                      y="122"
                      width="50"
                      height="26"
                      rx="4"
                      fill={carState.sunroofOpen ? "#0284c7" : "#1e293b"}
                      fillOpacity={carState.sunroofOpen ? "0.48" : "0.9"}
                      stroke={carState.sunroofOpen ? "#38bdf8" : "#475569"}
                      strokeWidth="1.2"
                      className="cursor-pointer"
                      onClick={() => {
                        carAudio.playButtonTap();
                        onUpdateCarState({ sunroofOpen: !carState.sunroofOpen });
                      }}
                    />

                    <path
                      d="M 58 180 C 75 184, 105 184, 122 180 L 127 204 C 108 209, 72 209, 53 204 Z"
                      fill="#0c4a6e"
                      fillOpacity="0.4"
                      stroke="#38bdf8"
                      strokeOpacity="0.3"
                      strokeWidth="1"
                    />

                    <g
                      className="cursor-pointer"
                      onClick={() => {
                        carAudio.playButtonTap();
                        onUpdateCarState({ headlightsActive: !carState.headlightsActive });
                      }}
                    >
                      <ellipse cx="54" cy="43" rx="8" ry="3.5" fill={carState.headlightsActive ? "#fef08a" : "#334155"} />
                      <ellipse cx="126" cy="43" rx="8" ry="3.5" fill={carState.headlightsActive ? "#fef08a" : "#334155"} />
                    </g>

                    {carState.fogLightsActive && (
                      <g>
                        <circle cx="58" cy="38" r="2.5" fill="#fbbf24" />
                        <circle cx="122" cy="38" r="2.5" fill="#fbbf24" />
                      </g>
                    )}

                    <rect
                      x="46"
                      y="224"
                      width="20"
                      height="4"
                      rx="2"
                      fill={carState.headlightsActive || carState.speed === 0 ? "#ef4444" : "#7f1d1d"}
                    />
                    <rect
                      x="114"
                      y="224"
                      width="20"
                      height="4"
                      rx="2"
                      fill={carState.headlightsActive || carState.speed === 0 ? "#ef4444" : "#7f1d1d"}
                    />

                    {(hazardBlink || carState.leftSignal) && (
                      <>
                        <circle cx="43" cy="48" r="4" fill="#f59e0b" />
                        <circle cx="43" cy="222" r="4" fill="#f59e0b" />
                      </>
                    )}
                    {(hazardBlink || carState.rightSignal) && (
                      <>
                        <circle cx="137" cy="48" r="4" fill="#f59e0b" />
                        <circle cx="137" cy="222" r="4" fill="#f59e0b" />
                      </>
                    )}
                  </svg>
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      onUpdateCarState({ headlightsActive: !carState.headlightsActive });
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition ${
                      carState.headlightsActive
                        ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                        : "hardware-key text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    چراغ: {carState.headlightsActive ? "روشن" : "خاموش"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      onUpdateCarState({ sunroofOpen: !carState.sunroofOpen });
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition ${
                      carState.sunroofOpen
                        ? "bg-sky-500/20 border-sky-500/60 text-sky-300"
                        : "hardware-key text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    سانروف: {carState.sunroofOpen ? "باز" : "بسته"}
                  </button>
                </div>
              </div>

              {/* Tachometer RPM Dial */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center">
                <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
                  <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.85)]">
                    <defs>
                      <radialGradient id="dialFaceRpm" cx="50%" cy="42%" r="60%">
                        <stop offset="0%" stopColor="#141a26" />
                        <stop offset="70%" stopColor="#080b11" />
                        <stop offset="100%" stopColor="#04060a" />
                      </radialGradient>
                      <linearGradient id="bezelRingRpm" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#475569" stopOpacity="0.65" />
                        <stop offset="50%" stopColor="#1e293b" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#64748b" stopOpacity="0.55" />
                      </linearGradient>
                    </defs>

                    <circle
                      cx="80"
                      cy="80"
                      r="76"
                      fill="url(#dialFaceRpm)"
                      stroke="url(#bezelRingRpm)"
                      strokeWidth="2.5"
                    />
                    <circle cx="80" cy="80" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                    <circle
                      cx="80"
                      cy="80"
                      r="66"
                      fill="none"
                      stroke="#161c28"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${maxArcSpan} ${arcLength}`}
                      transform="rotate(145 80 80)"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="66"
                      fill="none"
                      stroke={carState.rpm > 5500 ? "#ef4444" : accentHex}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${maxArcSpan * rpmRatio} ${arcLength}`}
                      transform="rotate(145 80 80)"
                      style={{
                        filter: `drop-shadow(0 0 8px ${accentGlow})`,
                        transition: "stroke-dasharray 200ms ease-out",
                      }}
                    />
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                      const ratio = k / 7;
                      const deg = -215 + ratio * 250;
                      const rad = (deg * Math.PI) / 180;
                      const x1 = 80 + Math.cos(rad) * 51;
                      const y1 = 80 + Math.sin(rad) * 51;
                      const x2 = 80 + Math.cos(rad) * 59;
                      const y2 = 80 + Math.sin(rad) * 59;
                      return (
                        <line
                          key={k}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={k >= 6 ? "#ef4444" : "#64748b"}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <g
                      transform={`rotate(${rpmAngle} 80 80)`}
                      style={{ transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                      <line
                        x1="80"
                        y1="88"
                        x2="80"
                        y2="22"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="80" cy="80" r="7" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
                      <circle cx="80" cy="80" r="2.5" fill="#ef4444" />
                    </g>
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-9 pointer-events-none">
                    <span className="text-2xl font-black font-mono tabular-nums text-white leading-none">
                      {carState.rpm}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 tracking-wider">RPM · x1000</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-300 font-medium mt-1">دور موتور (۶ سیلندر خطی)</span>
              </div>
            </div>

            {/* Interactive Gear, Drive Mode & Speed Throttle Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
              <div className="flex items-center gap-1 instrument-well rounded-xl p-1">
                {(["P", "R", "N", "D", "S"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      if (g === "P" || g === "N") {
                        onUpdateCarState({ gear: g, speed: 0, rpm: 780 });
                      } else if (g === "S") {
                        onUpdateCarState({ gear: "S", driveMode: "sport" });
                      } else {
                        onUpdateCarState({ gear: g });
                      }
                    }}
                    className={`w-8 h-7 rounded-lg text-xs font-mono font-bold transition-all ${
                      (carState.gear || "D") === g
                        ? "bmw-accent-btn"
                        : "text-slate-500 hover:text-slate-100"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs">
                <span className="text-[11px] text-slate-300 whitespace-nowrap">شبیه‌ساز سرعت:</span>
                <input
                  type="range"
                  min={0}
                  max={240}
                  step={2}
                  value={carState.speed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  style={{ accentColor: accentHex }}
                  className="w-full cursor-pointer"
                  aria-label="تنظیم سرعت آزمایشی"
                />
              </div>

              <div className="flex items-center gap-1 instrument-well rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdateCarState({ driveMode: "comfort" });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    carState.driveMode === "comfort"
                      ? "bg-amber-600 text-white shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Comfort
                </button>
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdateCarState({ driveMode: "sport" });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    carState.driveMode === "sport"
                      ? "bg-rose-600 text-white shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Sport
                </button>
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdateCarState({ driveMode: "eco" });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    carState.driveMode === "eco"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Eco Pro
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 bmw-accent-text" />
                <span>تقویت صدای سرعت:</span>
                <span className="bmw-accent-text font-bold tabular-nums">
                  {Math.round(boost.gainMultiplier * 100)}%
                </span>
              </div>
              <span className="text-emerald-400">EfficientDynamics +1.2 kW</span>
            </div>
          </div>
        )}

        {/* Mode 2: Real BMW 728Li Exterior Appearance */}
        {viewMode === "exterior" && (
          <div className="flex flex-col gap-3 relative z-10">
            <div
              onClick={() => {
                setActiveSlideIndex(1);
                setIsGalleryModalOpen(true);
              }}
              className="relative rounded-2xl overflow-hidden border border-white/15 aspect-video bg-black shadow-2xl cursor-pointer group"
            >
              {!imgError.exteriorGolden ? (
                <img
                  src={bmw728LiGoldenImg}
                  alt="نمای بیرونی BMW 728Li مدل E38"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError((prev) => ({ ...prev, exteriorGolden: true }))}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <img
                  src={exteriorImg}
                  alt="نمای بیرونی BMW 728Li مدل E38"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />

              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    ظاهر بیرونی BMW 728Li (نسل E38)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    رنگ متالیک مشکی یاقوتی · چراغ‌های Angel Eyes · موتور ۶ سیلندر ۲.۸ لیتری
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                  <span>چراغ: {carState.headlightsActive ? "روشن" : "خاموش"}</span>
                  <span>·</span>
                  <span>درها: {carState.doorsLocked ? "قفل" : "باز"}</span>
                  <span>·</span>
                  <span>بیرون: {carState.outsideTemp}°C</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ headlightsActive: !carState.headlightsActive });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.headlightsActive
                    ? "bg-amber-500/20 border-amber-500 text-amber-300"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>چراغ جلو</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({
                    highBeamActive: !carState.highBeamActive,
                    headlightsActive: true,
                  });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.highBeamActive
                    ? "bg-sky-500/20 border-sky-500 text-sky-300"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>نور بالا</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ fogLightsActive: !carState.fogLightsActive });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.fogLightsActive
                    ? "bg-amber-500/20 border-amber-500 text-amber-300"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>مه‌شکن</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextLock = !carState.doorsLocked;
                  carAudio.playLockBeep(nextLock);
                  onUpdateCarState({ doorsLocked: nextLock });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.doorsLocked
                    ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-300"
                    : "bg-rose-500/15 border-rose-500/60 text-rose-300"
                }`}
              >
                {carState.doorsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{carState.doorsLocked ? "درها قفل" : "درها باز"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Mode 3: Authentic BMW E38 728Li Interior Cabin & Android Monitor Appearance */}
        {viewMode === "interior" && (
          <div className="flex flex-col gap-3 relative z-10">
            <div
              onClick={() => {
                setActiveSlideIndex(0);
                setIsGalleryModalOpen(true);
              }}
              className="relative rounded-2xl overflow-hidden border border-white/15 aspect-video bg-black shadow-2xl cursor-pointer group"
            >
              {!imgError.e38Cabin ? (
                <img
                  src={bmwE38MonitorCabinImg}
                  alt="نمای داخلی داشبورد و مانیتور BMW 728Li E38"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError((prev) => ({ ...prev, e38Cabin: true }))}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <img
                  src={dashboardImg}
                  alt="نمای داخلی داشبورد و کابین BMW 728Li"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />

              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    ظاهر داشبورد و مانیتور فابریک BMW 728Li (E38)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 truncate max-w-md">
                    در حال پخش: {currentTrack.title} · دمای کابین {carState.acTemp}°C
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                  <span>سرعت: {carState.speed} km/h</span>
                  <span>·</span>
                  <span>دور موتور: {carState.rpm}</span>
                  <span>·</span>
                  <span>دنده: {carState.gear || "D"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ acActive: !carState.acActive });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.acActive
                    ? "bg-sky-500/20 border-sky-500 text-sky-300"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Wind className="w-4 h-4" />
                <span>کولر ({carState.acActive ? `${carState.acTemp}°C` : "خاموش"})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ sunroofOpen: !carState.sunroofOpen });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.sunroofOpen
                    ? "bg-sky-500/20 border-sky-500 text-sky-300"
                    : "hardware-key text-slate-300"
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>سانروف ({carState.sunroofOpen ? "باز" : "بسته"})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextHazard = !carState.hazardActive;
                  carAudio.playHazardTick(nextHazard);
                  onUpdateCarState({ hazardActive: nextHazard });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  carState.hazardActive
                    ? "bg-amber-500/20 border-amber-500 text-amber-300"
                    : "hardware-key text-slate-300"
                }`}
              >
                <TriangleAlert className="w-4 h-4" />
                <span>جفت راهنما</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Gauges Strip: Clean Single-Elevation Instrument Well with Hairline Dividers */}
        <div className="instrument-well rounded-2xl grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-white/[0.07] text-xs relative z-10">
          <div className="p-3 flex flex-col justify-between">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>بنزین</span>
              <span className="font-mono font-bold tabular-nums text-amber-300">
                {carState.fuelPercent}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${carState.fuelPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono tabular-nums mt-1">
              برد: {carState.rangeKm ?? 580} km
            </span>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-300">دمای محیط</span>
            <span className="font-mono font-bold tabular-nums text-amber-300 text-sm mt-1">
              {carState.outsideTemp ?? 24}°C
            </span>
            <span className="text-[10px] text-slate-400">سنسور بیرونی</span>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-300">دمای موتور</span>
            <span className="font-mono font-bold tabular-nums text-sky-300 text-sm mt-1">
              {carState.engineTemp ?? 90}°C
            </span>
            <span className="text-[10px] text-emerald-400">محدوده نرمال</span>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-300">ولتاژ دینام</span>
            <span className="font-mono font-bold tabular-nums text-emerald-400 text-sm mt-1">
              {carState.batteryVoltage}V
            </span>
            <span className="text-[10px] text-slate-400">شارژ پایدار</span>
          </div>
        </div>
      </div>

      {/* Fullscreen BMW 728Li Car & E38 Monitor Photo Gallery Lightbox */}
      {isGalleryModalOpen && (
        <div
          id="bmw-photo-gallery-modal"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6"
          dir="rtl"
          onClick={() => setIsGalleryModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl rounded-3xl cockpit-panel-accent p-4 sm:p-5 flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  {activeSlide.title}
                </h2>
                <p className="text-xs text-amber-100/80 mt-0.5">{activeSlide.subtitle}</p>
              </div>
              <button
                id="close-bmw-gallery-btn"
                type="button"
                onClick={() => setIsGalleryModalOpen(false)}
                className="p-2 rounded-xl hardware-key text-slate-200 hover:text-white"
                aria-label="بستن گالری"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden aspect-video bg-black border border-amber-200/20">
              <img
                src={activeSlide.src}
                alt={activeSlide.alt}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />

              <button
                type="button"
                onClick={() =>
                  setActiveSlideIndex(
                    (prev) => (prev - 1 + BMW_728LI_GALLERY.length) % BMW_728LI_GALLERY.length
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center transition"
                aria-label="عکس قبلی"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveSlideIndex((prev) => (prev + 1) % BMW_728LI_GALLERY.length)
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center transition"
                aria-label="عکس بعدی"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {BMW_728LI_GALLERY.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`rounded-xl overflow-hidden border text-right transition ${
                    idx === activeSlideIndex
                      ? "border-amber-300 ring-2 ring-amber-300/50"
                      : "border-white/10 opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="aspect-video bg-black">
                    <img
                      src={slide.src}
                      alt={slide.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 bg-black/50 text-[11px] font-semibold text-amber-50 truncate">
                    {slide.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
