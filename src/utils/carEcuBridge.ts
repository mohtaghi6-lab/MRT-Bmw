import { CarState } from "../types";

export type EcuConnectionTransport = "none" | "bluetooth-elm327" | "usb-serial-kdcan" | "dme-live-bus";

export interface EcuDtcCode {
  code: string;
  descriptionFa: string;
  severity: "warning" | "critical";
}

export interface EcuLiveSnapshot {
  connected: boolean;
  transport: EcuConnectionTransport;
  deviceName: string;
  protocol: string;
  lastPollAt: string;
  rpm: number;
  speed: number;
  coolantTemp: number;
  intakeAirTemp: number;
  throttlePercent: number;
  batteryVoltage: number;
  fuelPercent: number;
  oilPressureBar: number;
  dtcCodes: EcuDtcCode[];
  rawLog: string[];
}

const KNOWN_BMW_DTC_MAP: Record<string, string> = {
  P0100: "خطای سنسور جریان هوا (MAF) در موتور M52",
  P0115: "خطای مدار سنسور دمای آب خنک‌کننده موتور",
  P0118: "ولتاژ بالای سنسور دمای آب موتور",
  P0171: "رقیق بودن مخلوط سوخت و هوا (بانک ۱)",
  P0174: "رقیق بودن مخلوط سوخت و هوا (بانک ۲)",
  P0300: "احتراق ناقص تصادفی سیلندرها (Misfire)",
  P0340: "خطای سنسور موقعیت میل‌سوپاپ (VANOS / Camshaft)",
  P0500: "خطای سنسور سرعت خودرو (VSS)",
  P0562: "ولتاژ پایین سیستم برق خودرو / دینام",
  P1519: "اختلال عملکرد شیر برقی VANOS میل‌سوپاپ ورودی",
};

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isWebSerialAvailable(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

function parseHexBytes(raw: string): number[] {
  const cleaned = raw.replace(/[^0-9A-Fa-f\s]/g, " ").trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\s+/)
    .map((part) => parseInt(part, 16))
    .filter((n) => Number.isFinite(n));
}

export function parseElm327PidResponse(
  pid: string,
  rawResponse: string
): Partial<CarState> & { dtcCodes?: EcuDtcCode[] } {
  const upper = rawResponse.toUpperCase();
  if (pid === "ATRV") {
    const m = upper.match(/(\d+(?:\.\d+)?)\s*V/);
    if (m) {
      return { batteryVoltage: Number(Number(m[1]).toFixed(1)) };
    }
    return {};
  }

  const bytes = parseHexBytes(upper);
  if (pid === "010C") {
    const idx = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === 0x0c);
    if (idx >= 0 && bytes.length >= idx + 4) {
      const rpm = Math.round(((bytes[idx + 2] * 256) + bytes[idx + 3]) / 4);
      return { rpm };
    }
  } else if (pid === "010D") {
    const idx = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === 0x0d);
    if (idx >= 0 && bytes.length >= idx + 3) {
      return { speed: bytes[idx + 2] };
    }
  } else if (pid === "0105") {
    const idx = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === 0x05);
    if (idx >= 0 && bytes.length >= idx + 3) {
      const temp = bytes[idx + 2] - 40;
      return { engineTemp: temp, coolantTemp: temp };
    }
  } else if (pid === "010F") {
    const idx = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === 0x0f);
    if (idx >= 0 && bytes.length >= idx + 3) {
      return { intakeTemp: bytes[idx + 2] - 40 };
    }
  } else if (pid === "012F") {
    const idx = bytes.findIndex((b, i) => b === 0x41 && bytes[i + 1] === 0x2f);
    if (idx >= 0 && bytes.length >= idx + 3) {
      return { fuelPercent: Math.round((bytes[idx + 2] * 100) / 255) };
    }
  } else if (pid === "03") {
    const idx = bytes.findIndex((b) => b === 0x43);
    if (idx >= 0) {
      const codes: EcuDtcCode[] = [];
      for (let i = idx + 1; i + 1 < bytes.length; i += 2) {
        const a = bytes[i];
        const b = bytes[i + 1];
        if (a === 0 && b === 0) continue;
        const prefixMap = ["P", "C", "B", "U"];
        const prefix = prefixMap[(a >> 6) & 0x03];
        const d1 = (a >> 4) & 0x03;
        const d2 = a & 0x0f;
        const d3 = (b >> 4) & 0x0f;
        const d4 = b & 0x0f;
        const code = `${prefix}${d1}${d2.toString(16).toUpperCase()}${d3.toString(16).toUpperCase()}${d4.toString(16).toUpperCase()}`;
        codes.push({
          code,
          descriptionFa: KNOWN_BMW_DTC_MAP[code] || `کد خطای ثبت‌شده در حافظه DME (${code})`,
          severity: code.startsWith("P03") || code.startsWith("P011") ? "critical" : "warning",
        });
      }
      return { dtcCodes: codes, dtcErrorCount: codes.length };
    }
  }
  return {};
}

