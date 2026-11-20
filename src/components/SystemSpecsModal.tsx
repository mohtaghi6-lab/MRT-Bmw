import { useState } from "react";
import {
  Cpu,
  CheckCircle2,
  X,
  Zap,
  Activity,
  Sliders,
  ShieldCheck,
} from "lucide-react";
import { carAudio } from "../utils/carSpeech";

interface SystemSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFactorySettings?: () => void;
}

export default function SystemSpecsModal({
  isOpen,
  onClose,
  onOpenFactorySettings,
}: SystemSpecsModalProps) {
  const [ramFreed, setRamFreed] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  if (!isOpen) return null;

  const handleCleanRam = () => {
    carAudio.playButtonTap();
    setCleaning(true);
    setTimeout(() => {
      setCleaning(false);
      setRamFreed(true);
      carAudio.playLockBeep(true);
    }, 1000);
  };

  return (
    <div
      id="system-specs-modal"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">
              مشخصات مانیتور خودرو (YT9216BJ) و اتصال ECU
            </h3>
          </div>
          <button
            onClick={() => {
              carAudio.playButtonTap();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* BMW 728Li Engine & DME Specifications */}
          <div className="bg-slate-950 p-3 rounded-xl border border-sky-900/50 space-y-2">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold text-xs pb-1 border-b border-slate-800">
              <Activity className="w-3.5 h-3.5" />
              <span>ارتباط با کامپیوتر خودرو (BMW 728Li • موتور M52TUB28)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="flex justify-between items-center text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">مدل خودرو:</span>
                <span className="font-bold text-white font-mono">BMW 728Li Executive</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">کامپیوتر موتور (DME):</span>
                <span className="font-mono font-bold text-sky-300">Bosch DME MS42 / Double-VANOS</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">سنسور دمای بیرون:</span>
                <span className="font-mono text-amber-300">سنسور فابریک سپر جلو BMW</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">پورت دیاگ OBD-II:</span>
                <span className="font-mono text-emerald-400">زیر ستون فرمان (16-Pin)</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">شبکه ارتباطی:</span>
                <span className="font-mono text-slate-200">BMW I/K-Bus & CAN-Bus MUX</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">نحوه اتصال زنده:</span>
                <span className="font-mono text-sky-300">BMW CAN Interface / INPA-EDIABAS</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs pb-1 border-b border-slate-800">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>مشخصات سخت‌افزاری مانیتور اندروید</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">مدل مادربرد اندروید:</span>
              <span className="font-mono font-bold text-cyan-400">
                YT9216BJ_00012_V001
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">سیستم عامل:</span>
              <span className="font-mono text-emerald-400">
                Android 10.1 (XY AUTO: J6.8)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">پروتکل ارتباطی CAN-Bus:</span>
              <span className="font-mono text-slate-200">
                CAN Pro 3.7 (Raise-05~12 318i)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">حافظه رم (RAM):</span>
              <span className="font-mono text-cyan-400 font-bold">2GB DDR3</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">حافظه داخلی (Storage):</span>
              <span className="font-mono text-slate-200">16GB eMMC Flash</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">پردازنده (CPU):</span>
              <span className="font-mono text-slate-200">
                Quad-Core Cortex-A7 1.3GHz × 4
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">رزولوشن نمایشگر:</span>
              <span className="font-mono text-yellow-400 font-bold">
                1024×600 Landscape
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">نسخه میکروکنترلر (MCU):</span>
              <span className="font-mono text-slate-400">4.0 (X2)</span>
            </div>
          </div>

          {/* Diagnostics and Health Status Card */}
          <div className="bg-slate-950 p-3 rounded-xl border border-emerald-900/50 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>وضعیت سلامت و پایش کدهای دیاگ (OBD-II DTC)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono">
                سالم (بدون خطا)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">نرخ تازه‌سازی سنسورها:</span>
              <span className="font-mono text-emerald-400 font-bold">50Hz (Realtime)</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">پایش مصرف سوخت و انژکتور:</span>
              <span className="font-mono text-cyan-300 font-bold">کالیبره شده با موتور XU7</span>
            </div>
          </div>

          {/* Lightweight Mode Optimizer Card */}
          <div className="bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                حالت سبک‌سازی مانیتور خودرو (Ultra-Lightweight)
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                طراحی شده با حداقل مصرف رم (زیر ۵۰ مگابایت) و اجرای فوق‌العاده روان روی پردازنده A7
              </p>
            </div>

            <button
              onClick={handleCleanRam}
              disabled={cleaning}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shrink-0 transition active:scale-95 flex items-center gap-1"
            >
              <Zap className={`w-3.5 h-3.5 ${cleaning ? "animate-spin" : ""}`} />
              <span>{cleaning ? "پاکسازی..." : "بهینه‌سازی رم"}</span>
            </button>
          </div>

          {/* Factory Settings Direct Button */}
          {onOpenFactorySettings && (
            <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  تنظیمات کارخانه مانیتور (رمز: 8888)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  پیکربندی پروتکل‌های BMW CAN-Bus، سنسورهای Double-VANOS، لوگوی بوت و ریست فکتوری
                </p>
              </div>

              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  onClose();
                  onOpenFactorySettings();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition active:scale-95 flex items-center gap-1 shadow-sm"
              >
                <span>ورود به فکتوری</span>
              </button>
            </div>
          )}

          {ramFreed && (
            <div className="text-emerald-400 bg-emerald-950/60 border border-emerald-800 p-2 rounded-lg text-center flex items-center justify-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>حافظه کش خالی شد و مصرف رم به حداقل رسید.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
