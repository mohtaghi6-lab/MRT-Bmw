import { CarState, NavigationRoute } from "../types";

export function normalizePersianText(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove arabic diacritics
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/\u200c/g, " ") // zero-width non-joiner to space
    .replace(/[\u0640]/g, "") // tatweel
    .replace(/[!?.،,:؛؟_—\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface OfflineCommandResult {
  matched: boolean;
  action: string;
  reply: string;
  updatedState?: Partial<CarState>;
  isMrtEnd?: boolean;
  navigationData?: Partial<NavigationRoute>;
}

export function parseOfflineCarCommand(
  rawInput: string,
  currentState: CarState,
  recentHistory?: Array<{ role: string; text: string }>
): OfflineCommandResult {
  const input = normalizePersianText(rawInput);

  // 0.05 App Reset Command ("ریست برنامه" / "ریست")
  const isResetCommand =
    input === "ریست" ||
    input === "ریست برنامه" ||
    input === "ریستارت" ||
    input === "برنامه ریست" ||
    input === "سیستم ریست" ||
    input === "reset" ||
    input.includes("ریست") ||
    input.includes("ریستارت") ||
    input.includes("تنظیمات اولیه") ||
    input.includes("تنظیم مجدد");

  if (isResetCommand) {
    return {
      matched: true,
      action: "reset_app",
      reply: "سیستم خودرو و برنامه با موفقیت ریست شد و تمامی مقادیر به حالت اولیه بازگشتند.",
    };
  }

  // 0.1 Explicit MRT End-Conversation Check ("ام آر تی" / "MRT")
  const isMrtEnd =
    input === "mrt" ||
    input === "ام آر تی" ||
    input === "ام ار تی" ||
    input === "ام‌آرتی" ||
    input === "امار تی" ||
    input === "امارتی" ||
    input === "m r t" ||
    input === "m.r.t" ||
    input === "پایان ام آر تی" ||
    input === "ام ار تی خداحافظ";

  if (isMrtEnd) {
    return {
      matched: true,
      action: "mrt_end",
      reply: "ام آر تی دریافت شد. پایان مکالمه، سفرتون بی‌خطر!",
      isMrtEnd: true,
    };
  }

  // 0.12 Start Recording Conversation in Database ("مکالمه رو ضبط کن")
  if (
    input.includes("مکالمه رو ضبط کن") ||
    input.includes("مکالمه را ضبط کن") ||
    input.includes("مکالمات را ذخیره کن") ||
    input.includes("مکالمات رو ذخیره کن") ||
    input.includes("مکالمه ضبط کن") ||
    input.includes("ضبط مکالمه") ||
    input.includes("مکالمه رو سیو کن") ||
    input === "ضبط کن"
  ) {
    return {
      matched: true,
      action: "start_recording",
      reply: "چشم راننده عزیز، ضبط مکالمه آغاز شد و در دیتابیس خودرو ذخیره می‌شود.",
    };
  }

  // 0.14 Navigation Route commands & Contextual "راه رو نشون بده" / "جی پی اس" / "نقشه"
  const isRouteRequest =
    input.includes("مسیر") ||
    input.includes("مسیریابی") ||
    input.includes("راه") ||
    input.includes("برو به") ||
    input.includes("نقشه") ||
    input.includes("جی پی اس") ||
    input.includes("gps") ||
    input.includes("نشونم بده") ||
    input.includes("نشون بده") ||
    input === "جی پی اس" ||
    input === "نقشه" ||
    input === "راه";

  if (isRouteRequest) {
    // Check cities
    const hasShiraz = input.includes("شیراز") || (recentHistory && recentHistory.some((h) => h.text.includes("شیراز")));
    const hasIsfahan = input.includes("اصفهان") || (recentHistory && recentHistory.some((h) => h.text.includes("اصفهان")));
    const hasTehran = input.includes("تهران") || (recentHistory && recentHistory.some((h) => h.text.includes("تهران")));
    const hasMashhad = input.includes("مشهد") || (recentHistory && recentHistory.some((h) => h.text.includes("مشهد")));
    const hasRasht = input.includes("رشت") || (recentHistory && recentHistory.some((h) => h.text.includes("رشت")));
    const hasTabriz = input.includes("تبریز") || (recentHistory && recentHistory.some((h) => h.text.includes("تبریز")));

    if (hasTehran && hasMashhad) {
      return {
        matched: true,
        action: "navigate",
        reply: "مسیر تهران به مشهد مقدس به طول ۹۰۰ کیلومتر (حدود ۱۰ ساعت) روی مانیتور نمایش داده شد.",
        navigationData: {
          origin: "تهران",
          destination: "مشهد مقدس",
          distance: "۹۰۰ کیلومتر",
          duration: "۱۰ ساعت",
          nextTurn: "وارد بزرگراه امام رضا (ع) به سمت سمنان و شاهرود شوید.",
          turnDistance: "۱.۲ کیلومتر",
          speedLimit: 110,
          eta: "۲۲:۰۰",
        },
      };
    } else if (hasTehran && hasRasht) {
      return {
        matched: true,
        action: "navigate",
        reply: "مسیر تهران به رشت و شمال به طول ۳۲۰ کیلومتر (حدود ۳ ساعت و ۴۵ دقیقه) روی مانیتور فعال شد.",
        navigationData: {
          origin: "تهران",
          destination: "رشت",
          distance: "۳۲۰ کیلومتر",
          duration: "۳ ساعت و ۴۵ دقیقه",
          nextTurn: "از آزادراه قزوین-رشت به سمت منجیل و رودبار ادامه دهید.",
          turnDistance: "۵۰۰ متر",
          speedLimit: 100,
          eta: "۱۵:۴۵",
        },
      };
    } else if (hasTehran && hasTabriz) {
      return {
        matched: true,
        action: "navigate",
        reply: "مسیر تهران به تبریز به طول ۶۳۰ کیلومتر (حدود ۶ ساعت و ۳۰ دقیقه) روی مانیتور تنظیم گردید.",
        navigationData: {
          origin: "تهران",
          destination: "تبریز",
          distance: "۶۳۰ کیلومتر",
          duration: "۶ ساعت و ۳۰ دقیقه",
          nextTurn: "در آزادراه پیامبر اعظم (زنجان-تبریز) ادامه مسیر دهید.",
          turnDistance: "۱.۵ کیلومتر",
          speedLimit: 120,
          eta: "۱۸:۳۰",
        },
      };
    } else if (hasTehran && hasIsfahan) {
      return {
        matched: true,
        action: "navigate",
        reply: "مسیر تهران به اصفهان به طول ۴۴۰ کیلومتر (حدود ۴ ساعت و ۳۰ دقیقه) روی مانیتور نمایش داده شد.",
        navigationData: {
          origin: "تهران",
          destination: "اصفهان",
          distance: "۴۴۰ کیلومتر",
          duration: "۴ ساعت و ۳۰ دقیقه",
          nextTurn: "وارد آزادراه خلیج فارس (تهران-قم-کاشان) به سمت اصفهان شوید.",
          turnDistance: "۸۰۰ متر",
          speedLimit: 120,
          eta: "۱۶:۳۰",
        },
      };
    } else {
      // Default / Shiraz to Isfahan / General "راه رو نشون بده"
      return {
        matched: true,
        action: "navigate",
        reply: "چشم راننده عزیز، نقشه راه و وضعیت زنده مسیر شیراز به اصفهان روی مانیتور فعال و نمایش داده شد.",
        navigationData: {
          origin: "شیراز",
          destination: "اصفهان",
          distance: "۴۸۵ کیلومتر",
          duration: "۵ ساعت و ۲۰ دقیقه",
          nextTurn: "در بزرگراه خلیج فارس به سمت آباده و اصفهان ادامه دهید.",
          turnDistance: "۳۰۰ متر",
          speedLimit: 110,
          eta: "۱۷:۳۰",
        },
      };
    }
  }

  // 0.15 Mic check / "صدای من رو داری"
  const isMicCheck =
    input.includes("صدای من رو داری") ||
    input.includes("صدامو داری") ||
    input.includes("صدام رو داری") ||
    input.includes("صدای منو داری") ||
    input.includes("میشنوی صدامو") ||
    input.includes("میشنوی منو") ||
    input.includes("صدام میاد") ||
    input.includes("صدای من میاد") ||
    input.includes("میکروفون وصله") ||
    input.includes("صدامو میشنوی");

  if (isMicCheck) {
    return {
      matched: true,
      action: "mic_check",
      reply: "بله راننده عزیز! صداتون رو کاملاً واضح و شفاف دارم، بفرمایید در خدمتم.",
    };
  }

  // 0.2 Stealth HUD / Minimal Driving Screen Toggle
  if (
    input.includes("حالت مخفی رو روشن کن") ||
    input.includes("صفحه مانیتور رو ببند") ||
    input.includes("حالت هود رو فعال کن") ||
    input.includes("محافظ صفحه رو روشن کن")
  ) {
    const nextHud = !currentState.stealthHudActive;
    return {
      matched: true,
      action: "toggle_stealth_hud",
      reply: nextHud
        ? "حالت رانندگی بدون صفحه فعال شد."
        : "نمایش کامل داشبورد بازگردانی شد.",
      updatedState: { stealthHudActive: nextHud },
    };
  }

  // 0.3 Flash USB Music Player Commands (Requires explicit command action words)
  if (
    input.includes("پخش آهنگ های فلش") ||
    input.includes("آهنگ های فلش رو بذار") ||
    input.includes("آهنگ های فلش رو پخش کن") ||
    input.includes("فلش مموری رو باز کن") ||
    input.includes("فلش رو پخش کن") ||
    input.includes("آهنگ فلش رو روشن کن") ||
    input.includes("موزیک های فلش")
  ) {
    return {
      matched: true,
      action: "play_flash",
      reply: "آهنگ‌های حافظه فلش USB در حال پخش هستند.",
      updatedState: { musicPlaying: true },
    };
  }

  // 1. Hazard Lights (جفت راهنما / فلاشر)
  if (
    input.includes("جفت راهنما") ||
    input.includes("فلاشر") ||
    input.includes("چراغ خطر") ||
    input.includes("چراغ اضطراری")
  ) {
    if (
      input.includes("خاموش") ||
      input.includes("قطع") ||
      input.includes("ببند")
    ) {
      return {
        matched: true,
        action: "hazard_off",
        reply: "جفت راهنما (فلاشر) خاموش شد.",
        updatedState: { hazardActive: false },
      };
    } else if (
      input.includes("روشن") ||
      input.includes("بزن") ||
      input.includes("فعال")
    ) {
      return {
        matched: true,
        action: "hazard_on",
        reply: "جفت راهنما (فلاشر) روشن شد.",
        updatedState: { hazardActive: true },
      };
    } else {
      const nextHazard = !currentState.hazardActive;
      return {
        matched: true,
        action: "toggle_hazard",
        reply: nextHazard
          ? "جفت راهنما روشن شد."
          : "جفت راهنما خاموش شد.",
        updatedState: { hazardActive: nextHazard },
      };
    }
  }

  // 2. Central Door Locking (قفل درها)
  if (
    input.includes("قفل درها") ||
    input.includes("درهای ماشین رو قفل کن") ||
    input.includes("درها رو ببند") ||
    input.includes("درها رو قفل کن") ||
    input.includes("قفل مرکزی")
  ) {
    return {
      matched: true,
      action: "lock_doors",
      reply: "درهای خودرو با موفقیت قفل امنیتی شدند.",
      updatedState: { doorsLocked: true },
    };
  }

  if (
    input.includes("درها رو باز کن") ||
    input.includes("قفل درها رو باز کن") ||
    input.includes("قفل مرکزی رو باز کن")
  ) {
    return {
      matched: true,
      action: "unlock_doors",
      reply: "قفل مرکزی درها باز شد.",
      updatedState: { doorsLocked: false },
    };
  }

  // 3. Climate Control / AC / Heater (کولر و بخاری)
  if (input.includes("کولر رو روشن کن") || input.includes("کولر روشن") || input.includes("کولر رو بزن")) {
    return {
      matched: true,
      action: "ac_on",
      reply: `کولر روشن شد و دما روی ${currentState.acTemp} درجه تنظیم گردید.`,
      updatedState: { acActive: true },
    };
  }

  if (input.includes("کولر رو خاموش کن") || input.includes("کولر خاموش") || input.includes("تهویه رو خاموش کن")) {
    return {
      matched: true,
      action: "ac_off",
      reply: "سیستم تهویه مطبوع خاموش شد.",
      updatedState: { acActive: false },
    };
  }

  if (input.includes("بخاری رو روشن کن") || input.includes("بخاری روشن") || input.includes("بخاری رو بزن")) {
    return {
      matched: true,
      action: "ac_on",
      reply: `بخاری خودرو روشن شد و دمای کابین گرم شد.`,
      updatedState: { acActive: true, acTemp: 26 },
    };
  }

  // 4. Music Player Controls
  if (
    input.includes("موزیک رو قطع کن") ||
    input.includes("آهنگ رو قطع کن") ||
    input.includes("موزیک رو متوقف کن") ||
    input.includes("آهنگ رو متوقف کن") ||
    input.includes("موزیک رو خاموش کن") ||
    input.includes("موسیقی رو قطع کن")
  ) {
    return {
      matched: true,
      action: "pause_music",
      reply: "پخش موسیقی متوقف شد.",
      updatedState: { musicPlaying: false },
    };
  }

  if (
    input.includes("آهنگ بعدی") ||
    input.includes("برو آهنگ بعدی") ||
    input.includes("ترک بعدی") ||
    input.includes("موزیک بعدی")
  ) {
    return {
      matched: true,
      action: "next_music",
      reply: "آهنگ بعدی در حال پخش است.",
      updatedState: { musicPlaying: true },
    };
  }

  if (
    input.includes("آهنگ قبلی") ||
    input.includes("برو آهنگ قبلی") ||
    input.includes("ترک قبلی") ||
    input.includes("موزیک قبلی")
  ) {
    return {
      matched: true,
      action: "prev_music",
      reply: "آهنگ قبلی پخش شد.",
      updatedState: { musicPlaying: true },
    };
  }

  // 5. Headlights
  if (input.includes("چراغ‌ها رو روشن کن") || input.includes("چراغ جلو رو روشن کن")) {
    return {
      matched: true,
      action: "headlights_on",
      reply: "چراغ‌های جلو روشن شدند.",
      updatedState: { headlightsActive: true },
    };
  }

  if (input.includes("چراغ‌ها رو خاموش کن") || input.includes("چراغ جلو رو خاموش کن")) {
    return {
      matched: true,
      action: "headlights_off",
      reply: "چراغ‌های جلو خاموش شدند.",
      updatedState: { headlightsActive: false },
    };
  }

  // 6. Outside Ambient Temperature (دمای هوای بیرون و سنسور محیطی BMW 728Li)
  if (
    input.includes("دمای بیرون") ||
    input.includes("هوای بیرون") ||
    input.includes("دمای محیط") ||
    input.includes("بیرون چقدره") ||
    input.includes("دمای هوا") ||
    input.includes("هوا چطوره") ||
    input.includes("سنسور دمای محیط") ||
    input === "دمای بیرون" ||
    input === "دمای محیط"
  ) {
    const temp = currentState.outsideTemp || 22;
    return {
      matched: true,
      action: "check_outside_temp",
      reply: `دمای هوای بیرون طبق سنسور محیطی ب‌ام‌و، ${temp} درجه سانتی‌گراد است.`,
    };
  }

  // 6.1 Engine Coolant Temperature (دمای آب موتور و رادیاتور)
  if (
    input.includes("دمای آب موتور") ||
    input.includes("دمای موتور") ||
    input.includes("دمای آب") ||
    input.includes("آب ماشین") ||
    input.includes("آب رادیاتور") ||
    input.includes("موتور داغ نکرده")
  ) {
    const engTemp = currentState.engineTemp || 90;
    return {
      matched: true,
      action: "check_engine_temp",
      reply: `دمای آب موتور شش سیلندر ب‌ام‌و ${engTemp} درجه سانتی‌گراد و سیستم خنک‌کننده در وضعیت ایده‌آل کار می‌کند.`,
    };
  }

  // 6.2 BMW 728Li DME & OBD2 Computer Status (دیاگ و کامپیوتر ب‌ام‌و)
  if (
    input.includes("کامپیوتر ماشین") ||
    input.includes("وضعیت ecu") ||
    input.includes("وضعیت ایسیو") ||
    input.includes("وضعیت dme") ||
    input.includes("ایسیو") ||
    input.includes("dme") ||
    input.includes("ecu") ||
    input.includes("دیاگ") ||
    input.includes("بی ام و") ||
    input.includes("ب ام و") ||
    input.includes("bmw") ||
    input.includes("وانوس") ||
    input.includes("خطای موتور") ||
    input.includes("خطای دیاگ")
  ) {
    return {
      matched: true,
      action: "check_ecu_diag",
      reply: "ارتباط با کامپیوتر Bosch DME ب‌ام‌و 728Li برقرار است. سیستم Double-VANOS سالم بوده و هیچ کد خطایی (DTC) در حافظه ثبت نشده است.",
    };
  }

  // 6.3 Fuel Level Check
  if (
    input.includes("بنزین چقدر داریم") ||
    input.includes("وضعیت بنزین") ||
    input.includes("چقدر بنزین داریم") ||
    input.includes("بنزین چطوره") ||
    input.includes("میزان بنزین") ||
    input.includes("باک بنزین") ||
    input === "بنزین"
  ) {
    const fuel = currentState.fuelPercent || 65;
    return {
      matched: true,
      action: "check_fuel",
      reply: `باک بنزین ${fuel} درصد پر است و حدود ۴۲۰ کیلومتر پیمایش باقی مانده است.`,
    };
  }

  // 6.4 Speed Check
  if (
    input.includes("سرعت چقدره") ||
    input.includes("سرعت ماشین") ||
    input.includes("سرعتمون چنده") ||
    input.includes("سرعت چنده") ||
    input === "سرعت"
  ) {
    const spd = currentState.speed || 0;
    return {
      matched: true,
      action: "check_speed",
      reply: `سرعت فعلی خودرو ${spd} کیلومتر بر ساعت است.`,
    };
  }

  // 6.5 Car Diagnostics & General Status
  if (
    input.includes("وضعیت ماشین چطوره") ||
    input.includes("گزارش وضعیت ماشین") ||
    input.includes("گزارش وضعیت") ||
    input.includes("وضعیت خودرو") ||
    input.includes("دمای ماشین چنده") ||
    input.includes("وضعیت کلی") ||
    input === "وضعیت ماشین" ||
    input === "وضعیت خودرو"
  ) {
    const outT = currentState.outsideTemp || 22;
    const engT = currentState.engineTemp || 90;
    return {
      matched: true,
      action: "check_status",
      reply: `سرعت ${currentState.speed} کیلومتر بر ساعت، بنزین ${currentState.fuelPercent} درصد، دمای بیرون ${outT} درجه و دمای موتور ${engT} درجه است. تمامی سیستم‌های BMW 728Li در وضعیت ایده‌آل و آماده حرکت هستند.`,
    };
  }

  return {
    matched: false,
    action: "none",
    reply: "",
  };
}
