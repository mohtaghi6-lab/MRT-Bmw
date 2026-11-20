import { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  BatteryCharging,
  Sun,
  Gauge,
  Music,
  Sliders,
  Compass,
  FileText,
  Activity,
  Mic,
  Volume2,
  Box,
} from "lucide-react";
import { CarState } from "../types";
import { carAudio } from "../utils/carSpeech";
import { PWAInstallButton } from "./PWAInstallButton";
import AnalogClock from "./AnalogClock";

interface CarHeaderProps {
  carState: CarState;
  onToggleOnline: () => void;
  onOpenSpecs: () => void;
  onOpenFactorySettings?: () => void;
  onOpenDatabase: () => void;
  onToggleStealthHud: () => void;
  onOpenVoiceAssistant?: () => void;
  onOpen3DShowroom?: () => void;
  isSpeaking?: boolean;
  activeTab: "dash" | "nav" | "controls" | "media";
  setActiveTab: (tab: "dash" | "nav" | "controls" | "media") => void;
  onUpdateDriveMode?: (mode: "comfort" | "eco" | "sport" | "adaptive") => void;
}

export default function CarHeader({
  carState,
  onToggleOnline,
  onOpenSpecs,
  onOpenDatabase,
  onToggleStealthHud,
  onOpenVoiceAssistant,
  onOpen3DShowroom,
  isSpeaking,
  activeTab,
  setActiveTab,
}: CarHeaderProps) {
  return (
    <header
      id="car-system-header"
      className="bg-[#060910]/92 backdrop-blur-xl border-b border-white/[0.08] text-slate-100 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 select-none z-30 relative"
      dir="rtl"
    >
      {/* BMW M-Sport Top Precision Hairline */}
      <div className="absolute top-0 left-0 right-0 h-[2px] flex pointer-events-none">
        <div className="w-1/3 bg-[#0066b2]" />
        <div className="w-1/3 bg-[#1d4ed8]" />
        <div className="w-1/3 bg-[#e21a24]" />
      </div>

      {/* Zone 1: Brand Lockup & Primary Navigation */}
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <button
          id="car-specs-trigger"
          onClick={() => {
            carAudio.playButtonTap();
            onOpenSpecs();
          }}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.04] transition active:scale-95 group shrink-0"
          title="مشخصات فنی و سیستم‌های BMW 728Li (DME، موتور M52TUB28 و iDrive)"
        >
          {/* Authentic BMW Roundel Emblem SVG */}
          <div className="w-8 h-8 rounded-full bg-neutral-950 border border-white/30 p-0.5 shadow-[0_0_16px_rgba(0,102,178,0.28)] flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="48" fill="#0b0e14" stroke="#cbd5e1" strokeWidth="3" />
              <text x="50" y="22" fill="#fff" fontSize="12" fontWeight="900" textAnchor="middle" letterSpacing="2">
                BMW
              </text>
              <circle cx="50" cy="58" r="28" fill="#000" stroke="#fff" strokeWidth="2" />
              <path d="M 50 58 L 50 30 A 28 28 0 0 1 78 58 Z" fill="#0066b2" />
              <path d="M 50 58 L 50 86 A 28 28 0 0 1 22 58 Z" fill="#0066b2" />
              <path d="M 50 58 L 22 58 A 28 28 0 0 1 50 30 Z" fill="#ffffff" />
              <path d="M 50 58 L 78 58 A 28 28 0 0 1 50 86 Z" fill="#ffffff" />
            </svg>
          </div>

          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-extrabold tracking-wide text-sm text-white font-mono">BMW 728Li</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-[11px] font-mono bmw-accent-text font-semibold">iDrive</span>
            </div>
            <span className="text-[10px] text-slate-400 block font-mono tracking-tight">
              E38 Executive Cockpit
            </span>
          </div>
        </button>

        {/* Clean Segmented Cockpit Nav */}
        <nav className="flex items-center gap-1 instrument-well p-1 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { id: "dash" as const, domId: "tab-btn-dash", label: "کاکپیت راننده", icon: Gauge },
            { id: "nav" as const, domId: "tab-btn-nav", label: "ناوبری GPS", icon: Compass },
            { id: "controls" as const, domId: "tab-btn-controls", label: "تنظیمات خودرو", icon: Sliders },
            { id: "media" as const, domId: "tab-btn-media", label: "سیستم صوتی", icon: Music },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={tab.domId}
                onClick={() => {
                  carAudio.playButtonTap();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bmw-accent-btn font-bold"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04] font-medium"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Zone 2: Live BMW Analog Chronometer Clock & Telemetry Strip */}
      <div className="hidden md:flex items-center gap-3.5 instrument-well px-3 py-1.5 rounded-xl shrink-0">
        <AnalogClock variant="compact" showDate showDigitalSub />

        <div className="hidden xl:block w-px h-7 bg-white/10" />

        <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono tabular-nums">
          <div className="flex items-center gap-1.5 text-amber-300" title="دمای محیط خارجی BMW 728Li">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>{carState.outsideTemp ?? 24}°C</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400" title="ولتاژ دینام EfficientDynamics">
            <BatteryCharging className="w-3.5 h-3.5" />
            <span>{carState.batteryVoltage}V</span>
          </div>
        </div>
      </div>

      {/* Zone 3: Quick Cockpit Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenVoiceAssistant && (
          <button
            id="header-voice-assistant-trigger"
            onClick={() => {
              carAudio.playBmwGong();
              onOpenVoiceAssistant();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs transition active:scale-95 whitespace-nowrap shrink-0 ${
              isSpeaking
                ? "bg-amber-500 text-slate-950 border-amber-300 animate-pulse shadow-amber-500/40"
                : "bmw-accent-btn bmw-accent-border hover:brightness-110"
            }`}
            title="گفتگوی سریع با دستیار هوشمند صوتی BMW 728Li"
          >
            {isSpeaking ? (
              <Volume2 className="w-4 h-4 animate-spin text-slate-950" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isSpeaking ? "در حال پخش..." : "دستیار صوتی"}</span>
          </button>
        )}

        <button
          id="database-modal-trigger"
          onClick={() => {
            carAudio.playButtonTap();
            onOpenDatabase();
          }}
          className="hardware-key flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-200 hover:text-white text-xs font-medium active:scale-95 whitespace-nowrap shrink-0"
          title="گزارش دیاگ DME و سیستم‌های ایمنی BMW 728Li"
        >
          <FileText className="w-3.5 h-3.5 bmw-accent-text" />
          <span className="hidden md:inline">دیاگ DME</span>
        </button>

        <button
          id="toggle-online-btn"
          onClick={() => {
            carAudio.playButtonTap();
            onToggleOnline();
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap shrink-0 ${
            carState.isOnline
              ? "bg-emerald-950/50 border-emerald-500/35 text-emerald-300 hover:bg-emerald-900/40"
              : "bg-amber-950/50 border-amber-500/35 text-amber-300 hover:bg-amber-900/40"
          }`}
          title="BMW ConnectedDrive وضعیت اتصال"
        >
          {carState.isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">آنلاین</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">آفلاین</span>
            </>
          )}
        </button>

        <PWAInstallButton />

        {onOpen3DShowroom && (
          <button
            id="header-3d-showroom-btn"
            onClick={() => {
              carAudio.playButtonTap();
              onOpen3DShowroom();
            }}
            className="hardware-key flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-200 hover:text-white text-xs font-semibold active:scale-95 whitespace-nowrap shrink-0"
            title="نمایش سه‌بعدی تعاملی BMW 728Li (استودیو و بزرگراه)"
          >
            <Box className="w-3.5 h-3.5 bmw-accent-text" />
            <span className="hidden sm:inline">نمای ۳D</span>
          </button>
        )}

        <button
          id="header-hud-btn"
          onClick={() => {
            carAudio.playButtonTap();
            onToggleStealthHud();
          }}
          className="hardware-key flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-amber-300 text-xs font-semibold active:scale-95 whitespace-nowrap shrink-0"
          title="BMW Head-Up Display (حالت رانندگی شبانه)"
        >
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">HUD</span>
        </button>
      </div>
    </header>
  );
}