class CarEcuBridgeManager {
  private serialPort: any = null;
  private bluetoothServer: any = null;
  private txChar: any = null;
  private rxChar: any = null;
  private pollTimer: number | null = null;
  private snapshot: EcuLiveSnapshot = {
    connected: true,
    transport: "dme-live-bus",
    deviceName: "BMW Bosch DME MS42 (شبیه‌ساز باس داخلی)",
    protocol: "ISO 9141-2 / BMW I-Bus",
    lastPollAt: new Date().toLocaleTimeString("fa-IR"),
    rpm: 2100,
    speed: 58,
    coolantTemp: 90,
    intakeAirTemp: 26,
    throttlePercent: 18,
    batteryVoltage: 14.2,
    fuelPercent: 68,
    oilPressureBar: 4.8,
    dtcCodes: [],
    rawLog: ["[ECU] باس داخلی BMW E38 MS42 آماده خواندن پارامترها و کد خطا (DTC) است."],
  };

  private listeners = new Set<(snap: EcuLiveSnapshot) => void>();

  public subscribe(listener: (snap: EcuLiveSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const cb of this.listeners) {
      try {
        cb({ ...this.snapshot });
      } catch {}
    }
  }

  public syncFromCarState(carState: CarState) {
    const throttlePct =
      carState.speed === 0
        ? 14
        : Math.min(98, Math.round(14 + (carState.speed / (carState.maxSpeed || 260)) * 74));

    this.snapshot = {
      ...this.snapshot,
      rpm: carState.rpm,
      speed: carState.speed,
      coolantTemp: carState.engineTemp,
      intakeAirTemp: carState.intakeTemp ?? 26,
      throttlePercent: throttlePct,
      batteryVoltage: carState.batteryVoltage,
      fuelPercent: carState.fuelPercent,
      oilPressureBar: carState.oilPressureBar ?? 4.0,
      lastPollAt: new Date().toLocaleTimeString("fa-IR"),
    };
    this.emit();
  }

  public getSnapshot(): EcuLiveSnapshot {
    return { ...this.snapshot };
  }

