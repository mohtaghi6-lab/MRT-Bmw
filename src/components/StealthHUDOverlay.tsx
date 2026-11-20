import { useState, useEffect } from "react";
import {
  Gauge,
  Disc3,
  TriangleAlert,
  Lock,
  Unlock,
  Fan,
  Activity,
  Fuel,
  Sun,
  BatteryCharging,
} from "lucide-react";
import { CarState, MusicTrack } from "../types";
import { carAudio } from "../utils/carSpeech";

interface StealthHUDProps {
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  onExitStealth: () => void;
  currentTrack?: MusicTrack;
}

export default function StealthHUDOverlay({
  carState,
  onUpdateCarState,
  onExitStealth,
  currentTrack,
}: StealthHUDProps) {
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("fa-IR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="stealth-hud-screen"
      className="fixed inset-0 bg-slate-950 z-40 flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden"
      dir="rtl"
    >
      {/* Background Subtle Gradient & Glow */}
      <div className="absolute inset-0 bg-radial from-cyan-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Top Ambient Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-sky-400 font-bold">BMW Head-Up Display (HUD) • 728Li Night Drive</span>
          </div>

          <div className="text-xs text-slate-400 hidden sm:block">
            {dateStr}
          </div>
        </div>

        {/* Exit HUD to Full Screen */}
        <button
          id="btn-exit-hud"
          onClick={() => {
            carAudio.playButtonTap();
            onExitStealth();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 hover:bg-cyan-900/80 text-xs text-cyan-300 hover:text-white transition active:scale-95 shadow-lg"
          title="بازگشت به نمایش کامل داشبورد"
        >
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span className="font-bold">بازگشت به داشبورد کامل</span>
        </button>
      </div>

      {/* Centerpiece: Ultra-High Visibility Night HUD Speedometer */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center gap-4">
        <div className="text-2xl sm:text-3xl font-bold font-mono tracking-widest text-slate-400">
          {timeStr}
        </div>

        <div className="flex items-baseline justify-center gap-2 text-cyan-400">
          <span className="text-8xl sm:text-9xl font-black font-mono tracking-tighter drop-shadow-[0_0_35px_rgba(6,182,212,0.5)] text-white">
            {carState.speed}
          </span>
          <span className="text-xl sm:text-2xl font-mono text-cyan-400 font-bold self-end pb-3">
            KM/H
          </span>
        </div>

        {/* Gear, RPM & Engine Telemetry */}
        <div className="flex items-center gap-4 text-sm font-mono text-slate-300">
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">{carState.rpm}</span>
            <span className="text-xs text-slate-400">RPM</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800">
            <span className="text-cyan-400 font-bold">D4</span>
            <span className="text-xs text-slate-300">دنده اتومات</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800">
            <Sun className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-300">{carState.outsideTemp ?? 28}°C</span>
          </div>
        </div>

        {/* Quick HUD Touch Toggles */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => {
              const next = !carState.hazardActive;
              onUpdateCarState({ hazardActive: next });
              carAudio.playHazardTick(next);
            }}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition active:scale-95 ${
              carState.hazardActive
                ? "bg-rose-600/40 border-rose-500 text-rose-300 animate-pulse shadow-lg shadow-rose-600/30"
                : "bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <TriangleAlert className="w-4 h-4" />
            <span>جفت راهنما</span>
          </button>

          <button
            onClick={() => {
              const next = !carState.doorsLocked;
              onUpdateCarState({ doorsLocked: next });
              carAudio.playLockBeep(next);
            }}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition active:scale-95 ${
              carState.doorsLocked
                ? "bg-emerald-600/30 border-emerald-500 text-emerald-300"
                : "bg-amber-600/30 border-amber-500 text-amber-300"
            }`}
          >
            {carState.doorsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{carState.doorsLocked ? "درها قفل" : "درها باز"}</span>
          </button>

          <button
            onClick={() => {
              carAudio.playButtonTap();
              onUpdateCarState({ acActive: !carState.acActive });
            }}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition active:scale-95 ${
              carState.acActive
                ? "bg-cyan-600/30 border-cyan-500 text-cyan-300"
                : "bg-slate-900/90 border-slate-800 text-slate-500"
            }`}
          >
            <Fan className={`w-4 h-4 ${carState.acActive ? "animate-spin" : ""}`} />
            <span>{carState.acActive ? `کولر ${carState.acTemp}°C` : "کولر خاموش"}</span>
          </button>
        </div>
      </div>

      {/* Bottom Bar: Mini Status Indicators & Music Info */}
      <div className="relative z-10 flex items-center justify-between bg-slate-900/80 border border-slate-800 px-4 py-3 rounded-2xl">
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <Fuel className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">بنزین:</span>
            <span className="font-bold text-amber-400">%{carState.fuelPercent}</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">دمای آب:</span>
            <span className="font-bold text-emerald-400">{carState.engineTemp}°C</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <BatteryCharging className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">دینام:</span>
            <span className="font-bold text-cyan-400">{carState.batteryVoltage}V</span>
          </div>
        </div>

        {currentTrack && (
          <div className="flex items-center gap-2 text-xs text-cyan-300 max-w-[240px] truncate">
            <Disc3 className="w-4 h-4 shrink-0 animate-spin" />
            <span className="truncate">{currentTrack.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}
