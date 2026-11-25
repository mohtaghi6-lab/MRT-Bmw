import React, { useEffect, useState } from "react";
import {
  PhoneCall,
  MapPin,
  Copy,
  Check,
  RefreshCw,
  X,
  ShieldAlert,
  HeartPulse,
  Volume2,
  Square,
  AlertTriangle,
} from "lucide-react";
import { CarState } from "../types";
import { carAudio, speakText, stopSpeaking } from "../utils/carSpeech";

interface SosEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  gpsConnected: boolean;
  gpsCoords: { lat: number; lon: number; accuracy?: number } | null;
  onRequestGpsFix: () => void;
}

interface EmergencyServiceOption {
  id: string;
  title: string;
  subtitle: string;
  number: string;
  accentClass: string;
}

const EMERGENCY_SERVICES: EmergencyServiceOption[] = [
  {
    id: "ems",
    title: "اورژانس پزشکی",
    subtitle: "اعزام آمبولانس و فوریت‌های پزشکی",
    number: "115",
    accentClass: "bg-rose-600/90 hover:bg-rose-500 border-rose-400/70 text-white",
  },
  {
    id: "police",
    title: "پلیس",
    subtitle: "فوریت‌های پلیسی و تصادفات",
    number: "110",
    accentClass: "bg-sky-700/85 hover:bg-sky-600 border-sky-400/60 text-white",
  },
  {
    id: "fire",
    title: "آتش‌نشانی",
    subtitle: "اطفای حریق و امداد و نجات",
    number: "125",
    accentClass: "bg-amber-600/90 hover:bg-amber-500 border-amber-400/65 text-white",
  },
  {
    id: "universal",
    title: "اضطراری بین‌المللی",
    subtitle: "شبکه اضطراری GSM / هلال احمر",
    number: "112",
    accentClass: "bg-white/[0.08] hover:bg-white/[0.14] border-white/25 text-white",
  },
];

const FIRST_AID_STEPS = [
  {
    step: "01",
    title: "ایمن‌سازی صحنه و روشن کردن فلاشر",
    detail:
      "خودرو را در حاشیه امن متوقف کنید، فلاشر خطر را روشن نمایید و پیش از نزدیک شدن به مصدوم از ایمنی مسیر مطمئن شوید.",
  },
  {
    step: "02",
    title: "بررسی هوشیاری و تنفس بدون جابه‌جایی گردن",
    detail:
      "به آرامی با مصدوم صحبت کنید و حرکت قفسه سینه را بررسی نمایید. در تصادفات، از حرکت دادن سر و ستون فقرات خودداری کنید.",
  },
  {
    step: "03",
    title: "تماس فوری با ۱۱۵ و اعلام مختصات GPS",
    detail:
      "شماره ۱۱۵ را شماره‌گیری کرده و تعداد مصدومان، وضعیت هوشیاری و مختصات دقیق نمایش‌داده‌شده در بالا را اعلام کنید.",
  },
  {
    step: "04",
    title: "کنترل خونریزی شدید با فشار مستقیم",
    detail:
      "روی محل خونریزی یک پارچه یا گاز تمیز قرار دهید و فشار مستقیم و یکنواخت وارد کنید. پانسمان خیس‌شده را برندارید.",
  },
  {
    step: "05",
    title: "باز نگه داشتن راه هوایی و گرم نگه داشتن مصدوم",
    detail:
      "در صورت تنفس طبیعی و نبود آسیب ستون فقرات، راه هوایی را باز نگه دارید، بدن مصدوم را گرم کنید و به فرد بی‌هوش آب یا غذا ندهید.",
  },
];

