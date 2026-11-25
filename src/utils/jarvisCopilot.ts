import { CarState } from "../types";
import { carEcuBridge } from "./carEcuBridge";

export interface TimeGreetingInfo {
  period: "morning" | "noon" | "evening" | "night";
  labelFa: string;
  greetingText: string;
}

export interface CopilotAlert {
  id: string;
  severity: "warning" | "critical" | "info";
  category: "fatigue" | "night" | "day" | "mechanical";
  title: string;
  spokenMessage: string;
  quickActionLabel?: string;
  quickActionType?: "headlights_on" | "ac_on" | "open_nav" | "ack_rest" | "open_ecu";
}

export function getTimeOfDayGreeting(now: Date = new Date()): TimeGreetingInfo {
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      period: "morning",
      labelFa: "صبح بخیر",
      greetingText:
        "سلام و صبح بخیر راننده عزیز! ب‌ام‌و ۷۲۸ روشن و تمام سیستم‌ها آماده حرکت هستند. روز پرانرژی و سفر بی‌خطری داشته باشید.",
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      period: "noon",
      labelFa: "وقت بخیر",
      greetingText:
        "سلام و ظهر بخیر راننده عزیز! وقتتان بخیر، تمام سیستم‌های هوشمند ب‌ام‌و ۷۲۸ در وضعیت ایده‌آل و آماده حرکت هستند.",
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      period: "evening",
      labelFa: "عصر بخیر",
      greetingText:
        "سلام و عصر بخیر راننده عزیز! هوا رو به غروب است، سیستم‌های کمکی و روشنایی ب‌ام‌و ۷۲۸ در خدمت شما هستند.",
    };
  }

  return {
    period: "night",
    labelFa: "شب بخیر",
    greetingText:
      "سلام و شب بخیر راننده عزیز! سیستم دید در شب و کنترل ایمنی ب‌ام‌و ۷۲۸ فعال هستند. با آرامش و ایمنی برانید.",
  };
}

