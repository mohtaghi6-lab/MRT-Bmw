import React, { useEffect, useRef, useState } from "react";
import { Compass, RotateCcw, Smartphone } from "lucide-react";
import { CarState } from "../types";
import { carAudio } from "../utils/carSpeech";
import { getAmbientTheme } from "../utils/ambientThemes";

interface GForceMeterProps {
  carState: CarState;
}

interface GSample {
  x: number; // lateral G (+ right, - left)
  y: number; // longitudinal G (+ accel, - brake)
}

const MAX_G_SCALE = 1.2;
const GRAVITY = 9.80665;

export default function GForceMeter({ carState }: GForceMeterProps) {
  const [currentG, setCurrentG] = useState<GSample>({ x: 0, y: 0 });
  const [trail, setTrail] = useState<GSample[]>([]);
  const [peakLateralG, setPeakLateralG] = useState<number>(0);
  const [peakLongitudinalG, setPeakLongitudinalG] = useState<number>(0);
  const [peakTotalG, setPeakTotalG] = useState<number>(0);
  const [sensorSource, setSensorSource] = useState<"accelerometer" | "imu-telemetry">("imu-telemetry");
  const [cornerTestActive, setCornerTestActive] = useState<boolean>(false);
  const [needsPermission, setNeedsPermission] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return typeof (DeviceMotionEvent as any)?.requestPermission === "function";
  });

  const targetGRef = useRef<GSample>({ x: 0, y: 0 });
  const smoothGRef = useRef<GSample>({ x: 0, y: 0 });
  const lastHardwareEventRef = useRef<number>(0);
  const baselineRef = useRef<{ x: number; y: number } | null>(null);
  const prevSpeedRef = useRef<{ speed: number; time: number }>({
    speed: carState.speed,
    time: performance.now(),
  });
  const speedAccelDecayRef = useRef<number>(0);

  // React to real speed changes from Dashboard slider / 3D Showroom / Voice commands
  useEffect(() => {
    const now = performance.now();
    const dt = Math.max(0.05, (now - prevSpeedRef.current.time) / 1000);
    const dvMps = (carState.speed - prevSpeedRef.current.speed) / 3.6;
    if (Math.abs(dvMps) > 0.01) {
      const accelG = Math.max(-1.1, Math.min(1.1, dvMps / (dt * GRAVITY) * 0.35));
      speedAccelDecayRef.current = accelG;
    }
    prevSpeedRef.current = { speed: carState.speed, time: now };
  }, [carState.speed]);

  const attachDeviceMotion = () => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.acceleration;
      const accGrav = event.accelerationIncludingGravity;
      let ax = 0;
      let ay = 0;

      if (acc && acc.x !== null && acc.y !== null) {
        ax = acc.x / GRAVITY;
        ay = acc.y / GRAVITY;
      } else if (accGrav && accGrav.x !== null && accGrav.y !== null) {
        if (!baselineRef.current) {
          baselineRef.current = { x: accGrav.x, y: accGrav.y };
        }
        ax = (accGrav.x - baselineRef.current.x) / GRAVITY;
        ay = (accGrav.y - baselineRef.current.y) / GRAVITY;
      } else {
        return;
      }

      if (Math.abs(ax) > 0.005 || Math.abs(ay) > 0.005) {
        lastHardwareEventRef.current = performance.now();
        setSensorSource("accelerometer");
        targetGRef.current = {
          x: Math.max(-MAX_G_SCALE, Math.min(MAX_G_SCALE, Number(ax.toFixed(3)))),
          y: Math.max(-MAX_G_SCALE, Math.min(MAX_G_SCALE, Number(ay.toFixed(3)))),
        };
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  };

  useEffect(() => {
    if (typeof window === "undefined" || needsPermission) return;
    return attachDeviceMotion();
  }, [needsPermission]);

  const handleEnableAccelerometer = async () => {
    carAudio.playButtonTap();
    try {
      const req = (DeviceMotionEvent as any)?.requestPermission;
      if (typeof req === "function") {
        const res = await req();
        if (res === "granted") {
          setNeedsPermission(false);
        }
      }
    } catch {}
  };

  // Smooth 20Hz Telemetry & Cornering IMU loop
  const liveCarRef = useRef({
    speed: carState.speed,
    driveMode: carState.driveMode,
    cornerTestActive,
  });
  liveCarRef.current = {
    speed: carState.speed,
    driveMode: carState.driveMode,
    cornerTestActive,
  };

  useEffect(() => {
    let phase = 0;
    const interval = window.setInterval(() => {
      const now = performance.now();
      const usingHardware = now - lastHardwareEventRef.current < 1500;
      const { speed, driveMode, cornerTestActive: testOn } = liveCarRef.current;

      if (!usingHardware) {
        setSensorSource("imu-telemetry");
        phase += 0.14;

        // Longitudinal G decays smoothly back to mild cruise resistance
        speedAccelDecayRef.current *= 0.84;
        const speedNorm = Math.min(1, speed / 140);
        const sportGain = driveMode === "sport" ? 1.35 : driveMode === "eco" ? 0.72 : 1.0;

        let lat = 0;
        let lon = speedAccelDecayRef.current;

        if (testOn) {
          // Simulated dynamic S-curve cornering maneuver for performance monitoring
          lat = Math.sin(phase * 0.9) * 0.62 * sportGain + Math.cos(phase * 0.45) * 0.14;
          lon += Math.cos(phase * 1.1) * 0.28 * sportGain;
        } else if (speed > 4) {
          // Subtle real-time highway curvature & suspension load when moving
          lat = Math.sin(phase * 0.35) * 0.14 * speedNorm * sportGain;
          lon += Math.cos(phase * 0.25) * 0.04 * speedNorm;
        }

        targetGRef.current = {
          x: Math.max(-MAX_G_SCALE, Math.min(MAX_G_SCALE, lat)),
          y: Math.max(-MAX_G_SCALE, Math.min(MAX_G_SCALE, lon)),
        };
      }

      // Exponential smoothing
      const alpha = 0.32;
      const sx = smoothGRef.current.x + (targetGRef.current.x - smoothGRef.current.x) * alpha;
      const sy = smoothGRef.current.y + (targetGRef.current.y - smoothGRef.current.y) * alpha;
      smoothGRef.current = { x: sx, y: sy };

      const clampedX = Math.max(-MAX_G_SCALE, Math.min(MAX_G_SCALE, sx));
      const clampedY = Math.max(-MAX_G_SCALE, Math.min(MAX_G_SCALE, sy));
      const total = Math.hypot(clampedX, clampedY);

      setCurrentG({ x: clampedX, y: clampedY });
      setTrail((prev) => [...prev.slice(-17), { x: clampedX, y: clampedY }]);
      setPeakLateralG((prev) => Math.max(prev, Math.abs(clampedX)));
      setPeakLongitudinalG((prev) => Math.max(prev, Math.abs(clampedY)));
      setPeakTotalG((prev) => Math.max(prev, total));
    }, 50);

    return () => window.clearInterval(interval);
  }, []);

  const handleResetPeaks = () => {
    carAudio.playButtonTap();
    setPeakLateralG(0);
    setPeakLongitudinalG(0);
    setPeakTotalG(0);
    setTrail([]);
    baselineRef.current = null;
  };

  const ambientTheme = getAmbientTheme(carState.ambientLightingColor);
  const totalG = Math.hypot(currentG.x, currentG.y);

  // Convert G (-1.2..+1.2) to SVG coordinates inside 160x160 circle (center 80,80, radius 64)
  const SVG_CENTER = 80;
  const SVG_RADIUS = 64;
  const toSvgX = (gX: number) => SVG_CENTER + (gX / MAX_G_SCALE) * SVG_RADIUS;
  const toSvgY = (gY: number) => SVG_CENTER - (gY / MAX_G_SCALE) * SVG_RADIUS; // +Accel is Up

  const dotX = toSvgX(currentG.x);
  const dotY = toSvgY(currentG.y);

  const dotColor =
    totalG >= 0.85 ? "#f43f5e" : totalG >= 0.48 ? "#f59e0b" : ambientTheme.primaryHex;

  return (
    <section
      id="g-force-meter-card"
      aria-label="سنجش نیروی گرانش و شتاب خودرو"
      className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
              نمایشگر نیروی G و شتاب لحظه‌ای (G-Force Meter)
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {sensorSource === "accelerometer"
                ? "متصل به شتاب‌سنج سخت‌افزاری (Accelerometer)"
                : "پایش شتاب طولی و جانبی پیچ (IMU Telemetry)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {needsPermission && (
            <button
              type="button"
              onClick={handleEnableAccelerometer}
              className="px-2.5 py-1.5 rounded-xl bg-sky-950/70 border border-sky-500/40 text-sky-300 text-[11px] font-bold flex items-center gap-1"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>فعال‌سازی سنسور</span>
            </button>
          )}

          <button
            id="gforce-corner-test-btn"
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              setCornerTestActive((prev) => !prev);
            }}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition active:scale-95 ${
              cornerTestActive
                ? "bmw-accent-btn bmw-accent-border"
                : "hardware-key text-slate-200"
            }`}
            title="شبیه‌سازی مانور پیچ جاده برای بررسی عملکرد"
          >
            {cornerTestActive ? "توقف تست پیچ" : "شبیه‌سازی پیچ"}
          </button>

          <button
            id="gforce-reset-peak-btn"
            type="button"
            onClick={handleResetPeaks}
            className="px-3 py-1.5 rounded-xl hardware-key text-[11px] font-bold text-slate-200 flex items-center gap-1 active:scale-95"
            title="ریست اوج شتاب ثبت‌شده"
          >
            <RotateCcw className="w-3 h-3 bmw-accent-text" />
            <span>ریست اوج</span>
          </button>
        </div>
      </div>

      {/* Main Content: Friction Circle + Readout Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Friction Circle Diagram */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center instrument-well rounded-2xl p-2.5">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 160 160" className="w-full h-full">
              {/* Outer background circle */}
              <circle cx="80" cy="80" r="64" fill="#090b10" stroke="#262626" strokeWidth="1.5" />
              {/* 0.8g and 0.4g reference rings */}
              <circle
                cx="80"
                cy="80"
                r={(0.8 / MAX_G_SCALE) * SVG_RADIUS}
                fill="none"
                stroke="#262626"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle
                cx="80"
                cy="80"
                r={(0.4 / MAX_G_SCALE) * SVG_RADIUS}
                fill="none"
                stroke="#262626"
                strokeDasharray="2 3"
                strokeWidth="1"
              />

              {/* Crosshair Axes */}
              <line x1="16" y1="80" x2="144" y2="80" stroke="#262626" strokeWidth="1" />
              <line x1="80" y1="16" x2="80" y2="144" stroke="#262626" strokeWidth="1" />

              {/* Ring Labels */}
              <text x="80" y="12" fill="#737373" fontSize="7" textAnchor="middle" fontFamily="monospace">
                ACCEL 1.2g
              </text>
              <text x="80" y="155" fill="#737373" fontSize="7" textAnchor="middle" fontFamily="monospace">
                BRAKE
              </text>
              <text x="7" y="82" fill="#737373" fontSize="7" textAnchor="middle" fontFamily="monospace">
                L
              </text>
              <text x="153" y="82" fill="#737373" fontSize="7" textAnchor="middle" fontFamily="monospace">
                R
              </text>

              {/* Trail History */}
              {trail.map((pt, idx) => {
                const opacity = ((idx + 1) / trail.length) * 0.45;
                return (
                  <circle
                    key={idx}
                    cx={toSvgX(pt.x)}
                    cy={toSvgY(pt.y)}
                    r={2.2}
                    fill={dotColor}
                    fillOpacity={opacity}
                  />
                );
              })}

              {/* Vector Line from Center to Live Dot */}
              <line
                x1={SVG_CENTER}
                y1={SVG_CENTER}
                x2={dotX}
                y2={dotY}
                stroke={dotColor}
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />

              {/* Live G-Force Dot */}
              <circle
                cx={dotX}
                cy={dotY}
                r="7.5"
                fill={dotColor}
                fillOpacity="0.22"
              />
              <circle
                id="gforce-live-dot"
                cx={dotX}
                cy={dotY}
                r="4.5"
                fill={dotColor}
                stroke="#ffffff"
                strokeWidth="1.2"
              />
            </svg>
          </div>
        </div>

        {/* Numerical Telemetry Readouts */}
        <div className="sm:col-span-7 instrument-well rounded-2xl grid grid-cols-2 divide-x divide-y divide-x-reverse divide-white/[0.06]">
          <div className="p-3 flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">شتاب جانبی (Lateral)</span>
            <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
              <span id="gforce-lateral-value" className="text-base sm:text-lg font-black text-white">
                {currentG.x >= 0 ? "+" : ""}
                {currentG.x.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">g</span>
            </div>
            <span className="text-[10px] text-slate-500">
              {Math.abs(currentG.x) < 0.04
                ? "مسیر مستقیم"
                : currentG.x > 0
                  ? "فشار به راست (پیچ چپ)"
                  : "فشار به چپ (پیچ راست)"}
            </span>
          </div>

          <div className="p-3 flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">شتاب طولی (Longitudinal)</span>
            <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
              <span id="gforce-longitudinal-value" className="text-base sm:text-lg font-black bmw-accent-text">
                {currentG.y >= 0 ? "+" : ""}
                {currentG.y.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">g</span>
            </div>
            <span className="text-[10px] text-slate-500">
              {Math.abs(currentG.y) < 0.04
                ? "سرعت یکنواخت"
                : currentG.y > 0
                  ? "شتاب‌گیری رو به جلو"
                  : "نیروی ترمزگیری"}
            </span>
          </div>

          <div className="p-3 flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">برآیند لحظه‌ای (Total G)</span>
            <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
              <span id="gforce-total-value" className="text-base sm:text-lg font-black text-emerald-400">
                {totalG.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">g</span>
            </div>
            <span className="text-[10px] text-slate-500">پایداری شاسی DSC</span>
          </div>

          <div className="p-3 flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">اوج ثبت‌شده (Peak G)</span>
            <div className="flex items-baseline gap-1 font-mono tabular-nums" dir="ltr">
              <span id="gforce-peak-value" className="text-base sm:text-lg font-black text-amber-400">
                {peakTotalG.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">g</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
              Lat {peakLateralG.toFixed(2)} · Lon {peakLongitudinalG.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
