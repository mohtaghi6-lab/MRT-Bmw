import { useState, useEffect } from "react";
import {
  TriangleAlert,
  Lock,
  Unlock,
  Fan,
  Thermometer,
  Zap,
  Sun,
  Shield,
  Lightbulb,
  Gauge,
  Activity,
  Wind,
  Power,
  RotateCw,
  Plus,
  Minus,
  Sparkles,
  Check,
  Palette,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { CarState, PreConditioningSchedule } from "../types";
import { carAudio } from "../utils/carSpeech";
import {
  AMBIENT_LIGHTING_THEMES,
  getAmbientTheme,
} from "../utils/ambientThemes";

interface CarControlsProps {
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  preConditionSchedule: PreConditioningSchedule;
  onUpdatePreConditionSchedule: (partial: Partial<PreConditioningSchedule>) => void;
  preConditionTriggeredAt?: string | null;
}

export default function CarControlsModule({
  carState,
  onUpdateCarState,
  preConditionSchedule,
  onUpdatePreConditionSchedule,
  preConditionTriggeredAt,
}: CarControlsProps) {
  const [hazardFlash, setHazardFlash] = useState(false);

  // Flasher tick effect when Hazard lights are active
  useEffect(() => {
    let interval: any;
    if (carState.hazardActive) {
      interval = setInterval(() => {
        setHazardFlash((prev) => {
          const next = !prev;
          carAudio.playHazardTick(next);
          return next;
        });
      }, 500);
    } else {
      setHazardFlash(false);
    }
    return () => clearInterval(interval);
  }, [carState.hazardActive]);

  // Toggle Hazard Lights
  const toggleHazard = () => {
    const newState = !carState.hazardActive;
    onUpdateCarState({ hazardActive: newState });
    if (newState) {
      carAudio.playHazardTick(true);
    }
  };

  // Toggle Door Locks
  const toggleDoors = () => {
    const newState = !carState.doorsLocked;
    onUpdateCarState({ doorsLocked: newState });
    carAudio.playLockBeep(newState);
  };

  // Adjust AC Temp
  const adjustTemp = (delta: number) => {
    carAudio.playButtonTap();
    const newTemp = Math.max(16, Math.min(30, (carState.acTemp || 22) + delta));
    onUpdateCarState({ acTemp: newTemp, acActive: true });
  };

  const activeAmbientTheme = getAmbientTheme(carState.ambientLightingColor);
  const ambientBrightness = carState.ambientLightingBrightness ?? 85;

  const getMinutesUntilTarget = (hhmm: string): number => {
    const [hStr, mStr] = hhmm.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const targetMins = h * 60 + m;
    let diff = targetMins - nowMins;
    if (diff <= 0) diff += 24 * 60;
    return diff;
  };

  const minsUntilPreCondition = getMinutesUntilTarget(preConditionSchedule.targetTime);
  const countdownHours = Math.floor(minsUntilPreCondition / 60);
  const countdownMins = minsUntilPreCondition % 60;

  const setInOneMinute = () => {
    carAudio.playButtonTap();
    const next = new Date(Date.now() + 60_000);
    const hh = String(next.getHours()).padStart(2, "0");
    const mm = String(next.getMinutes()).padStart(2, "0");
    onUpdatePreConditionSchedule({
      targetTime: `${hh}:${mm}`,
      enabled: true,
      lastTriggeredDate: undefined,
    });
  };

  return (
    <div
      id="car-controls-module"
      className="h-full flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3.5 select-none"
      dir="rtl"
    >
      {/* Top Critical Action Row (Large touch-friendly buttons for safe driving) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. Hazard Lights (جفت راهنما) */}
        <button
          id="hazard-light-btn"
          onClick={toggleHazard}
          className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition active:scale-95 shadow-md ${
            carState.hazardActive
              ? hazardFlash
                ? "bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/50"
                : "bg-amber-950/80 text-amber-400 border-amber-600"
              : "bg-slate-900/90 text-slate-400 border-slate-800 hover:border-amber-500/40 hover:text-slate-200"
          }`}
        >
          <TriangleAlert
            className={`w-8 h-8 ${
              carState.hazardActive ? "animate-bounce" : ""
            }`}
          />
          <div className="text-center">
            <span className="text-xs font-black block">جفت راهنما (فلاشر)</span>
            <span className="text-[10px] font-mono">
              {carState.hazardActive ? "روشن (فعال)" : "خاموش"}
            </span>
          </div>
        </button>

        {/* 2. Central Door Lock (قفل مرکزی درها) */}
        <button
          id="door-lock-btn"
          onClick={toggleDoors}
          className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition active:scale-95 shadow-md ${
            carState.doorsLocked
              ? "bg-rose-950/80 text-rose-400 border-rose-600 shadow-rose-500/20"
              : "bg-emerald-950/80 text-emerald-400 border-emerald-600 shadow-emerald-500/20"
          }`}
        >
          {carState.doorsLocked ? (
            <Lock className="w-8 h-8 text-rose-400" />
          ) : (
            <Unlock className="w-8 h-8 text-emerald-400" />
          )}
          <div className="text-center">
            <span className="text-xs font-black block">قفل مرکزی درها</span>
            <span className="text-[10px] font-mono">
              {carState.doorsLocked ? "تمام درها قفل" : "درها باز"}
            </span>
          </div>
        </button>

        {/* 3. Climate AC Toggle (سیستم تهویه و کولر) */}
        <button
          id="ac-toggle-btn"
          onClick={() => {
            carAudio.playButtonTap();
            onUpdateCarState({ acActive: !carState.acActive });
          }}
          className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition active:scale-95 shadow-md ${
            carState.acActive
              ? "bg-cyan-950/80 text-cyan-400 border-cyan-500 shadow-cyan-500/20"
              : "bg-slate-900/90 text-slate-400 border-slate-800 hover:border-cyan-500/40"
          }`}
        >
          <Fan
            className={`w-8 h-8 ${
              carState.acActive ? "animate-spin text-cyan-400" : ""
            }`}
          />
          <div className="text-center">
            <span className="text-xs font-black block">تهویه و کولر (AC)</span>
            <span className="text-[10px] font-mono">
              {carState.acActive ? `${carState.acTemp}°C (روشن)` : "خاموش"}
            </span>
          </div>
        </button>

        {/* 4. Headlights (چراغ‌های اصلی) */}
        <button
          id="headlights-btn"
          onClick={() => {
            carAudio.playButtonTap();
            onUpdateCarState({ headlightsActive: !carState.headlightsActive });
          }}
          className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition active:scale-95 shadow-md ${
            carState.headlightsActive
              ? "bg-yellow-950/80 text-yellow-400 border-yellow-500 shadow-yellow-500/20"
              : "bg-slate-900/90 text-slate-400 border-slate-800 hover:border-yellow-500/40"
          }`}
        >
          <Lightbulb
            className={`w-8 h-8 ${
              carState.headlightsActive ? "text-yellow-400" : ""
            }`}
          />
          <div className="text-center">
            <span className="text-xs font-black block">چراغ‌های خودرو</span>
            <span className="text-[10px] font-mono">
              {carState.headlightsActive ? "روشن (دید در شب)" : "خاموش"}
            </span>
          </div>
        </button>
      </div>

      {/* Secondary Controls & Vehicle CAN Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 flex-1">
        {/* Left/Center: Detailed Climate & Window Controls (7 Cols) */}
        <div className="md:col-span-7 cockpit-panel rounded-3xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200">
                تنظیم دمای کابین و هوای ورودی
              </h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
              {carState.acActive ? `${carState.acTemp} °C` : "خاموش"}
            </span>
          </div>

          {/* Temperature Stepper */}
          <div className="flex items-center justify-center gap-6 py-2">
            <button
              onClick={() => adjustTemp(-1)}
              className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-cyan-400 text-lg font-bold border border-slate-700 transition"
              title="کاهش دما"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="text-center">
              <span className="text-3xl font-black font-mono text-slate-100 block">
                {carState.acTemp}°
              </span>
              <span className="text-[11px] text-slate-400">
                {carState.acTemp < 21
                  ? "سرمایشی پرقدرت"
                  : carState.acTemp > 24
                  ? "گرمایشی مطلوب"
                  : "دمای معتدل و بهینه"}
              </span>
            </div>

            <button
              onClick={() => adjustTemp(1)}
              className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 flex items-center justify-center text-rose-400 text-lg font-bold border border-slate-700 transition"
              title="افزایش دما"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Fan Speed & Lighting Sub-toggles */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                carAudio.playButtonTap();
                onUpdateCarState({
                  highBeamActive: !carState.highBeamActive,
                  headlightsActive: true,
                });
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                carState.highBeamActive
                  ? "bg-blue-900/70 border-blue-500 text-blue-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              نور بالا
            </button>

            <button
              onClick={() => {
                carAudio.playButtonTap();
                onUpdateCarState({ fogLightsActive: !carState.fogLightsActive });
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                carState.fogLightsActive
                  ? "bg-amber-900/70 border-amber-500 text-amber-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              مه‌شکن
            </button>

            <button
              onClick={() => {
                carAudio.playButtonTap();
                onUpdateCarState({ sunroofOpen: !carState.sunroofOpen });
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                carState.sunroofOpen
                  ? "bg-cyan-900/70 border-cyan-500 text-cyan-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              سانروف ({carState.sunroofOpen ? "باز" : "بسته"})
            </button>
          </div>
        </div>

        {/* Right: TPMS 4-Tire & Vehicle Health (5 Cols) */}
        <div className="md:col-span-5 cockpit-panel rounded-3xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200">
                وضعیت باد تایرها (TPMS) و باتری
              </h3>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">وضعیت عالی</span>
          </div>

          {/* 4-Tire Layout */}
          <div className="grid grid-cols-2 gap-2.5 py-2">
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block">جلو راست</span>
              <span className="text-xs font-bold font-mono text-cyan-400">
                {carState.tpms.fr} PSI
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block">جلو چپ</span>
              <span className="text-xs font-bold font-mono text-cyan-400">
                {carState.tpms.fl} PSI
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block">عقب راست</span>
              <span className="text-xs font-bold font-mono text-cyan-400">
                {carState.tpms.rr} PSI
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block">عقب چپ</span>
              <span className="text-xs font-bold font-mono text-cyan-400">
                {carState.tpms.rl} PSI
              </span>
            </div>
          </div>

          {/* Key Metric Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 pt-2 border-t border-slate-800">
            <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">دمای محیط بیرون:</span>
              <span className="font-bold text-amber-400 font-mono text-xs">
                {carState.outsideTemp ?? 28}°C
              </span>
            </div>
            <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">دمای آب موتور:</span>
              <span className="font-bold text-emerald-400 font-mono text-xs">
                {carState.engineTemp}°C
              </span>
            </div>
            <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">دینام/باتری:</span>
              <span className="font-bold text-cyan-400 font-mono text-xs">
                {carState.batteryVoltage}V
              </span>
            </div>
            <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">دیاگ DME ب‌ام‌و 728Li:</span>
              <span className="font-bold text-emerald-400 font-mono text-[10px]">
                BMW D-CAN OK (بدون خطا)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BMW Ambient Lighting LED Color Theme Selector */}
      <section
        id="ambient-lighting-section"
        aria-label="نورپردازی محیطی کابین"
        className="cockpit-panel rounded-3xl p-4 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                نورپردازی محیطی کابین (Ambient Lighting)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activeAmbientTheme.labelFa} ·{" "}
                <span className="font-mono text-slate-300">{activeAmbientTheme.labelEn}</span> ·{" "}
                {activeAmbientTheme.descriptionFa}
              </p>
            </div>
          </div>

          {/* Ambient Intensity Control */}
          <div className="flex items-center gap-3 min-w-[200px]">
            <label
              htmlFor="ambient-brightness-slider"
              className="text-[11px] text-slate-400 whitespace-nowrap"
            >
              شدت نور LED:
            </label>
            <input
              id="ambient-brightness-slider"
              type="range"
              min={20}
              max={100}
              step={5}
              value={ambientBrightness}
              onChange={(e) =>
                onUpdateCarState({ ambientLightingBrightness: Number(e.target.value) })
              }
              style={{ accentColor: activeAmbientTheme.primaryHex }}
              className="w-28 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold tabular-nums bmw-accent-text min-w-[2.5rem] text-left">
              {ambientBrightness}%
            </span>
          </div>
        </div>

        {/* Live Illuminated Trim Strip Preview */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            پیش‌نمایش نوار LED داشبورد و درب‌ها
          </span>
          <div
            className="flex-1 h-1.5 rounded-full bmw-ambient-strip transition-opacity duration-200"
            style={{ opacity: Math.max(0.2, ambientBrightness / 100) }}
          />
          <span className="text-[11px] font-mono tabular-nums text-slate-300 whitespace-nowrap" dir="ltr">
            {activeAmbientTheme.primaryHex.toUpperCase()}
          </span>
        </div>

        {/* BMW LED Theme Swatch Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {AMBIENT_LIGHTING_THEMES.map((theme) => {
            const isSelected = activeAmbientTheme.id === theme.id;
            return (
              <button
                key={theme.id}
                id={`ambient-theme-${theme.id}`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdateCarState({ ambientLightingColor: theme.id });
                }}
                className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-right flex flex-col justify-between gap-2 transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isSelected
                    ? "bg-slate-950 text-white bmw-accent-border shadow-md"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span
                    className="h-2.5 flex-1 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${theme.primaryHex}, ${theme.secondaryHex})`,
                      boxShadow: isSelected ? `0 0 10px ${theme.glowHex}` : "none",
                    }}
                  />
                  {isSelected && (
                    <Check
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: theme.textHex }}
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div>
                  <span className="text-xs font-bold block leading-tight truncate">
                    {theme.labelFa}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                    {theme.labelEn}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pre-Conditioning Climate Scheduler */}
      <section
        id="preconditioning-scheduler-section"
        aria-label="زمان‌بندی پیش‌تهویه کابین"
        className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                زمان‌بندی پیش‌تهویه کابین (Pre-Conditioning Scheduler)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                روشن شدن خودکار کولر یا بخاری با دمای دلخواه پیش از رسیدن شما به خودرو
              </p>
            </div>
          </div>

          <button
            id="precondition-toggle-btn"
            type="button"
            aria-pressed={preConditionSchedule.enabled}
            onClick={() => {
              carAudio.playButtonTap();
              onUpdatePreConditionSchedule({
                enabled: !preConditionSchedule.enabled,
                lastTriggeredDate: undefined,
              });
            }}
            className={`min-h-[40px] px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition active:scale-95 ${
              preConditionSchedule.enabled
                ? "bmw-accent-btn bmw-accent-border shadow-md"
                : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{preConditionSchedule.enabled ? "زمان‌بند فعال" : "فعال‌سازی زمان‌بند"}</span>
          </button>
        </div>

        {preConditionTriggeredAt && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              پیش‌تهویه کابین در ساعت {preConditionTriggeredAt} با دمای{" "}
              <strong className="font-mono">{carState.acTemp}°C</strong> به‌صورت خودکار فعال شد.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Departure / Activation Time Picker */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="precondition-time-input" className="text-xs font-bold text-slate-200">
                ساعت شروع خودکار
              </label>
              <span className="text-[10px] font-mono text-slate-400">24H</span>
            </div>

            <input
              id="precondition-time-input"
              type="time"
              value={preConditionSchedule.targetTime}
              onChange={(e) => {
                if (!e.target.value) return;
                onUpdatePreConditionSchedule({
                  targetTime: e.target.value,
                  lastTriggeredDate: undefined,
                });
              }}
              dir="ltr"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 text-base font-mono font-bold text-white text-center outline-none"
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: "۰۷:۳۰", value: "07:30" },
                { label: "۰۸:۳۰", value: "08:30" },
                { label: "۱۸:۰۰", value: "18:00" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdatePreConditionSchedule({
                      targetTime: preset.value,
                      enabled: true,
                      lastTriggeredDate: undefined,
                    });
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition ${
                    preConditionSchedule.targetTime === preset.value
                      ? "bmw-accent-surface font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                id="precondition-1min-btn"
                type="button"
                onClick={setInOneMinute}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 transition"
              >
                ۱ دقیقه دیگر
              </button>
            </div>
          </div>

          {/* Target Cabin Temperature */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200">دمای هدف پیش‌تهویه</span>
              <span className="text-[10px] text-slate-400">
                {preConditionSchedule.targetTemp <= 20
                  ? "خنک‌سازی سریع"
                  : preConditionSchedule.targetTemp >= 25
                    ? "گرمایش کابین"
                    : "دمای استاندارد"}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4 py-1">
              <button
                id="precondition-temp-minus"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdatePreConditionSchedule({
                    targetTemp: Math.max(16, preConditionSchedule.targetTemp - 1),
                  });
                }}
                className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 flex items-center justify-center transition active:scale-95"
                title="کاهش دمای هدف"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span
                id="precondition-target-temp-value"
                className="text-2xl font-black font-mono tabular-nums bmw-accent-text min-w-[4rem] text-center"
                dir="ltr"
              >
                {preConditionSchedule.targetTemp}°C
              </span>

              <button
                id="precondition-temp-plus"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  onUpdatePreConditionSchedule({
                    targetTemp: Math.min(30, preConditionSchedule.targetTemp + 1),
                  });
                }}
                className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-400 flex items-center justify-center transition active:scale-95"
                title="افزایش دمای هدف"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <span className="text-[10px] text-slate-500 text-center">
              محدوده قابل تنظیم: ۱۶°C تا ۳۰°C
            </span>
          </div>

          {/* Schedule Status, Repeat Mode & Countdown */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200">وضعیت و تکرار برنامه</span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  preConditionSchedule.enabled
                    ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                {preConditionSchedule.enabled ? "آماده اجرا" : "متوقف"}
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              {preConditionSchedule.enabled ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-medium">
                    روشن شدن خودکار تا{" "}
                    <strong className="font-mono bmw-accent-text">
                      {countdownHours > 0 ? `${countdownHours} ساعت و ` : ""}
                      {countdownMins} دقیقه
                    </strong>{" "}
                    دیگر
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                    Scheduled: {preConditionSchedule.targetTime} @ {preConditionSchedule.targetTemp}°C
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-[11px]">
                  زمان‌بند غیرفعال است. برای شروع خودکار تهویه، دکمه فعال‌سازی را بزنید.
                </span>
              )}
            </div>

            <button
              id="precondition-repeat-btn"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                onUpdatePreConditionSchedule({ repeatDaily: !preConditionSchedule.repeatDaily });
              }}
              className={`w-full py-2 px-3 rounded-xl border text-[11px] font-semibold flex items-center justify-between transition ${
                preConditionSchedule.repeatDaily
                  ? "bmw-accent-surface"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
            >
              <span>تکرار روزانه در همین ساعت</span>
              <span className="font-mono font-bold">
                {preConditionSchedule.repeatDaily ? "روشن" : "یک‌بار"}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