export function evaluateCopilotAlerts(
  carState: CarState,
  continuousDrivingSeconds: number,
  now: Date = new Date()
): CopilotAlert[] {
  const alerts: CopilotAlert[] = [];
  const hour = now.getHours();
  const isNight = hour >= 18 || hour < 6;
  const isDayPeakHeat = hour >= 11 && hour <= 16;
  const ecuSnap = carEcuBridge.getSnapshot();

  // 1. ECU / DME Fault Codes (DTC)
  const dtcCount = Math.max(ecuSnap.dtcCodes.length, carState.dtcErrorCount ?? 0);
  if (dtcCount > 0) {
    const firstCode = ecuSnap.dtcCodes[0];
    alerts.push({
      id: `ecu-dtc-${firstCode?.code || dtcCount}`,
      severity: "critical",
      category: "mechanical",
      title: `خطای کامپیوتر ماشین (${firstCode?.code || `${dtcCount} DTC`})`,
      spokenMessage: firstCode
        ? `راننده عزیز، جارویز صدا می‌زند! کامپیوتر موتور یک خطا ثبت کرده: کد ${firstCode.code}، ${firstCode.descriptionFa}. لطفاً بخش کامپیوتر ماشین را بررسی کنید.`
        : `راننده عزیز، جارویز صدا می‌زند! تعداد ${dtcCount} خطا در کامپیوتر موتور خودرو شناسایی شد. لطفاً بررسی بفرمایید.`,
      quickActionLabel: "باز کردن کامپیوتر ماشین",
      quickActionType: "open_ecu",
    });
  }

  // 2. Engine Overheating Alert
  if (carState.engineTemp >= 102) {
    alerts.push({
      id: "high-coolant-temp",
      severity: "critical",
      category: "mechanical",
      title: `اخطار دمای بالای موتور (${carState.engineTemp}°C)`,
      spokenMessage: `راننده عزیز، جارویز هشدار می‌دهد! دمای آب موتور به ${carState.engineTemp} درجه رسیده و بالاست. لطفاً کنار بزنید و سیستم خنک‌کننده را بررسی کنید.`,
      quickActionLabel: "بررسی دما در ECU",
      quickActionType: "open_ecu",
    });
  }

  // 3. Low Oil Pressure Alert
  if ((carState.oilPressureBar ?? 4.0) < 2.2) {
    alerts.push({
      id: "low-oil-pressure",
      severity: "critical",
      category: "mechanical",
      title: "افت فشار روغن موتور",
      spokenMessage: `راننده عزیز، جارویز صدا می‌زند! فشار روغن موتور به ${(carState.oilPressureBar ?? 2.0).toFixed(1)} بار کاهش یافته. لطفاً موتور را بررسی و کنار توقف کنید.`,
      quickActionLabel: "مشاهده کامپیوتر ماشین",
      quickActionType: "open_ecu",
    });
  }

  // 4. Low Battery / Alternator Voltage Alert
  if (carState.batteryVoltage < 12.1) {
    alerts.push({
      id: "low-battery-voltage",
      severity: "critical",
      category: "mechanical",
      title: `افت ولتاژ باتری (${carState.batteryVoltage}V)`,
      spokenMessage: `راننده عزیز، جارویز اطلاع می‌دهد: ولتاژ باتری و دینام به ${carState.batteryVoltage} ولت افت کرده است. سیستم شارژ خودرو را چک کنید.`,
      quickActionLabel: "بررسی ولتاژ در ECU",
      quickActionType: "open_ecu",
    });
  }

  // 5. Tire Pressure Drop (TPMS / RDC)
  const tireEntries: Array<{ key: string; label: string; psi: number }> = [
    { key: "fl", label: "جلو چپ", psi: carState.tpms?.fl ?? 32 },
    { key: "fr", label: "جلو راست", psi: carState.tpms?.fr ?? 32 },
    { key: "rl", label: "عقب چپ", psi: carState.tpms?.rl ?? 32 },
    { key: "rr", label: "عقب راست", psi: carState.tpms?.rr ?? 32 },
  ];
  const lowTires = tireEntries.filter((t) => t.psi < 28);
  if (lowTires.length > 0) {
    const names = lowTires.map((t) => `${t.label} (${t.psi} PSI)`).join(" و ");
    alerts.push({
      id: `low-tpms-${lowTires.map((t) => t.key).join("-")}`,
      severity: "critical",
      category: "mechanical",
      title: `کم‌باد بودن تایر (${lowTires.map((t) => t.label).join("، ")})`,
      spokenMessage: `راننده عزیز، جارویز صدا می‌زند! فشار باد لاستیک ${names} پایین آمده است. لطفاً باد تایر را تنظیم کنید.`,
      quickActionLabel: "بررسی تایرها",
      quickActionType: "open_ecu",
    });
  }

  // 6. Night Headlights Safety Alert
  if (isNight && carState.speed > 8 && !carState.headlightsActive) {
    alerts.push({
      id: "night-headlights-off",
      severity: "critical",
      category: "night",
      title: "اخطار شب: چراغ‌های جلو خاموش است",
      spokenMessage:
        "راننده عزیز، جارویز صدا می‌زند! هوا تاریک است اما چراغ‌های جلو خاموش هستند. همین الان چراغ‌ها را روشن کنید.",
      quickActionLabel: "روشن کردن چراغ جلو",
      quickActionType: "headlights_on",
    });
  }

  // 7. Low Fuel Alert
  if (carState.fuelPercent <= 18) {
    alerts.push({
      id: "low-fuel-alert",
      severity: "critical",
      category: "mechanical",
      title: `اخطار سطح پایین سوخت (${carState.fuelPercent}%)`,
      spokenMessage: `راننده عزیز، جارویز اطلاع می‌دهد: تنها ${carState.fuelPercent} درصد بنزین باقی مانده است. به نزدیک‌ترین پمپ‌بنزین بروید.`,
      quickActionLabel: "مسیریابی پمپ‌بنزین",
      quickActionType: "open_nav",
    });
  }

  // 8. Continuous Driving Fatigue Check
  const fatigueThresholdSec = isNight ? 35 * 60 : 75 * 60;
  if (continuousDrivingSeconds >= fatigueThresholdSec && carState.speed > 5) {
    const mins = Math.round(continuousDrivingSeconds / 60);
    alerts.push({
      id: `fatigue-${Math.floor(continuousDrivingSeconds / 1800)}`,
      severity: "warning",
      category: "fatigue",
      title: "هشدار خستگی و استراحت در مسیر",
      spokenMessage: isNight
        ? `راننده عزیز، جارویز صحبت می‌کنه! ${mins} دقیقه است در شب بدون توقف رانندگی می‌کنید. لطفاً در جای امن بزنید کنار و استراحت کنید.`
        : `راننده عزیز، جارویز صحبت می‌کنه! الان ${mins} دقیقه است مداوم رانندگی می‌کنید. اگر خسته هستید کنار بزنید و کمی استراحت کنید.`,
      quickActionLabel: "الان استراحت می‌کنم",
      quickActionType: "ack_rest",
    });
  }

  // 9. Night High-Speed Alert
  if (isNight && carState.speed >= 125) {
    alerts.push({
      id: "night-high-speed",
      severity: "warning",
      category: "night",
      title: "هشدار سرعت شبانه",
      spokenMessage: `راننده عزیز، سرعت شما در شب به ${carState.speed} کیلومتر بر ساعت رسیده؛ با احتیاط بیشتری رانندگی کنید.`,
    });
  }

  // 10. Day Peak Heat / Cabin Thermal Alert
  if (isDayPeakHeat && carState.outsideTemp >= 34 && !carState.acActive) {
    alerts.push({
      id: "day-heat-ac-off",
      severity: "info",
      category: "day",
      title: "اخطار گرمای روز و تهویه کابین",
      spokenMessage: `راننده عزیز، دمای بیرون به ${carState.outsideTemp} درجه رسیده و کولر خاموش است. برای آرامش بیشتر تهویه را روشن کنید.`,
      quickActionLabel: "روشن کردن کولر",
      quickActionType: "ac_on",
    });
  }

  return alerts;
}