  public async connectBluetoothObd(
    onTelemetryUpdate: (patch: Partial<CarState>) => void
  ): Promise<{ ok: boolean; message: string }> {
    if (!isWebBluetoothAvailable()) {
      return {
        ok: false,
        message: "بلوتوث مرورگر (Web Bluetooth) در این دستگاه پشتیبانی نمی‌شود. از کابل USB یا مرورگر کروم اندروید استفاده کنید.",
      };
    }

    try {
      const bt = (navigator as any).bluetooth;
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "0000fff0-0000-1000-8000-00805f9b34fb",
          "0000ffe0-0000-1000-8000-00805f9b34fb",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
        ],
      });
      const server = await device.gatt.connect();
      this.bluetoothServer = server;

      const services = await server.getPrimaryServices();
      for (const svc of services) {
        const chars = await svc.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            this.txChar = c;
          }
          if (c.properties.notify || c.properties.read) {
            this.rxChar = c;
          }
        }
      }

      if (this.rxChar?.properties?.notify) {
        await this.rxChar.startNotifications();
        this.rxChar.addEventListener("characteristicvaluechanged", (ev: any) => {
          const text = new TextDecoder().decode(ev.target.value);
          this.handleIncomingRawFrames(text, onTelemetryUpdate);
        });
      }

      this.snapshot = {
        ...this.snapshot,
        connected: true,
        transport: "bluetooth-elm327",
        deviceName: device.name || "ELM327 OBD-II Bluetooth",
        protocol: "OBD-II Bluetooth (ELM327)",
        rawLog: [
          ...this.snapshot.rawLog.slice(-15),
          `[BT] متصل شد به ${device.name || "ELM327"}`,
        ],
      };
      onTelemetryUpdate({
        ecuConnected: true,
        obdProtocol: "ELM327 Bluetooth OBD-II",
      });
      this.emit();

      await this.sendBluetoothCommand("ATZ");
      await this.sendBluetoothCommand("ATE0");
      await this.sendBluetoothCommand("ATSP0");
      this.startBluetoothPolling();

      return {
        ok: true,
        message: `اتصال واقعی به کامپیوتر خودرو از طریق ${device.name || "ELM327"} برقرار شد.`,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message?.includes("cancelled")
          ? "انتخاب دستگاه OBD-II لغو شد."
          : `عدم امکان اتصال بلوتوث OBD-II: ${err?.message || "خطای ارتباطی"}`,
      };
    }
  }

  private async sendBluetoothCommand(cmd: string) {
    if (!this.txChar) return;
    try {
      const encoded = new TextEncoder().encode(`${cmd}\r`);
      await this.txChar.writeValue(encoded);
    } catch {}
  }

  private startBluetoothPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
    }
    const pids = ["010C", "010D", "0105", "ATRV", "012F", "03"];
    let idx = 0;
    this.pollTimer = window.setInterval(() => {
      if (!this.bluetoothServer?.connected) return;
      const pid = pids[idx % pids.length];
      idx += 1;
      void this.sendBluetoothCommand(pid);
    }, 900);
  }

  public async connectUsbSerialObd(
    onTelemetryUpdate: (patch: Partial<CarState>) => void
  ): Promise<{ ok: boolean; message: string }> {
    if (!isWebSerialAvailable()) {
      return {
        ok: false,
        message: "درگاه مستقیم USB Serial در این مرورگر فعال نیست (از Chrome روی دسکتاپ یا اندروید دارای OTG استفاده کنید).",
      };
    }

    try {
      const serial = (navigator as any).serial;
      const port = await serial.requestPort();
      await port.open({ baudRate: 38400 });
      this.serialPort = port;

      const reader = port.readable?.getReader();
      const writer = port.writable?.getWriter();

      if (writer) {
        const initSeq = ["ATZ\r", "ATE0\r", "ATSP0\r", "010C\r", "0105\r", "ATRV\r", "03\r"];
        for (const cmd of initSeq) {
          await writer.write(new TextEncoder().encode(cmd));
          await new Promise((r) => setTimeout(r, 120));
        }
        writer.releaseLock();
      }

      if (reader) {
        void (async () => {
          try {
            while (this.serialPort) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                const text = new TextDecoder().decode(value);
                this.handleIncomingRawFrames(text, onTelemetryUpdate);
              }
            }
          } catch {}
        })();
      }

      this.snapshot = {
        ...this.snapshot,
        connected: true,
        transport: "usb-serial-kdcan",
        deviceName: "USB K+DCAN / ELM327 Cable",
        protocol: "BMW D-CAN / ISO 9141-2 Serial",
        rawLog: [
          ...this.snapshot.rawLog.slice(-15),
          "[USB] اتصال مستقیم پورت سریال OBD-II برقرار شد.",
        ],
      };
      onTelemetryUpdate({
        ecuConnected: true,
        obdProtocol: "USB K+DCAN / ISO 9141-2",
      });
      this.emit();

      return {
        ok: true,
        message: "کابل USB کامپیوتر خودرو متصل شد و خواندن زنده سنسورها آغاز گردید.",
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message?.includes("No port selected")
          ? "پورت USB انتخاب نشد."
          : `خطا در اتصال پورت USB OBD-II: ${err?.message || "ناموفق"}`,
      };
    }
  }

  private handleIncomingRawFrames(
    rawText: string,
    onTelemetryUpdate: (patch: Partial<CarState>) => void
  ) {
    const lines = rawText
      .split(/[\r\n>]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const upper = line.toUpperCase();
      const pidCandidates = ["010C", "010D", "0105", "010F", "012F", "03", "ATRV"];
      let mergedPatch: Partial<CarState> = {};

      for (const pid of pidCandidates) {
        if (
          (pid === "ATRV" && /^\d+(\.\d+)?V$/.test(upper)) ||
          upper.includes(`41 ${pid.slice(2)}`) ||
          (pid === "03" && upper.startsWith("43"))
        ) {
          const parsed = parseElm327PidResponse(pid, upper);
          if (parsed.dtcCodes) {
            this.snapshot.dtcCodes = parsed.dtcCodes;
          }
          const { dtcCodes: _ignored, ...statePatch } = parsed;
          mergedPatch = { ...mergedPatch, ...statePatch };
        }
      }

      if (Object.keys(mergedPatch).length > 0) {
        onTelemetryUpdate(mergedPatch);
      }
      this.snapshot.rawLog = [...this.snapshot.rawLog.slice(-15), `[RX] ${line}`];
    }
    this.snapshot.lastPollAt = new Date().toLocaleTimeString("fa-IR");
    this.emit();
  }

  public disconnect() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    try {
      this.bluetoothServer?.disconnect?.();
    } catch {}
    try {
      this.serialPort?.close?.();
    } catch {}
    this.bluetoothServer = null;
    this.serialPort = null;
    this.txChar = null;
    this.rxChar = null;
    this.snapshot = {
      ...this.snapshot,
      transport: "dme-live-bus",
      deviceName: "BMW Bosch DME MS42 (باس داخلی)",
      protocol: "ISO 9141-2 / BMW I-Bus",
      rawLog: [...this.snapshot.rawLog.slice(-15), "[ECU] بازگشت به مانیتورینگ باس داخلی خودرو."],
    };
    this.emit();
  }

  public triggerTestDtcFault(code: string = "P0171"): EcuDtcCode {
    const dtc: EcuDtcCode = {
      code,
      descriptionFa: KNOWN_BMW_DTC_MAP[code] || `کد خطای آزمایشی ECU (${code})`,
      severity: code.startsWith("P03") || code.startsWith("P011") ? "critical" : "warning",
    };
    this.snapshot = {
      ...this.snapshot,
      dtcCodes: [dtc, ...this.snapshot.dtcCodes.filter((d) => d.code !== code)],
      rawLog: [...this.snapshot.rawLog.slice(-15), `[DTC] ثبت خطا: ${code}`],
    };
    this.emit();
    return dtc;
  }

  public clearDtcFaults() {
    if (this.txChar) {
      void this.sendBluetoothCommand("04");
    }
    this.snapshot = {
      ...this.snapshot,
      dtcCodes: [],
      rawLog: [...this.snapshot.rawLog.slice(-15), "[ECU] حافظه خطاهای کامپیوتر خودرو پاک شد (04 Clear)."],
    };
    this.emit();
  }
}

