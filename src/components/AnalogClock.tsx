import React, { useEffect, useState } from "react";

interface AnalogClockProps {
  variant?: "compact" | "cluster" | "chronometer";
  showDate?: boolean;
  showDigitalSub?: boolean;
  className?: string;
}

export default function AnalogClock({
  variant = "chronometer",
  showDate = true,
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

  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = hours * 30 + minutes * 0.5;

  const persianDate = now.toLocaleDateString("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isLarge = variant === "chronometer";
  const isCluster = variant === "cluster";
  const showDetailFace = isLarge || isCluster;
  const dialSizeClass = isLarge
    ? "w-28 h-28 sm:w-32 sm:h-32"
    : isCluster
      ? "w-20 h-20 sm:w-24 sm:h-24 lg:w-[104px] lg:h-[104px]"
      : "w-12 h-12 sm:w-14 sm:h-14";

  return (
    <div
      className={`flex items-center gap-3 select-none ${className}`}
      aria-label="ساعت عقربه‌ای ب‌ام‌و 728Li"
    >
      {/* Precision BMW Analog Chronometer SVG Dial (Analog-Only, No Digital Time) */}
      <div
        className={`${dialSizeClass} rounded-full relative shrink-0 shadow-[0_0_24px_rgba(0,0,0,0.9)]`}
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #172a2e 0%, #071114 68%, #020506 100%)",
          border: showDetailFace
            ? "2px solid rgba(204,251,241,0.34)"
            : "1.5px solid rgba(204,251,241,0.26)",
        }}
      >
        <svg viewBox="0 0 120 120" className="w-full h-full">
          {/* Outer brushed metallic ring */}
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.4"
          />
          <circle
            cx="60"
            cy="60"
            r="51"
            fill="none"
            stroke="var(--bmw-accent, #d99b52)"
            strokeOpacity="0.42"
            strokeWidth="1.1"
          />

          {/* 60 minute/second ticks */}
          {Array.from({ length: showDetailFace ? 60 : 12 }).map((_, idx) => {
            const total = showDetailFace ? 60 : 12;
            const deg = (idx * 360) / total;
            const isMajor = showDetailFace ? idx % 5 === 0 : idx % 3 === 0;
            const isCardinal = showDetailFace ? idx % 15 === 0 : idx % 3 === 0;
            const y1 = isCardinal ? 8 : isMajor ? 10 : 11;
            const y2 = isCardinal ? 18 : isMajor ? 16 : 14;
            return (
              <line
                key={idx}
                x1="60"
                y1={y1}
                x2="60"
                y2={y2}
                stroke={
                  isCardinal
                    ? "var(--bmw-accent, #ff731d)"
                    : isMajor
                      ? "#f8fafc"
                      : "rgba(148,163,184,0.45)"
                }
                strokeWidth={isCardinal ? "2.8" : isMajor ? "2" : "0.9"}
                strokeLinecap="round"
                transform={`rotate(${deg} 60 60)`}
              />
            );
          })}

          {isCluster && (
            <>
              <text x="60" y="30" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="800" fontFamily="monospace">
                12
              </text>
              <text x="95" y="63.5" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                3
              </text>
              <text x="60" y="99" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                6
              </text>
              <text x="25" y="63.5" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                9
              </text>
            </>
          )}

          {isLarge && (
            <>
              <text
                x="60"
                y="34"
                textAnchor="middle"
                fill="#e2e8f0"
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
                fill="rgba(247,212,166,0.85)"
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
              stroke="#ffffff"
              strokeWidth={showDetailFace ? "4.6" : "5"}
              strokeLinecap="round"
            />
            {showDetailFace && (
              <line
                x1="60"
                y1="52"
                x2="60"
                y2="34"
                stroke="var(--bmw-accent, #ff731d)"
                strokeWidth="1.7"
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
              strokeWidth={showDetailFace ? "3.2" : "3.5"}
              strokeLinecap="round"
            />
          </g>

          {/* Second Hand */}
          <g transform={`rotate(${secondAngle} 60 60)`}>
            <line
              x1="60"
              y1="72"
              x2="60"
              y2="15"
              stroke="#ff731d"
              strokeWidth={showDetailFace ? "1.7" : "1.8"}
              strokeLinecap="round"
            />
            <circle cx="60" cy="70" r="2.2" fill="#ff731d" />
          </g>

          <circle cx="60" cy="60" r={showDetailFace ? "4.6" : "5"} fill="#0f172a" stroke="#f8fafc" strokeWidth="1.6" />
          <circle cx="60" cy="60" r="2" fill="#ff731d" />
        </svg>
      </div>

      {showDate && (
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-xs sm:text-sm font-bold text-amber-100 truncate">
            {persianDate}
          </span>
        </div>
      )}
    </div>
  );
}