export default function SosEmergencyModal({
  isOpen,
  onClose,
  carState,
  onUpdateCarState,
  gpsConnected,
  gpsCoords,
  onRequestGpsFix,
}: SosEmergencyModalProps) {
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [dialedFeedback, setDialedFeedback] = useState<string | null>(null);
  const [isReadingAid, setIsReadingAid] = useState(false);

  const isStationary = carState.speed <= 2;

  useEffect(() => {
    if (!isOpen) return;
    if (!gpsCoords) {
      onRequestGpsFix();
    }
  }, [isOpen, gpsCoords, onRequestGpsFix]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopSpeaking();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const unsub = carAudio.onSpeakingChange((speaking) => {
      if (!speaking) {
        setIsReadingAid(false);
      }
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const formattedCoords = gpsCoords
    ? `${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lon.toFixed(6)}`
    : null;

  const handleDialEmergency = (svc: EmergencyServiceOption) => {
    carAudio.playButtonTap();
    setDialedFeedback(`در حال برقراری تماس با ${svc.title} (${svc.number})...`);
    try {
      const bridge = (window as any).AndroidBridge;
      if (bridge && typeof bridge.dialNumber === "function") {
        bridge.dialNumber(svc.number);
      }
    } catch {}
  };

  const handleCopyCoords = async () => {
    if (!gpsCoords) return;
    carAudio.playButtonTap();
    const payload = `GPS: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lon.toFixed(6)} | https://maps.google.com/?q=${gpsCoords.lat.toFixed(6)},${gpsCoords.lon.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedCoords(true);
      window.setTimeout(() => setCopiedCoords(false), 2200);
    } catch {
      setCopiedCoords(false);
    }
  };

  const handleReadFirstAid = async () => {
    carAudio.playButtonTap();
    if (isReadingAid) {
      stopSpeaking();
      setIsReadingAid(false);
      return;
    }
    setIsReadingAid(true);
    const spokenGuide = FIRST_AID_STEPS.map(
      (item) => `گام ${Number(item.step)}: ${item.title}. ${item.detail}`
    ).join(" ");
    await speakText(spokenGuide);
  };

  return (
    <div
      id="sos-emergency-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/82 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 select-none"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-modal-title"
      onClick={() => {
        stopSpeaking();
        onClose();
      }}
    >
      <div
        id="sos-emergency-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#070b0d] border border-rose-500/40 shadow-[0_24px_80px_rgba(0,0,0,0.88)] p-5 sm:p-7 flex flex-col gap-5 text-slate-100"
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-rose-600/20 border border-rose-500/50 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <div className="min-w-0">
              <h2 id="sos-modal-title" className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                امداد و تماس اضطراری (SOS)
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>BMW 728Li Emergency Assist</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {isStationary ? "خودرو متوقف (0 km/h)" : `سرعت فعلی: ${carState.speed} km/h`}
                </span>
              </div>
            </div>
          </div>

          <button
            id="sos-modal-close-btn"
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              stopSpeaking();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 flex items-center justify-center transition active:scale-95 shrink-0"
            aria-label="بستن پنجره اضطراری"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Quick Access Emergency Calls */}
        <section aria-labelledby="sos-calls-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 id="sos-calls-heading" className="text-sm font-bold text-slate-200">
              تماس سریع با مراکز امدادی
            </h3>
            {dialedFeedback && (
              <span className="text-xs font-semibold text-rose-300 truncate">{dialedFeedback}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EMERGENCY_SERVICES.map((svc) => (
              <a
                key={svc.id}
                id={`sos-call-${svc.id}`}
                href={`tel:${svc.number}`}
                onClick={() => handleDialEmergency(svc)}
                className={`min-h-[60px] px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 transition active:scale-[0.98] ${svc.accentClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PhoneCall className="w-5 h-5 shrink-0" />
                  <div className="min-w-0 text-right">
                    <div className="text-sm font-extrabold leading-tight truncate">{svc.title}</div>
                    <div className="text-[11px] opacity-85 truncate mt-0.5">{svc.subtitle}</div>
                  </div>
                </div>
                <span className="text-xl font-extrabold font-mono tabular-nums tracking-wider shrink-0">
                  {svc.number}
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Section 2: Current GPS Coordinates */}
        <section
          aria-labelledby="sos-gps-heading"
          className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3 min-w-0">
            <MapPin className={`w-5 h-5 mt-0.5 shrink-0 ${gpsCoords ? "text-emerald-400" : "text-amber-400"}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <h3 id="sos-gps-heading" className="font-bold text-slate-200 text-sm">
                  موقعیت فعلی GPS
                </h3>
                <span aria-hidden="true">·</span>
                <span className={gpsConnected ? "text-emerald-400 font-semibold" : "text-amber-300 font-semibold"}>
                  {gpsCoords ? "قفل ماهواره‌ای فعال" : "در حال دریافت موقعیت"}
                </span>
              </div>

              {formattedCoords ? (
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-white tracking-wide" dir="ltr">
                    {formattedCoords}
                  </div>
                  {typeof gpsCoords?.accuracy === "number" && (
                    <span className="text-xs text-slate-400 font-mono tabular-nums">
                      دقت ±{Math.round(gpsCoords.accuracy)} متر
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-amber-200/85">
                  مختصات هنوز دریافت نشده است؛ روی به‌روزرسانی GPS بزنید یا دسترسی مکان مرورگر را تایید کنید.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {formattedCoords && (
              <button
                id="sos-copy-gps-btn"
                type="button"
                onClick={handleCopyCoords}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition whitespace-nowrap shrink-0 active:scale-95"
              >
                {copiedCoords ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-teal-300" />
                    <span>کپی مختصات</span>
                  </>
                )}
              </button>
            )}
            <button
              id="sos-refresh-gps-btn"
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                onRequestGpsFix();
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/15 text-xs font-bold text-slate-100 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 active:scale-95"
            >
              <RefreshCw className="w-4 h-4 text-sky-300" />
              <span>به‌روزرسانی GPS</span>
            </button>
          </div>
        </section>

        {/* Section 3: Basic First-Aid Steps (Only displayed when car is stationary) */}
        <section
          id="sos-first-aid-section"
          aria-labelledby="sos-first-aid-heading"
          className="pt-4 border-t border-white/[0.08] flex flex-col gap-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-400 shrink-0" />
              <h3 id="sos-first-aid-heading" className="text-sm font-bold text-white">
                مراحل پایه کمک‌های اولیه
              </h3>
            </div>

            {isStationary && (
              <div className="flex items-center gap-2">
                <button
                  id="sos-hazard-toggle-btn"
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    onUpdateCarState({ hazardActive: !carState.hazardActive });
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 active:scale-95 ${
                    carState.hazardActive
                      ? "bg-amber-500/20 border-amber-400/70 text-amber-200"
                      : "bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-slate-200"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{carState.hazardActive ? "فلاشر روشن است" : "روشن کردن فلاشر"}</span>
                </button>

                <button
                  id="sos-read-first-aid-btn"
                  type="button"
                  onClick={handleReadFirstAid}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/15 text-xs font-bold text-teal-100 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 active:scale-95"
                >
                  {isReadingAid ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-rose-400" />
                      <span>توقف صدا</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-teal-300" />
                      <span>پخش صوتی مراحل</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {isStationary ? (
            <ol id="sos-first-aid-steps" className="flex flex-col divide-y divide-white/[0.07]">
              {FIRST_AID_STEPS.map((item) => (
                <li key={item.step} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                  <span className="font-mono tabular-nums text-xs font-bold text-rose-300 pt-0.5 shrink-0">
                    {item.step}.
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white">{item.title}</div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-0.5">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div
              id="sos-moving-safety-notice"
              className="rounded-2xl bg-amber-950/45 border border-amber-500/35 px-4 py-3.5 flex items-start gap-3 text-xs text-amber-100 leading-relaxed"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-200">خودرو در حال حرکت است</p>
                <p className="mt-1 text-amber-100/85">
                  برای ایمنی راننده، دستورالعمل‌های متنی کمک‌های اولیه تنها زمانی که خودرو متوقف باشد (سرعت{" "}
                  <span className="font-mono tabular-nums">0 km/h</span>) نمایش داده می‌شوند. اکنون سرعت شما{" "}
                  <span className="font-mono tabular-nums font-bold">{carState.speed} km/h</span> است.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
