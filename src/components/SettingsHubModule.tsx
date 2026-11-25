import React, { useEffect, useState } from "react";
import {
  Cpu,
  TrendingUp,
  Car,
  Calendar,
  Settings,
  Bluetooth,
  Usb,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Droplets,
  Route,
  Volume2,
  Trash2,
  Wrench,
  FileText,
  Activity,
  GitBranch,
  CircleGauge,
  Box,
  Mic,
  MicOff,
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
import { CarState, EngineTelemetryPoint, MusicTrack } from "../types";
import { carAudio, speakText } from "../utils/carSpeech";
import {
  EcuLiveSnapshot,
  buildCarComputerSpokenSummary,
  carEcuBridge,
  isWebBluetoothAvailable,
  isWebSerialAvailable,
} from "../utils/carEcuBridge";
import BmwVisualShowcase from "./BmwVisualShowcase";
import GForceMeter from "./GForceMeter";
import EcoDrivingScore from "./EcoDrivingScore";
import DailyScheduleWidget from "./DailyScheduleWidget";

interface SettingsHubModuleProps {
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  currentTrack: MusicTrack;
  tripDistanceKm: number;
  tripElapsedSeconds: number;
  onResetTrip: () => void;
  oilMileageKm: number;
  oilEngineHours: number;
  oilLastResetDate: string;
  onResetOilLife: () => void;
  engineTelemetryHistory: EngineTelemetryPoint[];
  onNavigateToMeetingLocation?: (location: string, meetingTitle: string) => void;
  onOpen3DShowroom: () => void;
  onOpenDiagnosticsModal: () => void;
  onOpenSpecsModal: () => void;
  onOpenFactorySettings: () => void;
  onToggleStealthHud: () => void;
  initialSubTab?: "ecu" | "telemetry" | "visual" | "schedule" | "system";
  jarvisStandbyEnabled?: boolean;
  jarvisStandbyListening?: boolean;
  jarvisMicStatus?: "listening" | "initializing" | "paused_speaking" | "blocked" | "unsupported" | "disabled";
  micNoiseFilterActive?: boolean;
  onToggleJarvisStandby?: () => void;
}

function formatTripDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export default function SettingsHubModule({
  carState,
  onUpdateCarState,
  currentTrack,
  tripDistanceKm,
  tripElapsedSeconds,
  onResetTrip,
  oilMileageKm,
  oilEngineHours,
  oilLastResetDate,
  onResetOilLife,
  engineTelemetryHistory,
  onNavigateToMeetingLocation,
  onOpen3DShowroom,
  onOpenDiagnosticsModal,
  onOpenSpecsModal,
  onOpenFactorySettings,
  onToggleStealthHud,
  initialSubTab = "ecu",
  jarvisStandbyEnabled = false,
  jarvisStandbyListening = false,
  jarvisMicStatus = "disabled",
  micNoiseFilterActive = false,
  onToggleJarvisStandby,
}: SettingsHubModuleProps) {
  const [subTab, setSubTab] = useState<"ecu" | "telemetry" | "visual" | "schedule" | "system">(
    initialSubTab
  );
  const [ecuSnap, setEcuSnap] = useState<EcuLiveSnapshot>(() => carEcuBridge.getSnapshot());
  const [ecuStatusMsg, setEcuStatusMsg] = useState<string | null>(null);
  const [ecuBusy, setEcuBusy] = useState(false);
  const [oilResetNotice, setOilResetNotice] = useState(false);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    const unsub = carEcuBridge.subscribe(setEcuSnap);
    return unsub;
  }, []);

  const averageSpeedKmh =
    tripElapsedSeconds > 0 ? tripDistanceKm / (tripElapsedSeconds / 3600) : 0;

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

  const handleBluetoothConnect = async () => {
    carAudio.playButtonTap();
    setEcuBusy(true);
    setEcuStatusMsg(null);
    const res = await carEcuBridge.connectBluetoothObd(onUpdateCarState);
    setEcuStatusMsg(res.message);
    setEcuBusy(false);
    if (res.ok) {
      carAudio.playBmwGong();
      void speakText("اتصال به کامپیوتر خودرو از طریق بلوتوث برقرار شد.");
    }
  };

  const handleUsbConnect = async () => {
    carAudio.playButtonTap();
    setEcuBusy(true);
    setEcuStatusMsg(null);
    const res = await carEcuBridge.connectUsbSerialObd(onUpdateCarState);
    setEcuStatusMsg(res.message);
    setEcuBusy(false);
    if (res.ok) {
      carAudio.playBmwGong();
      void speakText("کابل کامپیوتر خودرو متصل شد و سنسورها در حال خواندن هستند.");
    }
  };

  const handleReadAloudEcu = () => {
    carAudio.playBmwGong();
    const summary = buildCarComputerSpokenSummary(carState);
    void speakText(summary);
  };

  const handleTestFaultAlert = () => {
    carAudio.playButtonTap();
    const dtc = carEcuBridge.triggerTestDtcFault("P0300");
    onUpdateCarState({ dtcErrorCount: 1 });
    setEcuStatusMsg(`خطای آزمایشی ${dtc.code} ثبت شد تا واکنش هشدار صوتی جارویز را ببینید.`);
  };

  const handleClearFaults = () => {
    carAudio.playButtonTap();
    carEcuBridge.clearDtcFaults();
    onUpdateCarState({ dtcErrorCount: 0 });
    setEcuStatusMsg("حافظه خطاهای کامپیوتر خودرو پاک شد.");
  };

  const adjustTirePsi = (key: "fl" | "fr" | "rl" | "rr", nextVal: number) => {
    carAudio.playButtonTap();
    onUpdateCarState({
      tpms: {
        ...carState.tpms,
        [key]: Math.max(15, Math.min(45, nextVal)),
      },
    });
  };

  return (
    <div className="flex-1 p-3 sm:p-5 overflow-y-auto flex flex-col gap-4 select-none" dir="rtl">
      {/* Sub-Navigation Strip inside Settings & Car Computer Tab */}
      <div className="cockpit-panel rounded-2xl p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: "ecu" as const, label: "کامپیوتر ماشین (ECU / OBD-II)", icon: Cpu },
          { id: "telemetry" as const, label: "سفر، روغن و نمودار موتور", icon: TrendingUp },
          { id: "visual" as const, label: "ظاهر خودرو، مانیتور و ۳D", icon: Car },
          { id: "schedule" as const, label: "برنامه روزانه", icon: Calendar },
          { id: "system" as const, label: "سیستم، فکتوری و گیت‌هاب", icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              id={`settings-subtab-${item.id}`}
              type="button"
              onClick={() => {
                carAudio.playButtonTap();
                setSubTab(item.id);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                active
                  ? "bmw-accent-btn"
                  : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-tab 1: Real Car Computer / ECU & OBD-II Access */}
      {subTab === "ecu" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Connection & Actions Card */}
          <section className="lg:col-span-5 cockpit-panel-accent rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl border bmw-accent-surface flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">اتصال به کامپیوتر BMW 728Li</h2>
                  <p className="text-[11px] text-amber-100/75 font-mono">{ecuSnap.protocol}</p>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                  ecuSnap.transport === "dme-live-bus"
                    ? "bg-amber-950/60 border-amber-400/40 text-amber-200"
                    : "bg-emerald-950/70 border-emerald-400/60 text-emerald-300"
                }`}
              >
                {ecuSnap.transport === "dme-live-bus" ? "باس زنده خودرو" : "متصل به OBD"}
              </span>
            </div>

            <div className="instrument-well rounded-2xl p-3 text-xs flex flex-col gap-1.5">
              <span className="text-amber-100/70">دستگاه فعال:</span>
              <span className="font-bold text-white font-mono text-[11px]">{ecuSnap.deviceName}</span>
              <span className="text-[11px] text-amber-100/65">
                برای خواندن تمام سنسورهای واقعی موتور M52TUB28 می‌توانید دانگل بلوتوث ELM327 یا کابل USB K+DCAN را وصل کنید:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                id="ecu-connect-bluetooth-btn"
                type="button"
                disabled={ecuBusy}
                onClick={handleBluetoothConnect}
                className="py-2.5 px-3 rounded-xl bmw-accent-btn text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60"
              >
                <Bluetooth className="w-4 h-4" />
                <span>اتصال بلوتوث OBD-II</span>
              </button>

              <button
                id="ecu-connect-usb-btn"
                type="button"
                disabled={ecuBusy}
                onClick={handleUsbConnect}
                className="py-2.5 px-3 rounded-xl hardware-key text-amber-100 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60"
              >
                <Usb className="w-4 h-4 text-sky-300" />
                <span>اتصال کابل USB K+DCAN</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-amber-100/70 px-1">
              <span>بلوتوث OBD: {isWebBluetoothAvailable() ? "پشتیبانی می‌شود" : "نیاز به کروم اندروید"}</span>
              <span>پورت USB: {isWebSerialAvailable() ? "پشتیبانی می‌شود" : "نیاز به OTG / دسکتاپ"}</span>
            </div>

            {ecuStatusMsg && (
              <div className="rounded-xl bg-black/40 border border-amber-300/30 p-3 text-xs text-amber-100">
                {ecuStatusMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.08]">
              <button
                id="ecu-read-aloud-btn"
                type="button"
                onClick={handleReadAloudEcu}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                <span>خواندن کامل با صدای جارویز</span>
              </button>

              {ecuSnap.transport !== "dme-live-bus" && (
                <button
                  type="button"
                  onClick={() => carEcuBridge.disconnect()}
                  className="py-2.5 px-3 rounded-xl hardware-key text-rose-200 text-xs font-bold"
                >
                  قطع اتصال
                </button>
              )}
            </div>

            {/* DTC Fault Codes Section */}
            <div className="instrument-well rounded-2xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 bmw-accent-text" />
                  <span>کدهای خطای کامپیوتر (DTC)</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    id="ecu-test-fault-btn"
                    type="button"
                    onClick={handleTestFaultAlert}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold hover:bg-amber-500/30"
                  >
                    تست خطا و هشدار جارویز
                  </button>
                  <button
                    id="ecu-clear-faults-btn"
                    type="button"
                    onClick={handleClearFaults}
                    className="px-2 py-1 rounded-lg hardware-key text-slate-200 text-[10px] font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>پاک کردن</span>
                  </button>
                </div>
              </div>

              {ecuSnap.dtcCodes.length === 0 && (carState.dtcErrorCount ?? 0) === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>کد خطای فعال در کامپیوتر خودرو وجود ندارد.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ecuSnap.dtcCodes.map((dtc) => (
                    <div
                      key={dtc.code}
                      className="rounded-xl bg-rose-950/60 border border-rose-500/50 p-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="text-rose-100">{dtc.descriptionFa}</span>
                      </div>
                      <span className="font-mono font-black text-rose-300">{dtc.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Live Sensor Grid & TPMS Tire Control */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            <div className="cockpit-panel rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
              <h3 className="text-sm font-bold text-white border-b border-white/[0.08] pb-2.5">
                پارامترهای زنده خوانده‌شده از کامپیوتر BMW (PID Live Stream)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
                {[
                  { label: "دور موتور", val: `${ecuSnap.rpm} RPM`, color: "text-amber-300" },
                  { label: "سرعت خودرو", val: `${ecuSnap.speed} km/h`, color: "text-white" },
                  { label: "دمای آب موتور", val: `${ecuSnap.coolantTemp}°C`, color: ecuSnap.coolantTemp >= 102 ? "text-rose-400" : "text-sky-300" },
                  { label: "فشار روغن", val: `${ecuSnap.oilPressureBar.toFixed(1)} Bar`, color: "text-emerald-400" },
                  { label: "ولتاژ دینام", val: `${ecuSnap.batteryVoltage} V`, color: ecuSnap.batteryVoltage < 12.1 ? "text-rose-400" : "text-emerald-400" },
                  { label: "دمای هوای ورودی", val: `${ecuSnap.intakeAirTemp}°C`, color: "text-amber-200" },
                  { label: "دریچه گاز", val: `${ecuSnap.throttlePercent}%`, color: "text-sky-300" },
                  { label: "سطح سوخت", val: `${ecuSnap.fuelPercent}%`, color: ecuSnap.fuelPercent <= 18 ? "text-rose-400" : "text-amber-300" },
                ].map((item) => (
                  <div key={item.label} className="instrument-well rounded-2xl p-3 flex flex-col gap-1">
                    <span className="text-[11px] font-sans text-amber-100/70">{item.label}</span>
                    <span className={`text-base font-black ${item.color}`} dir="ltr">
                      {item.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full 4-Tire TPMS Monitor */}
            <div className="cockpit-panel rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2">
                  <CircleGauge className="w-4 h-4 bmw-accent-text" />
                  <h3 className="text-sm font-bold text-white">سنسور فشار باد تایرها (TPMS / RDC)</h3>
                </div>
                <span className="text-[11px] text-amber-100/70">در صورت افت فشار کمتر از ۲۸، جارویز اخطار می‌دهد</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: "fr" as const, label: "جلو راست", psi: carState.tpms.fr },
                  { key: "fl" as const, label: "جلو چپ", psi: carState.tpms.fl },
                  { key: "rr" as const, label: "عقب راست", psi: carState.tpms.rr },
                  { key: "rl" as const, label: "عقب چپ", psi: carState.tpms.rl },
                ].map((tire) => {
                  const low = tire.psi < 28;
                  return (
                    <div
                      key={tire.key}
                      className={`rounded-2xl p-3 border flex flex-col gap-2 ${
                        low ? "bg-rose-950/70 border-rose-500" : "instrument-well"
                      }`}
                    >
                      <span className="text-xs font-semibold text-amber-100">{tire.label}</span>
                      <span className={`text-lg font-black font-mono tabular-nums ${low ? "text-rose-300" : "text-emerald-400"}`} dir="ltr">
                        {tire.psi} PSI
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustTirePsi(tire.key, tire.psi - 2)}
                          className="flex-1 py-1 rounded-lg hardware-key text-xs font-bold text-white"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustTirePsi(tire.key, 32)}
                          className="flex-1 py-1 rounded-lg bg-emerald-600/40 hover:bg-emerald-600/60 text-xs font-bold text-emerald-100"
                        >
                          ۳۲
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustTirePsi(tire.key, tire.psi + 1)}
                          className="flex-1 py-1 rounded-lg hardware-key text-xs font-bold text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Sub-tab 2: Trip Meter, Oil Life, Engine Trends Chart, G-Force & Eco Score */}
      {subTab === "telemetry" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Trip Meter */}
            <section className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 bmw-accent-text" />
                  <h3 className="text-sm font-bold text-white">مسافت‌سنج سفر (Trip Meter)</h3>
                </div>
                <button
                  id="trip-meter-reset-btn"
                  type="button"
                  onClick={onResetTrip}
                  className="px-3 py-1.5 rounded-xl hardware-key text-xs font-bold text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ریست</span>
                </button>
              </div>
              <div className="instrument-well rounded-2xl grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.07]">
                <div className="p-3">
                  <span className="text-[11px] text-slate-300 block">مسافت</span>
                  <span id="trip-distance-value" className="text-base font-black font-mono text-white" dir="ltr">
                    {tripDistanceKm.toFixed(2)} km
                  </span>
                </div>
                <div className="p-3">
                  <span className="text-[11px] text-slate-300 block">میانگین سرعت</span>
                  <span id="trip-avg-speed-value" className="text-base font-black font-mono bmw-accent-text" dir="ltr">
                    {averageSpeedKmh.toFixed(1)} km/h
                  </span>
                </div>
                <div className="p-3">
                  <span className="text-[11px] text-slate-300 block">مدت سفر</span>
                  <span id="trip-elapsed-value" className="text-base font-black font-mono text-emerald-400" dir="ltr">
                    {formatTripDuration(tripElapsedSeconds)}
                  </span>
                </div>
              </div>
            </section>

            {/* Oil Life */}
            <section className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 bmw-accent-text" />
                  <div>
                    <h3 className="text-sm font-bold text-white">عمر روغن موتور (BMW LL-01)</h3>
                    <span className="text-[11px] text-slate-400">آخرین سرویس: {oilLastResetDate}</span>
                  </div>
                </div>
                <button
                  id="oil-life-reset-btn"
                  type="button"
                  onClick={() => {
                    onResetOilLife();
                    setOilResetNotice(true);
                    window.setTimeout(() => setOilResetNotice(false), 3000);
                  }}
                  className="px-3 py-1.5 rounded-xl hardware-key text-xs font-bold text-white"
                >
                  ریست سرویس
                </button>
              </div>
              <div className="instrument-well rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-200">عمر باقیمانده:</span>
                  <span id="oil-life-percent-value" className="text-lg font-black font-mono text-emerald-400" dir="ltr">
                    {oilLifePercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${oilLifePercent}%` }} />
                </div>
                {oilResetNotice && (
                  <span className="text-[11px] text-emerald-300">سرویس روغن ثبت و به ۱۰۰٪ بازنشانی شد.</span>
                )}
              </div>
            </section>

            <GForceMeter carState={carState} />
          </div>

          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Engine Health Trends Chart */}
            <section className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                <h3 className="text-sm font-bold text-white">روند فشار روغن و دمای موتور</h3>
                <span className="text-xs font-mono text-amber-300" dir="ltr">
                  {(carState.oilPressureBar ?? 4.0).toFixed(1)} Bar · {carState.engineTemp}°C
                </span>
              </div>
              <div className="h-52 w-full instrument-well rounded-2xl p-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engineTelemetryHistory} margin={{ top: 8, right: 10, left: -12, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: "#cbd5e1", fontSize: 10 }} tickLine={false} />
                    <YAxis yAxisId="temp" domain={[65, 115]} stroke="#f59e0b" tick={{ fill: "#fbbf24", fontSize: 10 }} tickLine={false} unit="°" />
                    <YAxis yAxisId="pressure" orientation="right" domain={[1.0, 6.0]} stroke="#10b981" tick={{ fill: "#34d399", fontSize: 10 }} tickLine={false} unit="b" />
                    <Tooltip contentStyle={{ backgroundColor: "#18100a", borderColor: "rgba(255,255,255,0.15)", borderRadius: "12px", fontSize: "11px" }} />
                    <Line yAxisId="pressure" type="monotone" dataKey="oilPressureBar" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Line yAxisId="temp" type="monotone" dataKey="engineTemp" stroke="#f59e0b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <EcoDrivingScore carState={carState} onUpdateCarState={onUpdateCarState} />
          </div>
        </div>
      )}

      {/* Sub-tab 3: BMW 728Li Visual Showcase, Photos & 3D */}
      {subTab === "visual" && (
        <BmwVisualShowcase
          carState={carState}
          onUpdateCarState={onUpdateCarState}
          currentTrack={currentTrack}
          onOpen3DShowroom={onOpen3DShowroom}
        />
      )}

      {/* Sub-tab 4: Daily Schedule */}
      {subTab === "schedule" && (
        <DailyScheduleWidget
          onNavigateToLocation={onNavigateToMeetingLocation}
          isOnline={carState.isOnline}
        />
      )}

      {/* Sub-tab 5: System Tools, Voice Command Toggle, Diagnostics, Specs, HUD, Factory & GitHub */}
      {subTab === "system" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Global Jarvis Wake-Word Voice Command Toggle + Live Microphone Status Indicator */}
          <div
            id="system-voice-command-card"
            className="cockpit-panel-accent rounded-2xl p-4 sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                  jarvisStandbyEnabled
                    ? jarvisMicStatus === "blocked" || jarvisMicStatus === "unsupported"
                      ? "bg-rose-950/70 border-rose-400/50 text-rose-300"
                      : jarvisStandbyListening || jarvisMicStatus === "listening"
                        ? "bg-emerald-950/75 border-emerald-400/60 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.28)]"
                        : "bg-amber-950/65 border-amber-400/50 text-amber-300"
                    : "bg-black/50 border-white/15 text-slate-400"
                }`}
                aria-hidden="true"
              >
                {jarvisStandbyEnabled &&
                jarvisMicStatus !== "blocked" &&
                jarvisMicStatus !== "unsupported" ? (
                  <Mic className="w-6 h-6" />
                ) : (
                  <MicOff className="w-6 h-6" />
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    فرمان صوتی جارویز (Voice Command)
                  </h3>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {jarvisStandbyEnabled &&
                      (jarvisStandbyListening || jarvisMicStatus === "listening") && (
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    <span
                      id="system-voice-command-mic-status"
                      className={
                        !jarvisStandbyEnabled
                          ? "text-slate-400"
                          : jarvisMicStatus === "blocked" || jarvisMicStatus === "unsupported"
                            ? "text-rose-300"
                            : jarvisStandbyListening || jarvisMicStatus === "listening"
                              ? "text-emerald-300"
                              : "text-amber-300"
                      }
                    >
                      {!jarvisStandbyEnabled
                        ? "میکروفون غیرفعال"
                        : jarvisMicStatus === "blocked"
                          ? "نیاز به دسترسی میکروفون مرورگر"
                          : jarvisMicStatus === "unsupported"
                            ? "تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود"
                            : jarvisMicStatus === "paused_speaking"
                              ? "مکث موقت هنگام پخش صدا"
                              : jarvisStandbyListening || jarvisMicStatus === "listening"
                                ? "میکروفون فعال · شنود بیدارباش «جارویز»"
                                : "در حال آماده‌سازی میکروفون..."}
                    </span>
                    {jarvisStandbyEnabled && micNoiseFilterActive && (
                      <>
                        <span className="text-slate-500" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-teal-300/90">فیلتر نویز کابین فعال</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-amber-100/75">
                  با فعال بودن این گزینه، جارویز در تمام بخش‌های برنامه با گفتن «جارویز» آماده دریافت فرمان صوتی است.
                </p>
              </div>
            </div>

            {onToggleJarvisStandby && (
              <button
                id="settings-system-voice-command-toggle"
                type="button"
                role="switch"
                aria-checked={jarvisStandbyEnabled}
                aria-label="تغییر وضعیت فرمان صوتی جارویز"
                onClick={() => {
                  carAudio.playButtonTap();
                  onToggleJarvisStandby();
                }}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs font-bold transition min-h-[44px] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
                  jarvisStandbyEnabled
                    ? "bg-emerald-950/75 border-emerald-400/60 text-emerald-200 hover:bg-emerald-900/60"
                    : "hardware-key text-slate-300 hover:text-white"
                }`}
              >
                <span>{jarvisStandbyEnabled ? "شنود سراسری فعال" : "شنود سراسری خاموش"}</span>
                <span
                  dir="ltr"
                  className={`w-10 h-5 rounded-full p-0.5 flex items-center transition-colors ${
                    jarvisStandbyEnabled ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow" />
                </span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onOpenFactorySettings();
            }}
            className="cockpit-panel-accent rounded-2xl p-4 text-right flex flex-col gap-2 hover:brightness-110 transition"
          >
            <GitBranch className="w-6 h-6 text-cyan-300" />
            <span className="text-sm font-bold text-white">تنظیمات فکتوری و گیت‌هاب</span>
            <span className="text-xs text-amber-100/75">ارسال کدها به گیت‌هاب، آپدیت OTA مانیتور و کالیبراسیون (رمز ۸۸۸۸)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onOpenDiagnosticsModal();
            }}
            className="cockpit-panel rounded-2xl p-4 text-right flex flex-col gap-2 hover:brightness-110 transition"
          >
            <FileText className="w-6 h-6 bmw-accent-text" />
            <span className="text-sm font-bold text-white">گزارش‌های دیاگ و گفتگوها</span>
            <span className="text-xs text-amber-100/75">مشاهده سابقه ثبت‌شده خطاها و مکالمات راننده با جارویز</span>
          </button>

          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onOpenSpecsModal();
            }}
            className="cockpit-panel rounded-2xl p-4 text-right flex flex-col gap-2 hover:brightness-110 transition"
          >
            <Cpu className="w-6 h-6 text-emerald-300" />
            <span className="text-sm font-bold text-white">مشخصات فنی BMW 728Li</span>
            <span className="text-xs text-amber-100/75">اطلاعات موتور M52TUB28، کامپیوتر DME و سخت‌افزار مانیتور</span>
          </button>

          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onOpen3DShowroom();
            }}
            className="cockpit-panel rounded-2xl p-4 text-right flex flex-col gap-2 hover:brightness-110 transition"
          >
            <Box className="w-6 h-6 text-amber-300" />
            <span className="text-sm font-bold text-white">نمای ۳D تعاملی خودرو</span>
            <span className="text-xs text-amber-100/75">چرخش ۳۶۰ درجه بدنه BMW 728Li و شبیه‌سازی بزرگراه</span>
          </button>

          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onToggleStealthHud();
            }}
            className="cockpit-panel rounded-2xl p-4 text-right flex flex-col gap-2 hover:brightness-110 transition sm:col-span-2 lg:col-span-4"
          >
            <Activity className="w-6 h-6 text-amber-400" />
            <span className="text-sm font-bold text-white">حالت رانندگی شبانه (Head-Up Display)</span>
            <span className="text-xs text-amber-100/75">نمایش مینیمال سرعت و هشدارها روی شیشه در رانندگی شبانه</span>
          </button>
        </div>
      )}
    </div>
  );
}
