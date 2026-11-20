import React, { useEffect, useState } from "react";

interface AnalogClockProps {
  variant?: "compact" | "chronometer";
  showDate?: boolean;
  showDigitalSub?: boolean;
  className?: string;
}

export default function AnalogClock({
  variant = "compact",
  showDate = true,
  showDigitalSub = true,
  className = "",
}: AnalogClockProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Exact angular calculations for analog hands
  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = hours * 30 + minutes * 0.5;

  const digitalTime = now.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const persianDate = now.toLocaleDateString("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isLarge = variant === "chronometer";
  const dialSizeClass = isLarge ? "w-28 h-28 sm:w-32 sm:h-32" : "w-10 h-10 sm:w-11 sm:h-11";

  return (
    <div
      className={`flex items-center gap-2.5 select-none ${className}`}
      aria-label={`ساعت عقربه‌ای ${digitalTime}`}
    >
      {/* Precision BMW Analog Chronometer SVG Dial */}
      <div
        className={`${dialSizeClass} rounded-full relative shrink-0 shadow-[0_0_18px_rgba(0,0,0,0.65)]`}
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #1c2434 0%, #0a0f18 68%, #04060b 100%)",
          border: isLarge
            ? "2px solid rgba(255,255,255,0.2)"
            : "1.5px solid rgba(255,255,255,0.22)",
        }}
      >
        <svg viewBox="0 0 120 120" className="w-full h-full">
          {/* Outer brushed metallic ring */}
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.2"
          />
          <circle
            cx="60"
            cy="60"
            r="51"
            fill="none"
            stroke="var(--bmw-accent, #38bdf8)"
            strokeOpacity="0.28"
            strokeWidth="0.9"
          />

          {/* 60 minute/second ticks in chronometer mode, 12 hour ticks in both */}
          {Array.from({ length: isLarge ? 60 : 12 }).map((_, idx) => {
            const total = isLarge ? 60 : 12;
            const deg = (idx * 360) / total;
            const isMajor = isLarge ? idx % 5 === 0 : idx % 3 === 0;
            const isCardinal = isLarge ? idx % 15 === 0 : idx % 3 === 0;
            const y1 = isCardinal ? 8 : isMajor ? 10 : 11;
            const y2 = isCardinal ? 17 : isMajor ? 16 : 14;
            return (
              <line
                key={idx}
                x1="60"
                y1={y1}
                x2="60"
                y2={y2}
                stroke={
                  isCardinal
                    ? "var(--bmw-accent, #38bdf8)"
                    : isMajor
                      ? "#e2e8f0"
                      : "rgba(148,163,184,0.45)"
                }
                strokeWidth={isCardinal ? "2.4" : isMajor ? "1.8" : "0.9"}
                strokeLinecap="round"
                transform={`rotate(${deg} 60 60)`}
              />
            );
          })}

          {/* Dial brand typography for Chronometer variant */}
          {isLarge && (
            <>
              <text
                x="60"
                y="34"
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="7"
                fontWeight="800"
                letterSpacing="1.6"
                fontFamily="monospace"
              >
                BMW
              </text>
              <text
                x="60"
                y="88"
                textAnchor="middle"
                fill="rgba(148,163,184,0.85)"
                fontSize="5.5"
                fontWeight="700"
                letterSpacing="1"
                fontFamily="monospace"
              >
                728Li
              </text>
            </>
          )}

          {/* Hour Hand */}
          <g transform={`rotate(${hourAngle} 60 60)`}>
            <line
              x1="60"
              y1="66"
              x2="60"
              y2="31"
              stroke="#f8fafc"
              strokeWidth={isLarge ? "4.2" : "5"}
              strokeLinecap="round"
            />
            {isLarge && (
              <line
                x1="60"
                y1="52"
                x2="60"
                y2="34"
                stroke="var(--bmw-accent, #38bdf8)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </g>

          {/* Minute Hand */}
          <g transform={`rotate(${minuteAngle} 60 60)`}>
            <line
              x1="60"
              y1="68"
              x2="60"
              y2="19"
              stroke="#e2e8f0"
              strokeWidth={isLarge ? "2.8" : "3.5"}
              strokeLinecap="round"
            />
          </g>

          {/* Second Hand (BMW M-Orange / Accent Sweep) */}
          <g transform={`rotate(${secondAngle} 60 60)`}>
            <line
              x1="60"
              y1="72"
              x2="60"
              y2="15"
              stroke="#f97316"
              strokeWidth={isLarge ? "1.4" : "1.8"}
              strokeLinecap="round"
            />
            <circle cx="60" cy="70" r="2.2" fill="#f97316" />
          </g>

          {/* Center Pinion Cap */}
          <circle cx="60" cy="60" r={isLarge ? "4.4" : "5"} fill="#0f172a" stroke="#f8fafc" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="1.8" fill="#f97316" />
        </svg>
      </div>

      {/* Optional Date & Clean Tabular Sub-readout */}
      {(showDigitalSub || showDate) && (
        <div className="flex flex-col leading-tight min-w-0">
          {showDigitalSub && (
            <span
              className={`${
                isLarge ? "text-base sm:text-lg" : "text-xs sm:text-[13px]"
              } font-mono font-bold tracking-wider text-white tabular-nums`}
              dir="ltr"
            >
              {digitalTime}
            </span>
          )}
          {showDate && (
            <span
              className={`${
                isLarge ? "text-xs text-slate-300 mt-0.5" : "text-[10px] text-slate-400"
              } truncate`}
            >
              {persianDate}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
