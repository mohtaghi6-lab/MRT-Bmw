export interface CarState {
  speed: number;
  maxSpeed: number;
  rpm: number;
  fuelPercent: number;
  batteryVoltage: number;
  engineTemp: number;
  coolantTemp?: number;
  outsideTemp: number; // دمای بیرون خودرو
  intakeTemp?: number; // دمای هوای ورودی مانیفولد
  oilPressureBar?: number; // فشار روغن موتور BMW
  rangeKm?: number; // مسافت باقیمانده با باک بنزین
  gear?: "P" | "R" | "N" | "D" | "S";
  doorsLocked: boolean;
  hazardActive: boolean;
  leftSignal: boolean;
  rightSignal: boolean;
  headlightsActive: boolean;
  highBeamActive: boolean;
  fogLightsActive: boolean;
  acActive: boolean;
  acTemp: number;
  acFanSpeed: number;
  acMode: "auto" | "face" | "feet" | "defrost";
  windowsOpen: { fl: boolean; fr: boolean; rl: boolean; rr: boolean };
  sunroofOpen: boolean;
  tpms: { fl: number; fr: number; rl: number; rr: number };
  musicPlaying: boolean;
  volume: number;
  isOnline: boolean;
  driveMode: "comfort" | "eco" | "sport" | "adaptive";
  airSuspensionLevel?: "low" | "normal" | "high";
  ambientLightingColor?: import("./utils/ambientThemes").AmbientLightingThemeId;
  ambientLightingBrightness?: number;
  stealthHudActive?: boolean;
  alwaysListening?: boolean;
  currentTrackIndex?: number;
  ecuConnected?: boolean;
  ecuType?: "BMW Bosch DME MS42 / MEVD17" | "Siemens Continental" | "Bosch ME17";
  carModel?: string;
  obdProtocol?: string;
  dtcErrorCount?: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  actionTriggered?: string;
  actionDetails?: string;
  isOffline?: boolean;
}

export interface POI {
  id: string;
  name: string;
  type: "fuel" | "cng" | "hospital" | "mechanic" | "parking" | "restaurant" | "mall";
  distance: string;
  address: string;
  lat: number;
  lng: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url?: string;
  cover?: string;
  isFlash?: boolean;
  fileSize?: string;
  fileName?: string;
}

export interface NavigationRoute {
  origin?: string;
  destination: string;
  distance: string;
  duration: string;
  nextTurn: string;
  turnDistance: string;
  speedLimit: number;
  eta: string;
}

export interface RecordedTurn {
  id: string;
  sender: "driver" | "assistant";
  text: string;
  timestamp: string;
}

export interface RecordedSession {
  id: string;
  startTime: string;
  endTime?: string;
  title: string;
  turns: RecordedTurn[];
  turnCount: number;
  savedAt: string;
  summary?: string;
}

export interface AiAssistantStatus {
  status: "connected" | "fallback" | "checking";
  model: string;
  latencyMs?: number;
  apiKeyPrefix?: string;
  error?: string;
}

export interface EngineTelemetryPoint {
  time: string;
  elapsedSec: number;
  oilPressureBar: number;
  engineTemp: number;
}

export interface PreConditioningSchedule {
  enabled: boolean;
  targetTime: string;
  targetTemp: number;
  repeatDaily: boolean;
  lastTriggeredDate?: string;
}
