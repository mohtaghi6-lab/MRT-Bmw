import { CarState } from "../types";

export interface HeadunitMonitorProfile {
  calibratedAt: string;
  triggerReason: "auto-install" | "appinstalled" | "manual";
  environment: "android-apk" | "pwa-standalone" | "car-headunit" | "browser";
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: "landscape" | "portrait";
  matchedResolutionLabel: string;
  uiScale: number;
  canProtocol: string;
  dspPreset: string;
  brightnessProfile: string;
  signature: string;
}

const HEADUNIT_PROFILE_STORAGE_KEY = "bmw728li_headunit_profile_v1";

const STALE_TEMP_KEYS = [
  "bmw728li_temp_ui_cache",
  "bmw728li_last_route_draft",
  "bmw728li_audio_override",
  "bmw728li_sw_stale_flag",
];

export function detectHeadunitEnvironment(): {
  environment: HeadunitMonitorProfile["environment"];
  isCarOrInstalledApp: boolean;
} {
  if (typeof window === "undefined") {
    return { environment: "browser", isCarOrInstalledApp: false };
  }

  const ua = (window.navigator.userAgent || "").toLowerCase();
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const isAndroidWebView =
    ua.includes("; wv)") ||
    (ua.includes("android") && ua.includes("version/") && !ua.includes("chrome/"));

  if (hostname === "bmw728li.local" || isAndroidWebView) {
    return { environment: "android-apk", isCarOrInstalledApp: true };
  }

  if (params.get("car_install") === "1" || params.get("headunit") === "1") {
    return { environment: "car-headunit", isCarOrInstalledApp: true };
  }

  if (isStandalone) {
    return { environment: "pwa-standalone", isCarOrInstalledApp: true };
  }

  // Automotive landscape headunits (typical 1024x600, 1280x720, 1920x720 Android car screens)
  const w = window.screen?.width || window.innerWidth;
  const h = window.screen?.height || window.innerHeight;
  const aspect = w / Math.max(1, h);
  if (ua.includes("android") && w >= 960 && aspect >= 1.55) {
    return { environment: "car-headunit", isCarOrInstalledApp: true };
  }

  return { environment: "browser", isCarOrInstalledApp: false };
}

export function computeMonitorProfile(
  triggerReason: HeadunitMonitorProfile["triggerReason"]
): HeadunitMonitorProfile {
  const screenWidth = typeof window !== "undefined" ? window.screen?.width || window.innerWidth : 1280;
  const screenHeight = typeof window !== "undefined" ? window.screen?.height || window.innerHeight : 720;
  const devicePixelRatio = typeof window !== "undefined" ? Number((window.devicePixelRatio || 1).toFixed(2)) : 1;
  const orientation: "landscape" | "portrait" = screenWidth >= screenHeight ? "landscape" : "portrait";
  const aspect = screenWidth / Math.max(1, screenHeight);

  let matchedResolutionLabel = `${screenWidth}x${screenHeight} Automotive HD (60Hz)`;
  let uiScale = 1;

  if (aspect >= 2.2) {
    matchedResolutionLabel = `${screenWidth}x${screenHeight} Ultrawide BMW iDrive (60Hz)`;
    uiScale = 1;
  } else if (screenWidth <= 1024 && orientation === "landscape") {
    matchedResolutionLabel = `${screenWidth}x${screenHeight} Car Headunit Touch Fit`;
    uiScale = 0.94;
  } else if (screenWidth >= 1920) {
    matchedResolutionLabel = `${screenWidth}x${screenHeight} Full HD Headunit Native`;
    uiScale = 1.02;
  }

  const { environment } = detectHeadunitEnvironment();
  const signature = `${environment}:${screenWidth}x${screenHeight}@${devicePixelRatio}:${orientation}`;

  return {
    calibratedAt: new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    triggerReason,
    environment,
    screenWidth,
    screenHeight,
    devicePixelRatio,
    orientation,
    matchedResolutionLabel,
    uiScale,
    canProtocol: "BMW CAN-Bus / I-Bus MUX (500 kbps D-CAN)",
    dspPreset: "BMW Harman Kardon / Hi-Fi DSP Acoustic",
    brightnessProfile: "Day 90% / Night 30% Anti-Glare",
    signature,
  };
}

export function loadSavedHeadunitProfile(): HeadunitMonitorProfile | null {
  try {
    const raw = localStorage.getItem(HEADUNIT_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HeadunitMonitorProfile;
  } catch {
    return null;
  }
}

export function applyMonitorCssCalibration(profile: HeadunitMonitorProfile) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--headunit-scale", String(profile.uiScale));
  root.dataset.headunitEnv = profile.environment;
  root.dataset.headunitOrientation = profile.orientation;

  const ua = typeof navigator !== "undefined" ? (navigator.userAgent || "").toLowerCase() : "";
  if (
    ua.includes("android") ||
    profile.environment === "android-apk" ||
    profile.environment === "car-headunit"
  ) {
    root.dataset.androidPerf = "lite";
  }
}

export function runMonitorAutoResetAndMatch(
  triggerReason: HeadunitMonitorProfile["triggerReason"]
): {
  profile: HeadunitMonitorProfile;
  matchedCarState: Partial<CarState>;
} {
  // 1. Reset stale temporary monitor/UI caches without erasing user logs, GitHub, or oil life
  try {
    for (const key of STALE_TEMP_KEYS) {
      localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch {}

  // 2. Compute and persist matched monitor configuration
  const profile = computeMonitorProfile(triggerReason);
  applyMonitorCssCalibration(profile);

  try {
    localStorage.setItem(HEADUNIT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}

  // 3. Match car headunit telemetry & audio/lighting parameters to BMW 728Li baseline
  const matchedCarState: Partial<CarState> = {
    ecuConnected: true,
    ecuType: "BMW Bosch DME MS42 / MEVD17",
    carModel: "BMW 728Li iDrive ID6",
    obdProtocol: "BMW D-CAN / ISO 14229",
    dtcErrorCount: 0,
    outsideTemp: 22,
    intakeTemp: 26,
    batteryVoltage: 14.2,
    engineTemp: 90,
    oilPressureBar: 4.8,
    acActive: true,
    acTemp: 22,
    acMode: "auto",
    ambientLightingBrightness: 85,
    volume: 65,
    stealthHudActive: false,
  };

  return { profile, matchedCarState };
}

export function shouldAutoRunHeadunitCalibration(): boolean {
  const { isCarOrInstalledApp } = detectHeadunitEnvironment();
  if (!isCarOrInstalledApp) return false;
  const saved = loadSavedHeadunitProfile();
  if (!saved) return true;
  const current = computeMonitorProfile("auto-install");
  // Re-run automatically if screen resolution or install mode changed (e.g. transferred to car monitor)
  return saved.signature !== current.signature;
}
