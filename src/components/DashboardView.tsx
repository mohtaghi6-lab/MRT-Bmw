import React from "react";
import {
  TriangleAlert,
  Lock,
  Unlock,
  Fan,
  Disc3,
  Compass,
  Cpu,
  ShieldCheck,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  CircleGauge,
  CheckCircle2,
  ChevronRight,
  Plus,
  Minus,
  Mic,
  Route,
  RotateCcw,
  Droplets,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { CarState, MusicTrack, NavigationRoute, EngineTelemetryPoint } from "../types";
import { carAudio } from "../utils/carSpeech";
import BmwVisualShowcase from "./BmwVisualShowcase";
import GForceMeter from "./GForceMeter";
import EcoDrivingScore from "./EcoDrivingScore";
import DailyScheduleWidget from "./DailyScheduleWidget";
import AnalogClock from "./AnalogClock";

interface DashboardViewProps {
  carState: CarState;
  onUpdateCarState: (update: Partial<CarState>) => void;
  currentTrack: MusicTrack;
  onPlayFlash: () => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  onTogglePlayPause?: () => void;
  activeRoute?: NavigationRoute | null;
  onOpenNavTab?: () => void;
  onOpenControlsTab?: () => void;
  onOpenMediaTab?: () => void;
  onOpenSpecsModal?: () => void;
  onOpenDiagnosticsModal?: () => void;
  onOpenVoiceAssistant?: () => void;
  onOpen3DShowroom?: () => void;
  isSpeaking?: boolean;
  tripDistanceKm: number;
  tripElapsedSeconds: number;
  onResetTrip: () => void;
  oilMileageKm: number;
  oilEngineHours: number;
  oilLastResetDate: string;
  onResetOilLife: () => void;
  engineTelemetryHistory: EngineTelemetryPoint[];
  onNavigateToMeetingLocation?: (location: string, meetingTitle: string) => void;
}

function formatTripDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export default function DashboardView({
  carState,
  onUpdateCarState,
  currentTrack,
  onPlayFlash,
  onPrevTrack,
  onNextTrack,
  onTogglePlayPause,
  activeRoute,
  onOpenNavTab,
  onOpenVoiceAssistant,
  onOpen3DShowroom,
  isSpeaking,
  tripDistanceKm,
  tripElapsedSeconds,
  onResetTrip,
  oilMileageKm,
  oilEngineHours,
  oilLastResetDate,
  onResetOilLife,
  engineTelemetryHistory,
  onNavigateToMeetingLocation,
}: DashboardViewProps) {
  const [oilResetNotice, setOilResetNotice] = React.useState(false);

  const averageSpeedKmh =
    tripElapsedSeconds > 0 ? tripDistanceKm / (tripElapsedSeconds / 3600) : 0;

  // BMW LL-01 Oil Service Interval: 10,000 km or 350 engine hours
  const MAX_OIL_INTERVAL_KM = 10000;
  const MAX_OIL_INTERVAL_HOURS = 350;
  const mileageUsedRatio = Math.min(1, Math.max(0, oilMileageKm / MAX_OIL_INTERVAL_KM));
  const hoursUsedRatio = Math.min(1, Math.max(0, oilEngineHours / MAX_OIL_INTERVAL_HOURS));
  const combinedOilWear = Math.min(
    1,
    Math.max(mileageUsedRatio, hoursUsedRatio) * 0.7 +
      ((mileageUsedRatio + hoursUsedRatio) / 2) * 0.3
  );
  const oilLifePercent = Math.max(0, Math.min(100, Math.round((1 - combinedOilWear) * 100)));
  const remainingKmToService = Math.max(0, Math.round(MAX_OIL_INTERVAL_KM - oilMileageKm));
  const remainingHoursToService = Math.max(0, Math.round(MAX_OIL_INTERVAL_HOURS - oilEngineHours));

  const oilStatusColor =
    oilLifePercent >= 50
      ? "text-emerald-400"
      : oilLifePercent >= 20
        ? "text-amber-400"
        : "text-rose-400";

  const oilBarColor =
    oilLifePercent >= 50
      ? "bg-emerald-400"
      : oilLifePercent >= 20
        ? "bg-amber-400"
        : "bg-rose-500";

  const oilStatusLabel =
    oilLifePercent >= 50
      ? "وضعیت مطلوب (BMW LL-01)"
      : oilLifePercent >= 20
        ? "نزدیک به زمان سرویس دوره‌ای"
        : "نیاز فوری به تعویض روغن";

  const triggerOilReset = () => {
    onResetOilLife();
    setOilResetNotice(true);
    window.setTimeout(() => setOilResetNotice(false), 3000);
  };

  return (
    <div
      id="dash-tab-content"
      className="flex-1 p-3 sm:p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-4 select-none"
      dir="rtl"
    >
      {/* Primary Column: BMW Live Cockpit, Chassis Cluster & Core Telemetry (6 Cols) */}
      <div className="md:col-span-6 flex flex-col gap-4">
        <BmwVisualShowcase
          carState={carState}
          onUpdateCarState={onUpdateCarState}
          currentTrack={currentTrack}
          onOpen3DShowroom={onOpen3DShowroom}
        />

        {/* Quick Automotive Tactile Hardware Switches */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Hazard Blinker Switch */}
          <button
            id="btn-quick-hazard"
            onClick={() => {
              const nextState = !carState.hazardActive;
              carAudio.playHazardTick(nextState);
              onUpdateCarState({ hazardActive: nextState });
            }}
            className={`relative overflow-hidden p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition active:scale-95 ${
              carState.hazardActive
                ? "bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.35)]"
                : "hardware-key text-slate-200"
            }`}
          >
            <div
              className={`absolute top-0 left-5 right-5 h-[2px] rounded-full ${
                carState.hazardActive ? "bg-slate-950/60" : "bg-amber-400/50"
              }`}
            />
            <TriangleAlert className={`w-5 h-5 ${carState.hazardActive ? "fill-current" : "text-amber-400"}`} />
            <span className="text-xs font-bold">جفت‌راهنما</span>
            <span className={`text-[10px] font-mono ${carState.hazardActive ? "text-slate-900 font-bold" : "text-slate-400"}`}>
              {carState.hazardActive ? "روشن" : "خاموش"}
            </span>
          </button>

          {/* Central Door Lock Switch */}
          <button
            id="btn-quick-lock"
            onClick={() => {
              const nextLock = !carState.doorsLocked;
              carAudio.playLockBeep(nextLock);
              onUpdateCarState({ doorsLocked: nextLock });
            }}
            className={`relative overflow-hidden p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition active:scale-95 ${
              carState.doorsLocked
                ? "hardware-key border-emerald-500/35 text-emerald-300"
                : "bg-rose-950/70 border-rose-500/50 text-rose-200"
            }`}
          >
            <div
              className={`absolute top-0 left-5 right-5 h-[2px] rounded-full ${
                carState.doorsLocked ? "bg-emerald-400/70" : "bg-rose-400"
              }`}
            />
            {carState.doorsLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            <span className="text-xs font-bold">قفل مرکزی</span>
            <span className="text-[10px] font-mono text-slate-400">
              {carState.doorsLocked ? "ایمن (قفل)" : "باز"}
            </span>
          </button>

          {/* AC Climate Control Switch */}
          <button
            id="btn-quick-ac"
            onClick={() => {
              carAudio.playButtonTap();
              onUpdateCarState({ acActive: !carState.acActive });
            }}
            className={`relative overflow-hidden p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition active:scale-95 ${
              carState.acActive
                ? "bmw-accent-btn bmw-accent-border"
                : "hardware-key text-slate-300"
            }`}
          >
            <div
              className={`absolute top-0 left-5 right-5 h-[2px] rounded-full ${
                carState.acActive ? "bg-white/60" : "bg-white/10"
              }`}
            />
            <Fan className={`w-5 h-5 ${carState.acActive ? "animate-spin" : ""}`} />
            <span className="text-xs font-bold">تهویه مطبوع</span>
            <span className={`text-[10px] font-mono tabular-nums ${carState.acActive ? "text-white/90" : "text-slate-400"}`}>
              {carState.acActive ? `${carState.acTemp}°C` : "خاموش"}
            </span>
          </button>

          {/* USB Flash Music Switch */}
          <button
            id="btn-quick-music-flash"
            onClick={() => {
              carAudio.playButtonTap();
              onPlayFlash();
            }}
            className="relative overflow-hidden p-3 rounded-2xl hardware-key text-slate-200 flex flex-col items-center justify-center gap-1.5 transition active:scale-95"
          >
            <div
              className={`absolute top-0 left-5 right-5 h-[2px] rounded-full ${
                carState.musicPlaying ? "bmw-accent-fill" : "bg-white/10"
              }`}
            />
            <Disc3 className={`w-5 h-5 bmw-accent-text ${carState.musicPlaying ? "animate-spin" : ""}`} />
            <span className="text-xs font-bold">پخش فلش</span>
            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">
              {currentTrack.title}
            </span>
          </button>
        </div>

        {/* BMW RDC / TPMS 4-Tire Visual Warning System */}
        {(() => {
          const tires = [
            { key: "fr" as const, label: "جلو راست", psi: carState.tpms?.fr ?? 32 },
            { key: "fl" as const, label: "جلو چپ", psi: carState.tpms?.fl ?? 32 },
            { key: "rr" as const, label: "عقب راست", psi: carState.tpms?.rr ?? 33 },
            { key: "rl" as const, label: "عقب چپ", psi: carState.tpms?.rl ?? 32 },
          ];
          const lowTires = tires.filter((t) => t.psi < 28);
          const hasLowPressure = lowTires.length > 0;

          const adjustTirePsi = (key: "fl" | "fr" | "rl" | "rr", nextVal: number) => {
            carAudio.playButtonTap();
            const clamped = Math.max(15, Math.min(45, nextVal));
            onUpdateCarState({
              tpms: {
                ...carState.tpms,
                [key]: clamped,
              },
            });
          };

          return (
            <section
              id="tpms-monitor-card"
              aria-label="پایش فشار باد تایرها"
              className={`rounded-3xl p-4 border flex flex-col gap-3 transition-colors ${
                hasLowPressure
                  ? "bg-red-950/45 border-red-500/80 shadow-[0_0_28px_rgba(239,68,68,0.22)]"
                  : "cockpit-panel"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                      hasLowPressure
                        ? "bg-red-500/20 border-red-500/60 text-red-400"
                        : "bmw-accent-surface"
                    }`}
                  >
                    <CircleGauge className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    سنسور فشار باد تایرها (BMW RDC / TPMS)
                  </span>
                </div>

                {hasLowPressure ? (
                  <div
                    id="tpms-global-warning"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/25 border border-red-500 text-red-300 text-[11px] font-bold"
                  >
                    <TriangleAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>هشدار افت باد ({lowTires.length} تایر) · Inflate Tire</span>
                  </div>
                ) : (
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    تمام تایرها نرمال (≥ 28 PSI)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tires.map((tire) => {
                  const isLow = tire.psi < 28;
                  return (
                    <div
                      key={tire.key}
                      id={`tpms-tire-${tire.key}`}
                      className={`rounded-2xl p-2.5 border flex flex-col justify-between gap-1.5 transition-colors ${
                        isLow
                          ? "bg-red-950/75 border-red-500 text-red-100"
                          : "instrument-well text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-slate-300">
                          {tire.label}
                        </span>
                        {isLow && (
                          <TriangleAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                      </div>

                      <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                        <span
                          className={`text-base font-black ${
                            isLow ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {tire.psi}
                        </span>
                        <span className="text-[10px] text-slate-400">PSI</span>
                      </div>

                      {isLow ? (
                        <button
                          type="button"
                          onClick={() => adjustTirePsi(tire.key, 32)}
                          className="w-full py-1 px-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold text-center transition active:scale-95"
                          title="بازگرداندن فشار باد به ۳۲ PSI"
                        >
                          Inflate Tire · تنظیم باد
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <span className="text-[10px] text-emerald-400 font-mono">OK</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustTirePsi(tire.key, tire.psi - 2)}
                              className="w-5 h-5 rounded bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-300 text-[10px] flex items-center justify-center"
                              title="کاهش فشار آزمایشی"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustTirePsi(tire.key, tire.psi + 1)}
                              className="w-5 h-5 rounded bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-300 text-[10px] flex items-center justify-center"
                              title="افزایش فشار"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* BMW On-Board Trip Meter (Distance Traveled & Average Speed Since Engine Start) */}
        <section
          id="trip-meter-card"
          aria-label="مسافت‌سنج سفر"
          className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
                <Route className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                  مسافت‌سنج سفر (Trip Meter)
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  از لحظه استارت موتور · <span className="font-mono">Since Engine Start</span>
                </p>
              </div>
            </div>

            <button
              id="trip-meter-reset-btn"
              type="button"
              onClick={onResetTrip}
              className="min-h-[40px] px-4 py-2 rounded-xl hardware-key text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
              title="ریست مسافت‌سنج و میانگین سرعت سفر"
            >
              <RotateCcw className="w-3.5 h-3.5 bmw-accent-text" />
              <span>ریست</span>
            </button>
          </div>

          <div className="instrument-well rounded-2xl grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.07]">
            <div className="p-3 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">مسافت پیموده‌شده</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="trip-distance-value" className="text-base sm:text-lg font-black text-white">
                  {tripDistanceKm.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">km</span>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">میانگین سرعت</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="trip-avg-speed-value" className="text-base sm:text-lg font-black bmw-accent-text">
                  {averageSpeedKmh.toFixed(1)}
                </span>
                <span className="text-[11px] text-slate-400">km/h</span>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">مدت زمان سفر</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="trip-elapsed-value" className="text-base sm:text-lg font-black text-emerald-400">
                  {formatTripDuration(tripElapsedSeconds)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* BMW CBS Oil Life Monitoring Section */}
        <section
          id="oil-life-card"
          aria-label="پایش عمر روغن موتور"
          className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                  پایش عمر روغن موتور (Oil Life Monitoring)
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  سرویس دوره‌ای بر اساس کارکرد و ساعت موتور · آخرین سرویس: {oilLastResetDate}
                </p>
              </div>
            </div>

            <button
              id="oil-life-reset-btn"
              type="button"
              onClick={triggerOilReset}
              className="min-h-[40px] px-4 py-2 rounded-xl hardware-key text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
              title="ثبت تعویض روغن و بازنشانی عمر روغن به ۱۰۰٪"
            >
              <RotateCcw className="w-3.5 h-3.5 bmw-accent-text" />
              <span>ریست سرویس</span>
            </button>
          </div>

          {/* Remaining Oil Life Percentage & Progress Gauge */}
          <div className="instrument-well rounded-2xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-semibold">عمر باقیمانده روغن:</span>
                <span className={`text-[11px] font-medium ${oilStatusColor}`}>
                  {oilStatusLabel}
                </span>
              </div>
              <span
                id="oil-life-percent-value"
                className={`text-lg font-black font-mono tabular-nums ${oilStatusColor}`}
                dir="ltr"
              >
                {oilLifePercent}%
              </span>
            </div>

            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                id="oil-life-progress-bar"
                className={`h-full rounded-full transition-all duration-500 ${oilBarColor}`}
                style={{ width: `${oilLifePercent}%` }}
              />
            </div>

            {oilResetNotice && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium pt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>سرویس تعویض روغن ثبت و شمارنده به ۱۰۰٪ بازنشانی شد.</span>
              </div>
            )}
          </div>

          {/* Mileage & Engine Hours Breakdown */}
          <div className="instrument-well rounded-2xl grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.07]">
            <div className="p-2.5 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">کارکرد پس از تعویض</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="oil-mileage-value" className="text-sm sm:text-base font-black text-white">
                  {oilMileageKm.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-400">km</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
                Left: {remainingKmToService} km
              </span>
            </div>

            <div className="p-2.5 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">ساعت کارکرد موتور</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="oil-engine-hours-value" className="text-sm sm:text-base font-black bmw-accent-text">
                  {oilEngineHours.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-400">hrs</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
                Left: {remainingHoursToService} hrs
              </span>
            </div>

            <div className="p-2.5 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">نوع روغن مجاز</span>
              <span className="text-xs sm:text-sm font-black text-sky-300 font-mono" dir="ltr">
                5W-40 LL-01
              </span>
              <span className="text-[10px] text-slate-500">ظرفیت ۶.۵ لیتر</span>
            </div>
          </div>
        </section>

        {/* Real-Time G-Force Meter (Longitudinal & Lateral Cornering Monitor) */}
        <GForceMeter carState={carState} />
      </div>

      {/* Secondary Column: BMW Analog Chronometer, Intelligent Assistant, DME Telematics & Performance (6 Cols) */}
      <div className="md:col-span-6 flex flex-col gap-4">
        {/* BMW Individual Analog Chronometer & Cockpit Status Strip */}
        <section
          id="bmw-analog-chronometer-card"
          aria-label="ساعت عقربه‌ای ب‌ام‌و"
          className="cockpit-panel rounded-3xl p-4 flex flex-wrap items-center justify-between gap-4"
        >
          <AnalogClock variant="chronometer" showDate showDigitalSub />

          <div className="flex flex-col items-end gap-1.5 text-left">
            <span className="text-[11px] font-mono bmw-accent-text font-bold">
              BMW INDIVIDUAL CHRONOGRAPH
            </span>
            <span className="text-xs text-slate-300">
              {carState.isOnline
                ? "همگام‌سازی آنلاین و آفلاین فعال"
                : "حالت آفلاین مستقل خودرو فعال"}
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums" dir="ltr">
              EXT {carState.outsideTemp ?? 22}°C · BAT {carState.batteryVoltage}V
            </span>
          </div>
        </section>

        {/* BMW Intelligent Personal Assistant Hero Card */}
        {onOpenVoiceAssistant && (
          <div
            id="voice-assistant-hero-card"
            onClick={() => {
              carAudio.playBmwGong();
              onOpenVoiceAssistant();
            }}
            className="cockpit-panel-accent rounded-3xl p-4 flex items-center justify-between cursor-pointer group transition active:scale-[0.99] relative overflow-hidden"
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{ background: "linear-gradient(90deg, var(--bmw-accent-soft) 0%, transparent 70%)" }}
            />

            <div className="flex items-center gap-3.5 z-10">
              <div
                className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xl ${
                  isSpeaking
                    ? "bg-amber-500 text-slate-950 animate-pulse shadow-amber-500/40"
                    : "bmw-accent-btn"
                }`}
              >
                {isSpeaking ? (
                  <Volume2 className="w-7 h-7 animate-spin text-slate-950" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white">
                    دستیار صوتی هوشمند BMW 728Li
                  </h3>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="bmw-accent-text text-[11px] font-semibold">
                    پاسخ آنی و پیوسته
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  برای گفتگوی صوتی، مشاوره فنی ب‌ام‌و، شعر یا اجرای فرامین خودرو لمس کنید.
                </p>
              </div>
            </div>

            <div className="z-10 flex items-center gap-1.5 font-bold text-xs px-4 py-2 rounded-xl bmw-accent-btn shrink-0">
              <Mic className="w-3.5 h-3.5" />
              <span>گفتگو</span>
            </div>
          </div>
        )}

        {/* BMW DME Telemetry & Vehicle Diagnostics Card */}
        <div className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  پایش هوشمند DME بوش و سلامت فنی ب‌ام‌و
                </h3>
                <span className="text-[10px] bmw-accent-text font-mono">
                  BMW DME MS42 · ۲.۸ لیتری Double-VANOS · OBD-II فعال
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>DTC: بدون خطا (OK)</span>
            </div>
          </div>

          {/* Real-time BMW DME Sensor Telemetry Well */}
          <div className="instrument-well rounded-2xl grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.07] text-xs">
            <div className="p-3 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">دمای مانیفولد (IAT)</span>
              <span className="font-mono font-bold tabular-nums text-amber-300 text-sm">۲۶°C</span>
              <span className="text-[9px] text-emerald-400 font-mono">سنسور ورودی نرمال</span>
            </div>

            <div className="p-3 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">دریچه گاز (Valvetronic)</span>
              <span className="font-mono font-bold tabular-nums text-sky-300 text-sm">
                {carState.speed > 0 ? "۲۲%" : "۱۴% (درجا)"}
              </span>
              <span className="text-[9px] text-emerald-400 font-mono">پاسخ سریع پدال</span>
            </div>

            <div className="p-3 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">فشار روغن (Oil Bar)</span>
              <span className="font-mono font-bold tabular-nums text-emerald-400 text-sm" dir="ltr">
                {(carState.oilPressureBar ?? 3.8).toFixed(1)} Bar
              </span>
              <span className="text-[9px] text-emerald-400 font-mono">فشار بهینه روغن</span>
            </div>
          </div>

          {/* BMW 4-Zone Automatic Climate Control */}
          <div className="instrument-well p-3 rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
                <Fan className={`w-5 h-5 ${carState.acActive ? "animate-spin" : ""}`} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">تهویه مطبوع اتوماتیک BMW</span>
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  {carState.acActive
                    ? `سیستم ۴ کاناله فعال · فیلتر کربن · سطح فن ${carState.acFanSpeed || 2}`
                    : "سیستم تهویه خاموش"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-ac-temp-minus"
                onClick={() => {
                  carAudio.playButtonTap();
                  const nextTemp = Math.max(16, (carState.acTemp || 22) - 1);
                  onUpdateCarState({ acTemp: nextTemp, acActive: true });
                }}
                className="w-8 h-8 rounded-lg hardware-key text-white flex items-center justify-center active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="font-mono text-base font-black bmw-accent-text px-1 min-w-[3rem] text-center tabular-nums">
                {carState.acTemp || 22}°C
              </span>

              <button
                id="btn-ac-temp-plus"
                onClick={() => {
                  carAudio.playButtonTap();
                  const nextTemp = Math.min(30, (carState.acTemp || 22) + 1);
                  onUpdateCarState({ acTemp: nextTemp, acActive: true });
                }}
                className="w-8 h-8 rounded-lg hardware-key text-white flex items-center justify-center active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Real-Time Engine Health Trends (Oil Pressure & Engine Temperature Chart) */}
        <section
          id="engine-health-chart-card"
          aria-label="روند فشار روغن و دمای موتور"
          className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                  روند سلامت موتور در سفر جاری (DME Live Trends)
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  نمودار تاریخچه فشار روغن (Bar) و دمای موتور (°C)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums" dir="ltr">
              <span className="text-emerald-400 font-bold">
                Oil {(carState.oilPressureBar ?? 4.0).toFixed(1)} Bar
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400 font-bold">
                Temp {carState.engineTemp}°C
              </span>
            </div>
          </div>

          <div className="h-48 w-full instrument-well rounded-2xl p-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={engineTelemetryHistory}
                margin={{ top: 8, right: 10, left: -12, bottom: 2 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="temp"
                  domain={[65, 115]}
                  stroke="#f59e0b"
                  tick={{ fill: "#fbbf24", fontSize: 10 }}
                  tickLine={false}
                  unit="°"
                />
                <YAxis
                  yAxisId="pressure"
                  orientation="right"
                  domain={[1.0, 6.0]}
                  stroke="#10b981"
                  tick={{ fill: "#34d399", fontSize: 10 }}
                  tickLine={false}
                  unit="b"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#060910",
                    borderColor: "rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    color: "#f1f5f9",
                  }}
                  labelStyle={{ color: "#94a3b8", fontFamily: "monospace", marginBottom: "4px" }}
                  formatter={(value: number, name: string) => {
                    if (name === "oilPressureBar") return [`${Number(value).toFixed(2)} Bar`, "فشار روغن"];
                    if (name === "engineTemp") return [`${Number(value).toFixed(1)} °C`, "دمای موتور"];
                    return [value, name];
                  }}
                />
                <Line
                  yAxisId="pressure"
                  type="monotone"
                  dataKey="oilPressureBar"
                  name="oilPressureBar"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10b981" }}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="engineTemp"
                  name="engineTemp"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "#f59e0b" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Real-Time Eco-Driving Score Component */}
        <EcoDrivingScore carState={carState} onUpdateCarState={onUpdateCarState} />

        {/* Daily Schedule & Meeting Navigation Prompts */}
        <DailyScheduleWidget
          onNavigateToLocation={onNavigateToMeetingLocation}
          isOnline={carState.isOnline}
        />

        {/* Live GPS Route & Quick Navigation Card */}
        <div className="cockpit-panel rounded-3xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 bmw-accent-text" />
              <span className="text-xs font-bold text-white">ناوبری هوشمند BMW Navigation Professional</span>
            </div>
            {onOpenNavTab && (
              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  onOpenNavTab();
                }}
                className="text-[11px] bmw-accent-text hover:underline font-medium flex items-center gap-1"
              >
                <span>نمایش کامل نقشه</span>
                <ChevronRight className="w-3 h-3 rotate-180" />
              </button>
            )}
          </div>

          <div className="instrument-well p-3 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-slate-100 font-bold">
                <span>{activeRoute?.origin || "شیراز"}</span>
                <span className="bmw-accent-text">➔</span>
                <span>{activeRoute?.destination || "اصفهان"}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {activeRoute?.nextTurn || "در بزرگراه خلیج فارس به سمت آباده ادامه دهید."}
              </span>
            </div>

            <div className="flex flex-col items-end gap-0.5 font-mono tabular-nums bmw-accent-text">
              <span className="font-bold">{activeRoute?.distance || "۴۸۵ کیلومتر"}</span>
              <span className="text-[10px] text-slate-400">{activeRoute?.duration || "۵:۲۰ ساعت"}</span>
            </div>
          </div>
        </div>

        {/* Music Player Quick Control Strip */}
        <div className="cockpit-panel rounded-3xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl border bmw-accent-surface flex items-center justify-center shrink-0">
              <Disc3 className={`w-6 h-6 ${carState.musicPlaying ? "animate-spin" : ""}`} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                {currentTrack?.title || "آهنگ فلش مموری"}
              </span>
              <span className="text-[10px] text-slate-400 block truncate font-mono">
                {currentTrack?.artist || "BMW Professional Hi-Fi"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onPrevTrack && (
              <button
                id="btn-quick-prev"
                onClick={() => {
                  carAudio.playButtonTap();
                  onPrevTrack();
                }}
                className="p-2 rounded-xl hardware-key text-slate-300 hover:text-white active:scale-95"
                title="آهنگ قبلی"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}

            {onTogglePlayPause && (
              <button
                id="btn-quick-play-pause"
                onClick={() => {
                  carAudio.playButtonTap();
                  onTogglePlayPause();
                }}
                className="p-2.5 rounded-xl bmw-accent-btn font-bold hover:brightness-110 transition active:scale-95"
                title={carState.musicPlaying ? "توقف" : "پخش"}
              >
                {carState.musicPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
            )}

            {onNextTrack && (
              <button
                id="btn-quick-next"
                onClick={() => {
                  carAudio.playButtonTap();
                  onNextTrack();
                }}
                className="p-2 rounded-xl hardware-key text-slate-300 hover:text-white active:scale-95"
                title="آهنگ بعدی"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