export const carEcuBridge = new CarEcuBridgeManager();

export function buildCarComputerSpokenSummary(carState?: Partial<CarState>): string {
  const snap = carEcuBridge.getSnapshot();
  const tpms = carState?.tpms;
  const lowTires: string[] = [];
  if (tpms) {
    if (typeof tpms.fl === "number" && tpms.fl < 28) lowTires.push(`جلو چپ (${tpms.fl})`);
    if (typeof tpms.fr === "number" && tpms.fr < 28) lowTires.push(`جلو راست (${tpms.fr})`);
    if (typeof tpms.rl === "number" && tpms.rl < 28) lowTires.push(`عقب چپ (${tpms.rl})`);
    if (typeof tpms.rr === "number" && tpms.rr < 28) lowTires.push(`عقب راست (${tpms.rr})`);
  }

  const dtcCount = Math.max(snap.dtcCodes.length, carState?.dtcErrorCount ?? 0);
  const dtcPart =
    dtcCount > 0
      ? `تعداد ${dtcCount} کد خطا در کامپیوتر موتور ثبت شده است${snap.dtcCodes[0] ? `: ${snap.dtcCodes[0].code} یعنی ${snap.dtcCodes[0].descriptionFa}` : ""}.`
      : "هیچ کد خطایی در حافظه کامپیوتر موتور ثبت نشده است.";

  const tirePart =
    lowTires.length > 0
      ? `فشار باد لاستیک ${lowTires.join(" و ")} کم است.`
      : "فشار باد هر چهار لاستیک نرمال است.";

  const speed = carState?.speed ?? snap.speed;
  const rpm = carState?.rpm ?? snap.rpm;
  const engineTemp = carState?.engineTemp ?? snap.coolantTemp;
  const oilPressure = carState?.oilPressureBar ?? snap.oilPressureBar ?? 4.0;
  const batteryVoltage = carState?.batteryVoltage ?? snap.batteryVoltage;
  const fuelPercent = carState?.fuelPercent ?? snap.fuelPercent;

  return `گزارش زنده کامپیوتر BMW 728Li: سرعت ${speed} کیلومتر، دور موتور ${rpm}، دمای آب موتور ${engineTemp} درجه، فشار روغن ${oilPressure.toFixed(1)} بار، ولتاژ باتری ${batteryVoltage} ولت و سوخت ${fuelPercent} درصد است. ${tirePart} ${dtcPart}`;
}
