import React, { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { CarState } from "../types";
import { carAudio } from "../utils/carSpeech";

interface EcoDrivingScoreProps {
  carState: CarState;
  onUpdateCarState: (update: Partial<CarState>) => void;
}

export default function EcoDrivingScore({
  carState,
  onUpdateCarState,
}: EcoDrivingScoreProps) {
  const [smoothedScore, setSmoothedScore] = useState<number>(84);
  const [avgFuelL100, setAvgFuelL100] = useState<number>(8.6);
  const [throttlePct, setThrottlePct] = useState<number>(22);
  const [engineLoadPct, setEngineLoadPct] = useState<number>(31);

  const prevSpeedRef = useRef<number>(carState.speed);
  const throttleSpikeRef = useRef<number>(0);

  // Detect abrupt throttle/speed transitions
  useEffect(() => {
    const delta = Math.abs(carState.speed - prevSpeedRef.current);
    if (delta > 0) {
      throttleSpikeRef.current = Math.min(35, throttleSpikeRef.current + delta * 0.9);
    }
    prevSpeedRef.current = carState.speed;
  }, [carState.speed]);

  const liveRef = useRef(carState);
  liveRef.current = carState;

  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = liveRef.current;

      // Decay throttle spike over time
      throttleSpikeRef.current *= 0.78;

      const rpmNorm = Math.min(1, Math.max(0, (s.rpm - 750) / 5600));
      const speedNorm = Math.min(1, Math.max(0, s.speed / 220));
      const modeMultiplier =
        s.driveMode === "eco" ? 0.84 : s.driveMode === "sport" ? 1.24 : 1.0;

      // Instantaneous Throttle Input %
      const nextThrottle = Math.max(
        8,
        Math.min(
          98,
          Math.round((12 + rpmNorm * 48 + speedNorm * 16 + throttleSpikeRef.current) * modeMultiplier)
        )
      );

      // Engine Load % (incorporating RPM, speed aero drag, and AC compressor)
      const acLoad = s.acActive ? 6 : 0;
      const nextLoad = Math.max(
        10,
        Math.min(
          99,
          Math.round(14 + rpmNorm * 44 + speedNorm * speedNorm * 26 + acLoad + throttleSpikeRef.current * 0.4)
        )
      );

      // Instant Fuel Consumption (L/100km) for BMW 728Li M52TUB28
      let instantFuel: number;
      if (s.speed <= 2) {
        instantFuel = 9.4 + (s.acActive ? 0.7 : 0);
      } else {
        const optimalCruisePenalty = Math.abs(s.speed - 82) * 0.045;
        instantFuel =
          (6.8 + optimalCruisePenalty + rpmNorm * 6.2 + (throttleSpikeRef.current * 0.14)) *
          modeMultiplier +
          (s.acActive ? 0.45 : 0);
      }
      instantFuel = Math.max(5.8, Math.min(19.5, instantFuel));

      // Compute target Eco-Driving Score (0..100%)
      const fuelScore = Math.max(0, 100 - Math.max(0, instantFuel - 6.5) * 7.2);
      const throttleScore = Math.max(0, 100 - Math.max(0, nextThrottle - 18) * 1.15);
      const loadScore = Math.max(0, 100 - Math.max(0, nextLoad - 25) * 1.1);
      const modeAdjustment = s.driveMode === "eco" ? 6 : s.driveMode === "sport" ? -8 : 0;

      const targetScore = Math.max(
        12,
        Math.min(100, fuelScore * 0.42 + throttleScore * 0.32 + loadScore * 0.26 + modeAdjustment)
      );

      setThrottlePct(nextThrottle);
      setEngineLoadPct(nextLoad);
      setAvgFuelL100((prev) => Number((prev + (instantFuel - prev) * 0.25).toFixed(1)));
      setSmoothedScore((prev) => Math.round(prev + (targetScore - prev) * 0.3));
    }, 600);

    return () => window.clearInterval(timer);
  }, []);

  // SVG Radial Gauge geometry (220 deg sweep)
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const arcSpan = circumference * (220 / 360);
  const progressSpan = arcSpan * (smoothedScore / 100);

  const scoreColor =
    smoothedScore >= 80
      ? "#10b981"
      : smoothedScore >= 55
        ? "#f59e0b"
        : "#f43f5e";

  const scoreTextClass =
    smoothedScore >= 80
      ? "text-emerald-400"
      : smoothedScore >= 55
        ? "text-amber-400"
        : "text-rose-400";

  const ecoGradeLabel =
    smoothedScore >= 80
      ? "رانندگی کاملاً بهینه (Eco)"
      : smoothedScore >= 55
        ? "مصرف متعادل"
        : "شتاب و بار موتور بالا";

  const ecoTip =
    carState.speed > 125
      ? "سرعت بالا مقاومت هوا و مصرف سوخت را افزایش می‌دهد."
      : throttlePct > 55
        ? "فشار یکنواخت‌تر روی پدال گاز امتیاز راندمان را بالا می‌برد."
        : carState.driveMode !== "eco"
          ? "فعال‌سازی حالت Eco Pro بهینه‌سازی مصرف سوخت را افزایش می‌دهد."
          : "عملکرد پدال گاز و دور موتور در محدوده بهینه قرار دارد.";

  return (
    <section
      id="eco-driving-score-card"
      aria-label="امتیاز رانندگی اقتصادی"
      className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3"
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
              امتیاز رانندگی اقتصادی (Eco-Driving Score)
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              تحلیل لحظه‌ای مصرف سوخت، ورودی گاز و بار موتور
            </p>
          </div>
        </div>

        {carState.driveMode !== "eco" ? (
          <button
            id="eco-score-enable-eco-btn"
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onUpdateCarState({ driveMode: "eco" });
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition active:scale-95 whitespace-nowrap"
          >
            فعال‌سازی Eco Pro
          </button>
        ) : (
          <span className="text-emerald-400 text-[11px] font-mono font-bold tracking-wide">
            Eco Pro · فعال
          </span>
        )}
      </div>

      {/* Main Layout: Radial Efficiency Gauge + Telemetry Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Visual Radial Gauge */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center instrument-well rounded-2xl p-3">
          <div className="relative w-36 h-32 flex items-center justify-center">
            <svg viewBox="0 0 140 130" className="w-full h-full">
              {/* Background Track */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#18202c"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${arcSpan} ${circumference}`}
                transform="rotate(160 70 70)"
              />
              {/* Active Efficiency Arc */}
              <circle
                id="eco-score-gauge-arc"
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${progressSpan} ${circumference}`}
                transform="rotate(160 70 70)"
                style={{
                  filter: `drop-shadow(0 0 6px ${scoreColor}66)`,
                  transition: "stroke-dasharray 300ms ease-out, stroke 300ms ease",
                }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pt-3 pointer-events-none">
              <span
                id="eco-score-percent-value"
                className={`text-2xl sm:text-3xl font-black font-mono tabular-nums leading-none ${scoreTextClass}`}
                dir="ltr"
              >
                {smoothedScore}%
              </span>
              <span className="text-[10px] text-slate-400 mt-1">راندمان لحظه‌ای</span>
            </div>
          </div>

          <span className={`text-[11px] font-bold mt-0.5 ${scoreTextClass}`}>
            {ecoGradeLabel}
          </span>
        </div>

        {/* 3 Efficiency Factor Cells + Coaching Tip */}
        <div className="sm:col-span-7 flex flex-col gap-2.5">
          <div className="instrument-well rounded-2xl grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.07]">
            <div className="p-2.5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">میانگین مصرف</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="eco-avg-fuel-value" className="text-sm sm:text-base font-black text-white">
                  {avgFuelL100.toFixed(1)}
                </span>
                <span className="text-[9px] text-slate-400">L/100</span>
              </div>
              <span className="text-[9px] text-emerald-400">بنزین شهری/جاده</span>
            </div>

            <div className="p-2.5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">ورودی گاز</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="eco-throttle-value" className="text-sm sm:text-base font-black text-sky-300">
                  {throttlePct}%
                </span>
              </div>
              <span className="text-[9px] text-slate-500">
                {throttlePct <= 35 ? "پدال نرم" : throttlePct <= 60 ? "متوسط" : "شتاب بالا"}
              </span>
            </div>

            <div className="p-2.5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">بار موتور</span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
                <span id="eco-engine-load-value" className="text-sm sm:text-base font-black text-amber-300">
                  {engineLoadPct}%
                </span>
              </div>
              <span className="text-[9px] text-slate-500">
                {engineLoadPct <= 45 ? "سبک" : engineLoadPct <= 70 ? "متعادل" : "تحت فشار"}
              </span>
            </div>
          </div>

          <div className="instrument-well rounded-xl px-3 py-2 text-[11px] text-slate-300">
            <span className="text-emerald-400 font-bold ml-1">توصیه راندمان:</span>
            <span>{ecoTip}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
