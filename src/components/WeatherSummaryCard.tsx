import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  CloudLightning,
  MapPin,
  RefreshCw,
  ExternalLink,
  Volume2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { CarState } from "../types";
import { carAudio, speakText } from "../utils/carSpeech";

export interface GroundedWeatherSummary {
  location: string;
  tempC: number | null;
  condition: string;
  conditionType: "clear" | "cloudy" | "rain" | "snow" | "wind" | "storm";
  humidity?: string;
  wind?: string;
  summary: string;
  drivingAdvice?: string;
  sources: Array<{ title: string; uri: string }>;
  updatedAt: string;
}

interface WeatherSummaryCardProps {
  carState: CarState;
  gpsCoords: { lat: number; lon: number; accuracy?: number } | null;
  onUpdateCarState: (update: Partial<CarState>) => void;
  onRequestGpsFix?: () => void;
}

export default function WeatherSummaryCard({
  carState,
  gpsCoords,
  onUpdateCarState,
  onRequestGpsFix,
}: WeatherSummaryCardProps) {
  const [weatherData, setWeatherData] = useState<GroundedWeatherSummary | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const lastWeatherFetchRef = useRef<{ key: string; at: number } | null>(null);
  const onUpdateCarStateRef = useRef(onUpdateCarState);
  onUpdateCarStateRef.current = onUpdateCarState;
  const gpsCoordsRef = useRef(gpsCoords);
  gpsCoordsRef.current = gpsCoords;

  const isStationary = (carState.speed || 0) <= 2;
  const gpsCoordKey = gpsCoords
    ? `${gpsCoords.lat.toFixed(2)},${gpsCoords.lon.toFixed(2)}`
    : "";

  const fetchGroundedWeather = useCallback(
    async (forceRefresh = false) => {
      const currentCoords = gpsCoordsRef.current;
      if (!currentCoords || !carState.isOnline) return;
      const coordKey = `${currentCoords.lat.toFixed(2)},${currentCoords.lon.toFixed(2)}`;
      const now = Date.now();
      if (
        !forceRefresh &&
        lastWeatherFetchRef.current &&
        lastWeatherFetchRef.current.key === coordKey &&
        now - lastWeatherFetchRef.current.at < 10 * 60_000
      ) {
        return;
      }

      lastWeatherFetchRef.current = { key: coordKey, at: now };
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const res = await fetch("/api/weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: currentCoords.lat,
            lon: currentCoords.lon,
            forceRefresh,
          }),
        });
        const data = await res.json();
        if (!res.ok || data?.ok === false) {
          setWeatherError(data?.message || "خطا در دریافت آب‌وهوای زنده.");
          return;
        }
        setWeatherData(data);
        if (typeof data?.tempC === "number" && Number.isFinite(data.tempC)) {
          onUpdateCarStateRef.current({ outsideTemp: Math.round(data.tempC) });
        }
      } catch {
        setWeatherError("ارتباط با سرور برای دریافت آب‌وهوا برقرار نشد.");
      } finally {
        setWeatherLoading(false);
      }
    },
    [carState.isOnline]
  );

  useEffect(() => {
    if (!isStationary || !carState.isOnline || !gpsCoordKey) return;
    void fetchGroundedWeather(false);
  }, [isStationary, carState.isOnline, gpsCoordKey, fetchGroundedWeather]);

  if (!isStationary) {
    return null;
  }

  const renderWeatherIcon = (type?: GroundedWeatherSummary["conditionType"]) => {
    switch (type) {
      case "clear":
        return <Sun className="w-5 h-5 text-amber-300 shrink-0" />;
      case "rain":
        return <CloudRain className="w-5 h-5 text-sky-300 shrink-0" />;
      case "snow":
        return <CloudSnow className="w-5 h-5 text-cyan-100 shrink-0" />;
      case "wind":
        return <Wind className="w-5 h-5 text-teal-300 shrink-0" />;
      case "storm":
        return <CloudLightning className="w-5 h-5 text-amber-400 shrink-0" />;
      default:
        return <Cloud className="w-5 h-5 text-teal-200 shrink-0" />;
    }
  };

  const handleSpeakWeather = () => {
    if (!weatherData) return;
    carAudio.playBmwGong();
    const tempText =
      weatherData.tempC !== null ? `دمای فعلی ${weatherData.tempC} درجه سانتی‌گراد، ` : "";
    const adviceText = weatherData.drivingAdvice ? ` ${weatherData.drivingAdvice}` : "";
    void speakText(
      `وضعیت هوا در ${weatherData.location}: ${tempText}${weatherData.condition}. ${weatherData.summary}${adviceText}`
    );
  };

  return (
    <article
      id="stationary-weather-card"
      dir="rtl"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        borderColor: expanded ? "var(--bmw-accent-border, rgba(94, 234, 212, 0.35))" : undefined,
        boxShadow: expanded
          ? "0 14px 32px rgba(0, 0, 0, 0.88), 0 0 22px var(--bmw-accent-glow, rgba(20, 184, 166, 0.18))"
          : "0 10px 26px rgba(0, 0, 0, 0.8)",
      }}
      className="backdrop-blur-md border border-teal-200/20 rounded-xl px-4 py-2.5 max-w-2xl w-full sm:w-auto flex flex-col gap-2 transition-all duration-200"
    >
      {!carState.isOnline ? (
        <div className="flex items-center gap-2.5 text-xs text-amber-200">
          <Cloud className="w-4 h-4 text-amber-300 shrink-0" />
          <span>حالت آفلاین — دریافت آب‌وهوای زنده GPS نیازمند اتصال اینترنت است.</span>
        </div>
      ) : !gpsCoords ? (
        <div className="flex items-center justify-between gap-3 text-xs text-teal-100">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">
              خودرو متوقف است · در انتظار موقعیت GPS برای نمایش آب‌وهوای زنده
            </span>
          </div>
          {onRequestGpsFix && (
            <button
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                onRequestGpsFix();
              }}
              className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-300/30 text-[11px] font-semibold text-teal-100 whitespace-nowrap shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              دریافت GPS
            </button>
          )}
        </div>
      ) : weatherLoading && !weatherData ? (
        <div className="flex items-center gap-2.5 text-xs text-teal-100">
          <RefreshCw className="w-4 h-4 text-teal-300 animate-spin shrink-0" />
          <span>در حال جستجوی زنده آب‌وهوای موقعیت فعلی...</span>
        </div>
      ) : weatherError && !weatherData ? (
        <div className="flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <Cloud className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">{weatherError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              void fetchGroundedWeather(true);
            }}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-teal-200/20 text-[11px] font-semibold text-teal-100 whitespace-nowrap shrink-0 transition"
          >
            تلاش مجدد
          </button>
        </div>
      ) : weatherData ? (
        <>
          {/* Primary Interactive Summary Header */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                carAudio.playButtonTap();
                setExpanded((prev) => !prev);
              }}
              className="flex items-center gap-2.5 min-w-0 text-right flex-1 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded-md"
              title={expanded ? "جمع کردن جزئیات آب‌وهوا" : "مشاهده جزئیات کامل آب‌وهوا"}
            >
              {renderWeatherIcon(weatherData.conditionType)}
              {weatherData.tempC !== null && (
                <span
                  className="text-base font-bold font-mono text-white tabular-nums shrink-0"
                  dir="ltr"
                >
                  {weatherData.tempC}°C
                </span>
              )}
              <span className="text-xs font-bold text-teal-50 truncate">
                {weatherData.location}
              </span>
              <span className="text-teal-300/40" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-teal-200/85 truncate">
                {weatherData.condition}
              </span>
              {weatherData.humidity && (
                <>
                  <span className="hidden sm:inline text-teal-300/40" aria-hidden="true">
                    ·
                  </span>
                  <span className="hidden sm:inline text-[11px] font-mono tabular-nums text-sky-200/90 whitespace-nowrap">
                    رطوبت {weatherData.humidity}
                  </span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleSpeakWeather}
                className="p-1.5 rounded-lg hover:bg-white/10 text-teal-200/85 hover:text-white transition"
                title="خواندن وضعیت آب‌وهوا با صدای جارویز"
                aria-label="پخش صوتی وضعیت آب‌وهوا"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  void fetchGroundedWeather(true);
                }}
                disabled={weatherLoading}
                className="p-1.5 rounded-lg hover:bg-white/10 text-teal-200/85 hover:text-white transition disabled:opacity-50"
                title="بروزرسانی آب‌وهوای زنده"
                aria-label="بروزرسانی آب‌وهوا"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  setExpanded((prev) => !prev);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-teal-200/85 hover:text-white transition"
                aria-label={expanded ? "بستن جزئیات" : "باز کردن جزئیات"}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Concise Live Summary */}
          <p className="text-[11px] text-slate-200/90 leading-relaxed line-clamp-2">
            {weatherData.summary}
          </p>

          {/* Expanded Details & Google Search Grounding Sources */}
          {expanded && (
            <div className="pt-2 border-t border-teal-200/15 flex flex-col gap-2 text-[11px]">
              {weatherData.drivingAdvice && (
                <p className="text-amber-200/95 leading-relaxed">
                  توصیه رانندگی: {weatherData.drivingAdvice}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-mono tabular-nums">
                {weatherData.wind && <span>باد {weatherData.wind}</span>}
                {weatherData.wind && gpsCoords && (
                  <span className="text-teal-300/40" aria-hidden="true">
                    ·
                  </span>
                )}
                {gpsCoords && (
                  <span dir="ltr">
                    GPS {gpsCoords.lat.toFixed(3)}, {gpsCoords.lon.toFixed(3)}
                  </span>
                )}
                <span className="text-teal-300/40" aria-hidden="true">
                  ·
                </span>
                <span>بروزرسانی {weatherData.updatedAt}</span>
              </div>

              {weatherData.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-teal-200/10 text-[10px]">
                  <span className="text-teal-300/80">منابع Google Search:</span>
                  {weatherData.sources.map((src) => (
                    <a
                      key={src.uri}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-200 hover:text-white underline underline-offset-2 truncate max-w-[190px]"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </article>
  );
}
