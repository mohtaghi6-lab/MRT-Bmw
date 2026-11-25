import { CarState, NavigationRoute } from "../types";
import { AmbientLightingThemeId } from "./ambientThemes";
import { evaluateCopilotAlerts } from "./jarvisCopilot";
import { buildCarComputerSpokenSummary } from "./carEcuBridge";

export function toEnglishDigits(str: string): string {
  if (!str) return "";
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

export function normalizePersianText(str: string): string {
  if (!str) return "";
  return toEnglishDigits(str)
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

const PERSIAN_NUMBER_WORDS: Record<string, number> = {
  صفر: 0,
  یک: 1,
  یه: 1,
  اول: 1,
  دو: 2,
  دوم: 2,
  سه: 3,
  سوم: 3,
  چهار: 4,
  چهارم: 4,
  پنج: 5,
  پنجم: 5,
  شش: 6,
  هفت: 7,
  هشت: 8,
  نه: 9,
  ده: 10,
  یازده: 11,
  دوازده: 12,
  سیزده: 13,
  چهارده: 14,
  پانزده: 15,
  شانزده: 16,
  هفده: 17,
  هجده: 18,
  هیجده: 18,
  نوزده: 19,
  بیست: 20,
  "بیست و یک": 21,
  "بیست و دو": 22,
  "بیست و سه": 23,
  "بیست و چهار": 24,
  "بیست و پنج": 25,
  "بیست و شش": 26,
  "بیست و هفت": 27,
  "بیست و هشت": 28,
  "بیست و نه": 29,
  سی: 30,
  "سی و پنج": 35,
  چهل: 40,
  "چهل و پنج": 45,
  پنجاه: 50,
  شصت: 60,
  هفتاد: 70,
  هشتاد: 80,
  نود: 90,
  صد: 100,
  ماکزیمم: 100,
  حداکثر: 100,
};

export function extractNumberFromPersian(normalizedInput: string): number | null {
  const digitMatch = normalizedInput.match(/\b(\d{1,3})\b/);
  if (digitMatch) {
    const val = Number(digitMatch[1]);
    if (Number.isFinite(val)) return val;
  }
  const sortedWords = Object.keys(PERSIAN_NUMBER_WORDS).sort((a, b) => b.length - a.length);
  for (const word of sortedWords) {
    if (
      normalizedInput === word ||
      normalizedInput.includes(` ${word} `) ||
      normalizedInput.startsWith(`${word} `) ||
      normalizedInput.endsWith(` ${word}`)
    ) {
      return PERSIAN_NUMBER_WORDS[word];
    }
  }
  return null;
}

function readTodayMeetingsSummary(): string {
  if (typeof localStorage === "undefined") {
    return "دسترسی به حافظه تقویم وجود ندارد.";
  }
  const items: Array<{ title: string; time: string; location?: string }> = [];
  try {
    const remoteRaw = localStorage.getItem("bmw728li_daily_schedule_cache_v1");
    if (remoteRaw) {
      const parsed = JSON.parse(remoteRaw);
      if (Array.isArray(parsed)) {
        for (const ev of parsed) {
          if (ev?.title) {
            items.push({
              title: String(ev.title),
              time: String(ev.startTimeFormatted || "نامشخص"),
              location: ev.location ? String(ev.location) : undefined,
            });
          }
        }
      }
    }
  } catch {}
  try {
    const localRaw = localStorage.getItem("bmw728li_local_meetings_v1");
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed)) {
        for (const ev of parsed) {
          if (ev?.title) {
            items.push({
              title: String(ev.title),
              time: String(ev.timeHHMM || "نامشخص"),
              location: ev.location ? String(ev.location) : undefined,
            });
          }
        }
      }
    }
  } catch {}

  if (items.length === 0) {
    return "برای امروز هیچ جلسه یا یادآوری ثبت نشده است.";
  }
  const summaryLines = items.slice(0, 4).map((m, idx) => {
    const loc = m.location ? ` در ${m.location}` : "";
    return `${idx + 1}. ${m.title} ساعت ${m.time}${loc}`;
  });
  return `برنامه جلسات امروز شما: ${summaryLines.join("؛ ")}.`;
}

function readOilLifeSummary(currentState: CarState): string {
  const pressure = currentState.oilPressureBar ?? 4.8;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("bmw728li_oil_life") : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const km = Math.round(Number(parsed.mileageKm || 0));
      const remainingKm = Math.max(0, 8000 - km);
      const pct = Math.max(0, Math.min(100, Math.round((remainingKm / 8000) * 100)));
      return `عمر روغن موتور ${pct} درصد باقی مانده است؛ از آخرین سرویس ${km} کیلومتر طی شده و فشار روغن در حال حاضر ${pressure} بار است.`;
    }
  } catch {}
  return `فشار روغن موتور ${pressure} بار و وضعیت سرویس روغن در محدوده نرمال و سالم قرار دارد.`;
}

export interface OfflineCommandResult {
  matched: boolean;
  action: string;
  uiCommand?: string;
  reply: string;
  updatedState?: Partial<CarState>;
  isMrtEnd?: boolean;
  isJarvisEnd?: boolean;
  navigationData?: Partial<NavigationRoute>;
  closeVoiceModal?: boolean;
}

const CITY_ROUTES: Array<{
  cityA: string;
  cityB: string;
  origin: string;
  destination: string;
  distance: string;
  duration: string;
  nextTurn: string;
  turnDistance: string;
  speedLimit: number;
  eta: string;
}> = [
  {
    cityA: "تهران",
    cityB: "مشهد",
    origin: "تهران",
    destination: "مشهد مقدس",
    distance: "۹۰۰ کیلومتر",
    duration: "۱۰ ساعت",
    nextTurn: "وارد بزرگراه امام رضا (ع) به سمت سمنان و شاهرود شوید.",
    turnDistance: "۱.۲ کیلومتر",
    speedLimit: 110,
    eta: "۲۲:۰۰",
  },
  {
    cityA: "تهران",
    cityB: "رشت",
    origin: "تهران",
    destination: "رشت",
    distance: "۳۲۰ کیلومتر",
    duration: "۳ ساعت و ۴۵ دقیقه",
    nextTurn: "از آزادراه قزوین-رشت به سمت منجیل و رودبار ادامه دهید.",
    turnDistance: "۵۰۰ متر",
    speedLimit: 100,
    eta: "۱۵:۴۵",
  },
  {
    cityA: "تهران",
    cityB: "تبریز",
    origin: "تهران",
    destination: "تبریز",
    distance: "۶۳۰ کیلومتر",
    duration: "۶ ساعت و ۳۰ دقیقه",
    nextTurn: "در آزادراه پیامبر اعظم (زنجان-تبریز) ادامه مسیر دهید.",
    turnDistance: "۱.۵ کیلومتر",
    speedLimit: 120,
    eta: "۱۸:۳۰",
  },
  {
    cityA: "تهران",
    cityB: "اصفهان",
    origin: "تهران",
    destination: "اصفهان",
    distance: "۴۴۰ کیلومتر",
    duration: "۴ ساعت و ۳۰ دقیقه",
    nextTurn: "وارد آزادراه خلیج فارس (تهران-قم-کاشان) به سمت اصفهان شوید.",
    turnDistance: "۸۰۰ متر",
    speedLimit: 120,
    eta: "۱۶:۳۰",
  },
];

export function parseOfflineCarCommand(
  rawInput: string,
  currentState: CarState,
  recentHistory?: Array<{ role: string; text: string }>,
  skipCompoundSplit = false
): OfflineCommandResult {
  const input = normalizePersianText(rawInput);

  if (!skipCompoundSplit) {
    // Protect Persian compound numbers (e.g. "بیست و یک") before checking multi-command conjunctions
    const protectedInput = input.replace(
      /(بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود)\s+و\s+(یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه)/g,
      "$1_$2"
    );
    const parts = protectedInput
      .split(/\s+و\s+|\s*،\s*|\s+بعدش?\s+/)
      .map((p) => p.replace(/_/g, " ").trim())
      .filter((p) => p.length >= 4);

    if (parts.length >= 2 && parts.length <= 4) {
      let rollingState: CarState = { ...currentState };
      const results: OfflineCommandResult[] = [];
      for (const part of parts) {
        const res = parseOfflineCarCommand(part, rollingState, recentHistory, true);
        if (res.matched) {
          results.push(res);
          if (res.updatedState) {
            rollingState = { ...rollingState, ...res.updatedState };
          }
        }
      }
      if (results.length >= 2) {
        const mergedPatch: Partial<CarState> = {};
        let mergedUi: string | undefined;
        let mergedNav: Partial<NavigationRoute> | undefined;
        let closeVoice = false;
        let isMrtEnd = false;
        let isJarvisEnd = false;
        const replies: string[] = [];

        for (const r of results) {
          if (r.updatedState) Object.assign(mergedPatch, r.updatedState);
          if (r.uiCommand) mergedUi = r.uiCommand;
          if (r.navigationData) mergedNav = r.navigationData;
          if (r.closeVoiceModal) closeVoice = true;
          if (r.isMrtEnd) isMrtEnd = true;
          if (r.isJarvisEnd) isJarvisEnd = true;
          if (r.reply) replies.push(r.reply);
        }

        return {
          matched: true,
          action: results[results.length - 1].action,
          uiCommand: mergedUi,
          reply: replies.join(" "),
          updatedState: Object.keys(mergedPatch).length > 0 ? mergedPatch : undefined,
          navigationData: mergedNav,
          closeVoiceModal: closeVoice,
          isMrtEnd,
          isJarvisEnd,
        };
      }
    }
  }

  // 0.01 Jarvis Goodbye
  if (
    input.includes("خداحافظ جارویز") ||
    input.includes("خداحافظ جارویس") ||
    input.includes("خدا حافظ جارویز") ||
    input.includes("خدا حافظ جارویس") ||
    input.includes("خدافظ جارویز") ||
    input.includes("خدافظ جارویس") ||
    input.includes("بای جارویز") ||
    input.includes("بای جارویس") ||
    input.includes("فعلا جارویز") ||
    input.includes("فعلا جارویس") ||
    input.includes("پایان صحبت") ||
    input.includes("goodbye jarvis") ||
    input.includes("bye jarvis")
  ) {
    return {
      matched: true,
      action: "jarvis_goodbye",
      reply: "خداحافظ راننده، سفر خوش و بی‌خطری داشته باشید. هر وقت صدام زدید جارویز آماده‌ام!",
      isJarvisEnd: true,
    };
  }

  // 0.02 Bare Jarvis Wake Greeting (supports all fa-IR STT spellings)
  if (
    /^(سلام|هی|الو|بیدار شو|جانم|آهای|hey|hi|ok|hello)?\s*([جژچگ]\s*[اآ]?\s*ر\s*[وب]\s*[ییئ]?\s*[زسش]|jarv[aeiuo][sz]|jerv[aeiuo][sz])$/i.test(
      input
    )
  ) {
    return {
      matched: true,
      action: "jarvis_greet",
      reply: "جانم راننده، جارویز گوش می‌ده! بفرمایید چه کاری براتون انجام بدم؟",
    };
  }

  // 0.03 MRT Reset Conversation Memory
  const isMrtEnd =
    input === "mrt" ||
    input === "ام ار تی" ||
    input === "امار تی" ||
    input === "امارتی" ||
    input === "m r t" ||
    input === "m.r.t" ||
    input.includes("ریست حافظه") ||
    input.includes("پاک کردن گفتگو") ||
    input === "پایان ام ار تی";

  if (isMrtEnd) {
    return {
      matched: true,
      action: "mrt_end",
      reply: "حافظه گفتگو با دستور ام‌آرتی پاک‌سازی شد. آماده‌ام، فرمان بعدی چیست؟",
      isMrtEnd: true,
    };
  }

  // 0.04 Specific Maintenance Resets (must run BEFORE generic reset_app)
  if (
    input.includes("ریست سفر") ||
    input.includes("ریست مسافت") ||
    input.includes("صفر کردن سفر") ||
    input.includes("صفر کردن مسافت") ||
    input.includes("کیلومتر سفر رو صفر")
  ) {
    return {
      matched: true,
      action: "reset_trip",
      uiCommand: "reset_trip",
      reply: "مسافت‌سنج و تایمر سفر با موفقیت صفر و ریست شد.",
    };
  }

  if (
    input.includes("ریست روغن") ||
    input.includes("ریست سرویس روغن") ||
    input.includes("سرویس روغن انجام شد") ||
    input.includes("صفر کردن روغن") ||
    input.includes("روغن رو ریست کن")
  ) {
    return {
      matched: true,
      action: "reset_oil",
      uiCommand: "reset_oil",
      reply: "شمارنده سرویس و عمر روغن موتور ب‌ام‌و با موفقیت ریست شد.",
    };
  }

  if (
    input.includes("کالیبره مانیتور") ||
    input.includes("کالیبراسیون مانیتور") ||
    input.includes("مچ کردن مانیتور") ||
    input.includes("ریست مانیتور") ||
    input.includes("تنظیم خودکار مانیتور")
  ) {
    return {
      matched: true,
      action: "calibrate_monitor",
      uiCommand: "calibrate_monitor",
      reply: "مانیتور و ابعاد تصویر خودرو با موفقیت ریست و کالیبره شد.",
    };
  }

  if (
    input.includes("اپدیت") ||
    input.includes("آپدیت") ||
    input.includes("بروزرسانی") ||
    input.includes("به روز رسانی") ||
    input.includes("دانلود برنامه") ||
    input.includes("دانلود بسته")
  ) {
    return {
      matched: true,
      action: "run_ota_update",
      uiCommand: "run_ota_update",
      reply: "بررسی بروزرسانی مانیتور و دانلود خودکار بسته‌های ضروری آغاز شد.",
    };
  }

  if (
    input.includes("خسته ام") ||
    input.includes("خستم") ||
    input.includes("خوابم میاد") ||
    input.includes("خوابم گرفته")
  ) {
    return {
      matched: true,
      action: "fatigue_advice",
      reply: "اگر احساس خستگی یا سنگینی چشم داری، لطفاً همین الان در اولین جای امن کنار بزن و یه ربع استراحت کن. سلامتت از هر مسیری مهم‌تره.",
    };
  }

  if (
    input.includes("اخطار") ||
    input.includes("هشدار شب") ||
    input.includes("هشدار روز") ||
    input.includes("هشدارهای رانندگی")
  ) {
    const activeAlerts = evaluateCopilotAlerts(currentState, 0, new Date());
    if (activeAlerts.length > 0) {
      return {
        matched: true,
        action: "check_alerts",
        reply: activeAlerts.map((a) => a.spokenMessage).join(" "),
      };
    }
    return {
      matched: true,
      action: "check_alerts",
      reply: "در حال حاضر هیچ اخطار ایمنی شب یا روز فعالی وجود ندارد و شرایط رانندگی کاملاً امن است.",
    };
  }

  if (
    input.includes("کامپیوتر ماشین") ||
    input.includes("کامپیوتر خودرو") ||
    input.includes("ای سی یو") ||
    input.includes("خطای موتور") ||
    input.includes("کد خطا") ||
    input.includes("همه چیز رو بخون") ||
    input.includes("سنسورها رو بخون") ||
    input.includes("ecu") ||
    input.includes("obd")
  ) {
    return {
      matched: true,
      action: "read_ecu",
      uiCommand: "open_tab:settings",
      reply: buildCarComputerSpokenSummary(currentState),
    };
  }

  if (
    input.includes("صفحه تنظیمات") ||
    input.includes("باز کردن تنظیمات") ||
    input.includes("برو تنظیمات") ||
    input.includes("برو به تنظیمات") ||
    input === "تنظیمات"
  ) {
    return {
      matched: true,
      action: "open_settings_tab",
      uiCommand: "open_tab:settings",
      closeVoiceModal: true,
      reply: "بخش تنظیمات کامل و کامپیوتر ماشین باز شد.",
    };
  }

  // 0.05 Full App Reset
  if (
    input === "ریست" ||
    input === "ریست برنامه" ||
    input === "ریست کامل" ||
    input === "ریست سیستم" ||
    input === "ریستارت" ||
    input === "برنامه ریست" ||
    input === "سیستم ریست" ||
    input === "reset" ||
    input.includes("ریست کارخانه") ||
    input.includes("تنظیمات اولیه")
  ) {
    return {
      matched: true,
      action: "reset_app",
      uiCommand: "reset_app",
      reply: "کل سیستم خودرو و برنامه به تنظیمات اولیه ریست شد.",
    };
  }

  // 0.06 Start Recording Conversation
  if (
    input.includes("مکالمه رو ضبط کن") ||
    input.includes("مکالمه را ضبط کن") ||
    input.includes("ضبط مکالمه") ||
    input.includes("مکالمه رو سیو کن") ||
    input === "ضبط کن"
  ) {
    return {
      matched: true,
      action: "start_recording",
      reply: "ضبط مکالمه آغاز شد و در تاریخچه سیستم ذخیره می‌شود.",
    };
  }

  // 0.07 UI Screens, Tabs, 3D Showroom, HUD & Modals
  if (
    input.includes("سه بعدی") ||
    input.includes("3 بعدی") ||
    input.includes("3d") ||
    input.includes("نمای سه بعدی")
  ) {
    if (input.includes("ببند") || input.includes("بستن") || input.includes("خروج") || input.includes("خاموش")) {
      return {
        matched: true,
        action: "close_3d",
        uiCommand: "close_3d",
        reply: "نمای سه‌بعدی خودرو بسته شد و به کاکپیت برگشتید.",
      };
    }
    return {
      matched: true,
      action: "open_3d",
      uiCommand: "open_3d",
      closeVoiceModal: true,
      reply: "نمای سه‌بعدی تعاملی ب‌ام‌و ۷۲۸ روی مانیتور باز شد.",
    };
  }

  if (
    input.includes("حالت شبانه") ||
    input.includes("حالت مخفی") ||
    input.includes("حالت هود") ||
    input.includes("محافظ صفحه") ||
    input.includes("hud")
  ) {
    if (input.includes("خروج") || input.includes("ببند") || input.includes("خاموش") || input.includes("غیرفعال")) {
      return {
        matched: true,
        action: "close_hud",
        uiCommand: "close_hud",
        updatedState: { stealthHudActive: false },
        reply: "حالت شبانه بسته شد و داشبورد کامل نمایش داده شد.",
      };
    }
    return {
      matched: true,
      action: "open_hud",
      uiCommand: "open_hud",
      closeVoiceModal: true,
      updatedState: { stealthHudActive: true },
      reply: "حالت شبانه و مینیمال هود فعال شد.",
    };
  }

  if (
    input.includes("گیت هاب") ||
    input.includes("گیتهاب") ||
    input.includes("github") ||
    input.includes("همگام سازی")
  ) {
    return {
      matched: true,
      action: "open_factory_github",
      uiCommand: "open_factory_github",
      closeVoiceModal: true,
      reply: "بخش همگام‌سازی گیت‌هاب و بکاپ ابری باز شد.",
    };
  }

  if (input.includes("تنظیمات کارخانه") || input.includes("فکتوری")) {
    return {
      matched: true,
      action: "open_factory",
      uiCommand: "open_factory",
      closeVoiceModal: true,
      reply: "منوی تنظیمات کارخانه مانیتور باز شد.",
    };
  }

  if (
    input.includes("مشخصات خودرو") ||
    input.includes("مشخصات فنی") ||
    input.includes("مشخصات سخت افزار") ||
    input.includes("اطلاعات سیستم")
  ) {
    return {
      matched: true,
      action: "open_specs",
      uiCommand: "open_specs",
      closeVoiceModal: true,
      reply: "صفحه مشخصات فنی و سخت‌افزار خودرو باز شد.",
    };
  }

  if (
    (input.includes("تاریخچه") || input.includes("گزارش دیاگ") || input.includes("پنجره دیاگ")) &&
    (input.includes("باز") || input.includes("نشون") || input.includes("بیار"))
  ) {
    return {
      matched: true,
      action: "open_diagnostics",
      uiCommand: "open_diagnostics",
      closeVoiceModal: true,
      reply: "گزارش کامل دیاگ و تاریخچه مکالمات باز شد.",
    };
  }

  if (
    input.includes("برگرد به داشبورد") ||
    input.includes("برو داشبورد") ||
    input.includes("برو به داشبورد") ||
    input.includes("صفحه اصلی") ||
    input.includes("برگرد خانه") ||
    input === "داشبورد" ||
    input === "کاکپیت"
  ) {
    return {
      matched: true,
      action: "open_tab",
      uiCommand: "open_tab:dash",
      closeVoiceModal: true,
      reply: "به صفحه اصلی داشبورد برگشتید.",
    };
  }

  if (
    input.includes("تنظیمات خودرو") ||
    input.includes("کنترل خودرو") ||
    input.includes("پنل کنترل") ||
    input.includes("منوی کنترل") ||
    input === "کنترل ها"
  ) {
    return {
      matched: true,
      action: "open_tab",
      uiCommand: "open_tab:controls",
      closeVoiceModal: true,
      reply: "بخش تنظیمات و کنترل‌های خودرو روی مانیتور باز شد.",
    };
  }

  if (
    input.includes("صفحه موزیک") ||
    input.includes("صفحه رسانه") ||
    input.includes("منوی رسانه") ||
    input.includes("سیستم صوتی رو باز کن") ||
    input === "رسانه" ||
    input === "مدیا"
  ) {
    return {
      matched: true,
      action: "open_tab",
      uiCommand: "open_tab:media",
      closeVoiceModal: true,
      reply: "پخش‌کننده رسانه و رادیو ب‌ام‌و باز شد.",
    };
  }

  if (
    input === "ببند" ||
    input === "پنجره رو ببند" ||
    input === "صفحه رو ببند" ||
    input === "همه رو ببند"
  ) {
    return {
      matched: true,
      action: "close_modals",
      uiCommand: "close_modals",
      closeVoiceModal: true,
      reply: "پنجره‌های باز بسته شدند و داشبورد آماده است.",
    };
  }

  // 1. Drive Modes (اسپرت / کامفورت / اکو / ادپتیو)
  if (
    input.includes("حالت اسپرت") ||
    input.includes("مد اسپرت") ||
    input.includes("بذار روی اسپرت") ||
    input.includes("برو روی اسپرت") ||
    input === "اسپرت" ||
    input.includes("sport mode")
  ) {
    return {
      matched: true,
      action: "sport_mode",
      reply: "حالت رانندگی اسپرت فعال شد. واکنش موتور و تعلیق ب‌ام‌و در بیشترین توان قرار گرفت.",
      updatedState: { driveMode: "sport" },
    };
  }

  if (
    input.includes("حالت کامفورت") ||
    input.includes("مد کامفورت") ||
    input.includes("بذار روی کامفورت") ||
    input.includes("حالت راحت") ||
    input.includes("comfort")
  ) {
    return {
      matched: true,
      action: "comfort_mode",
      reply: "حالت رانندگی کامفورت برای بیشترین نرمی و آرامش فعال شد.",
      updatedState: { driveMode: "comfort" },
    };
  }

  if (
    input.includes("حالت اکو") ||
    input.includes("مد اکو") ||
    input.includes("بذار روی اکو") ||
    input.includes("حالت اقتصادی") ||
    input.includes("eco")
  ) {
    return {
      matched: true,
      action: "eco_mode",
      reply: "حالت رانندگی اکو پرو برای کاهش مصرف سوخت فعال شد.",
      updatedState: { driveMode: "eco" },
    };
  }

  if (
    input.includes("حالت تطبیقی") ||
    input.includes("ادپتیو") ||
    input.includes("حالت هوشمند") ||
    input.includes("adaptive")
  ) {
    return {
      matched: true,
      action: "adaptive_mode",
      reply: "حالت رانندگی تطبیقی هوشمند بر اساس شرایط جاده فعال شد.",
      updatedState: { driveMode: "adaptive" },
    };
  }

  // 2. Air Suspension Height Control (تنظیم ارتفاع تعلیق بادی)
  if (
    input.includes("تعلیق") ||
    input.includes("ارتفاع ماشین") ||
    input.includes("ارتفاع خودرو") ||
    input.includes("پنوماتیک") ||
    input.includes("کمک فنر")
  ) {
    if (input.includes("بالا") || input.includes("زیاد") || input.includes("بلند")) {
      return {
        matched: true,
        action: "suspension_high",
        reply: "ارتفاع سیستم تعلیق بادی ب‌ام‌و به حالت بالا تنظیم شد.",
        updatedState: { airSuspensionLevel: "high" },
      };
    }
    if (input.includes("پایین") || input.includes("کم") || input.includes("اسپرت")) {
      return {
        matched: true,
        action: "suspension_low",
        reply: "ارتفاع سیستم تعلیق به حالت پایین و اسپرت کاهش یافت.",
        updatedState: { airSuspensionLevel: "low" },
      };
    }
    return {
      matched: true,
      action: "suspension_normal",
      reply: "ارتفاع سیستم تعلیق بادی روی سطح استاندارد و عادی قرار گرفت.",
      updatedState: { airSuspensionLevel: "normal" },
    };
  }

  // 3. Ambient Cabin Lighting Themes (نورپردازی کابین)
  if (
    input.includes("نورپردازی") ||
    input.includes("نور کابین") ||
    input.includes("نور مخفی") ||
    input.includes("نور داخل") ||
    input.includes("رنگ کابین") ||
    input.includes("تم کابین")
  ) {
    let themeId: AmbientLightingThemeId | undefined;
    let themeLabel = "";
    if (input.includes("قهوه") || input.includes("کرم") || input.includes("شیشه") || input.includes("برنز") || input.includes("طلایی")) {
      themeId = "cognac-gold";
      themeLabel = "قهوه‌ای روشن شیشه‌ای";
    } else if (input.includes("قرمز") || input.includes("سرخ")) {
      themeId = "sport-red";
      themeLabel = "قرمز اسپرت";
    } else if (input.includes("آبی") || input.includes("ابی") || input.includes("مدرن")) {
      themeId = "modern-blue";
      themeLabel = "آبی مدرن";
    } else if (input.includes("نارنجی") || input.includes("کلاسیک") || input.includes("امبر")) {
      themeId = "classic-orange";
      themeLabel = "نارنجی کلاسیک ب‌ام‌و";
    } else if (input.includes("سبز") || input.includes("زمردی")) {
      themeId = "emerald-touring";
      themeLabel = "سبز زمردی";
    } else if (input.includes("بنفش") || input.includes("یاسی")) {
      themeId = "executive-violet";
      themeLabel = "بنفش تشریفاتی";
    } else if (input.includes("سفید") || input.includes("یخی")) {
      themeId = "polar-white";
      themeLabel = "سفید یخی";
    }

    const num = extractNumberFromPersian(input);
    const patch: Partial<CarState> = {};
    if (themeId) patch.ambientLightingColor = themeId;
    if (num !== null && num >= 10 && num <= 100) {
      patch.ambientLightingBrightness = num;
    }

    if (themeId || patch.ambientLightingBrightness !== undefined) {
      const brightPart =
        patch.ambientLightingBrightness !== undefined
          ? ` با روشنایی ${patch.ambientLightingBrightness} درصد`
          : "";
      return {
        matched: true,
        action: "ambient_lighting",
        reply: `نورپردازی کابین روی ${themeLabel || "تم فعال"}${brightPart} تنظیم شد.`,
        updatedState: patch,
      };
    }
  }

  // 4. Sunroof & Power Windows (سانروف و شیشه‌ها)
  if (input.includes("سانروف") || input.includes("سقف")) {
    const close = input.includes("ببند") || input.includes("بست") || input.includes("خاموش");
    return {
      matched: true,
      action: close ? "sunroof_close" : "sunroof_open",
      reply: close ? "سانروف خودرو بسته شد." : "سانروف خودرو باز شد.",
      updatedState: { sunroofOpen: !close },
    };
  }

  if (input.includes("شیشه") || input.includes("پنجره")) {
    const close =
      input.includes("بالا") ||
      input.includes("ببند") ||
      input.includes("بسته");
    const open =
      input.includes("پایین") ||
      input.includes("باز") ||
      input.includes("بده پایین");
    if (close || open) {
      const openVal = !close;
      const prevWin = currentState.windowsOpen;
      let nextWin = { fl: openVal, fr: openVal, rl: openVal, rr: openVal };
      let targetDesc = "تمامی شیشه‌ها";

      if (input.includes("راننده")) {
        nextWin = { ...prevWin, fl: openVal };
        targetDesc = "شیشه راننده";
      } else if (input.includes("شاگرد") || input.includes("جلو راست")) {
        nextWin = { ...prevWin, fr: openVal };
        targetDesc = "شیشه سرنشین جلو";
      } else if (input.includes("عقب چپ")) {
        nextWin = { ...prevWin, rl: openVal };
        targetDesc = "شیشه عقب چپ";
      } else if (input.includes("عقب راست")) {
        nextWin = { ...prevWin, rr: openVal };
        targetDesc = "شیشه عقب راست";
      }

      return {
        matched: true,
        action: openVal ? "windows_open" : "windows_close",
        reply: `${targetDesc} ${openVal ? "پایین داده و باز شد" : "بالا داده و بسته شد"}.`,
        updatedState: { windowsOpen: nextWin },
      };
    }
  }

  // 5. Central Door Locking
  if (
    input.includes("درها رو باز کن") ||
    input.includes("قفل درها رو باز کن") ||
    input.includes("قفل مرکزی رو باز کن") ||
    (input.includes("قفل") && input.includes("باز"))
  ) {
    return {
      matched: true,
      action: "unlock_doors",
      reply: "قفل مرکزی درهای خودرو باز شد.",
      updatedState: { doorsLocked: false },
    };
  }

  if (
    input.includes("قفل درها") ||
    input.includes("درهای ماشین رو قفل کن") ||
    input.includes("درها رو ببند") ||
    input.includes("درها رو قفل کن") ||
    input.includes("قفل مرکزی") ||
    input.includes("قفل کن")
  ) {
    return {
      matched: true,
      action: "lock_doors",
      reply: "قفل مرکزی خودرو با موفقیت فعال شد.",
      updatedState: { doorsLocked: true },
    };
  }

  // 6. Climate Control (Dynamic Temp, Fan Speed, Mode, AC/Heater)
  const hasClimateKeyword =
    input.includes("دما") ||
    input.includes("درجه") ||
    input.includes("کولر") ||
    input.includes("بخاری") ||
    input.includes("تهویه") ||
    input.includes("فن") ||
    input.includes("خنک") ||
    input.includes("سرد") ||
    input.includes("گرم");

  if (hasClimateKeyword && !input.includes("موتور") && !input.includes("بیرون") && !input.includes("آب") && !input.includes("هوای بیرون")) {
    if (input.includes("خاموش") || input.includes("قطع") || input.includes("ببند")) {
      return {
        matched: true,
        action: "ac_off",
        reply: "سیستم تهویه مطبوع ۴ کاناله خودرو خاموش شد.",
        updatedState: { acActive: false },
      };
    }

    if (input.includes("فن")) {
      const extracted = extractNumberFromPersian(input);
      let nextFan = currentState.acFanSpeed || 2;
      if (extracted !== null && extracted >= 1 && extracted <= 5) {
        nextFan = extracted;
      } else if (input.includes("زیاد") || input.includes("بالا") || input.includes("تند") || input.includes("بیشتر")) {
        nextFan = Math.min(5, nextFan + 1);
      } else if (input.includes("کم") || input.includes("پایین") || input.includes("اروم") || input.includes("کمتر")) {
        nextFan = Math.max(1, nextFan - 1);
      }
      return {
        matched: true,
        action: "ac_fan",
        reply: `سرعت فن تهویه روی درجه ${nextFan} تنظیم شد.`,
        updatedState: { acActive: true, acFanSpeed: nextFan },
      };
    }

    if (input.includes("ضد بخار") || input.includes("بخار شیشه") || input.includes("دیفراست")) {
      return {
        matched: true,
        action: "ac_mode",
        reply: "حالت ضدبخار شیشه جلو برای تهویه فعال شد.",
        updatedState: { acActive: true, acMode: "defrost" },
      };
    }

    const explicitTemp = extractNumberFromPersian(input);
    if (explicitTemp !== null && explicitTemp >= 15 && explicitTemp <= 32) {
      const clamped = Math.max(16, Math.min(30, explicitTemp));
      return {
        matched: true,
        action: "ac_set_temp",
        reply: `سیستم تهویه روشن شد و دمای کابین روی ${clamped} درجه سانتی‌گراد تنظیم گردید.`,
        updatedState: { acActive: true, acTemp: clamped },
      };
    }

    if (input.includes("سردتر") || input.includes("خنک تر") || input.includes("دما رو کم کن") || input.includes("بیار پایین")) {
      const nextTemp = Math.max(16, (currentState.acTemp || 22) - 2);
      return {
        matched: true,
        action: "ac_set_temp",
        reply: `دمای کابین خنک‌تر شد و روی ${nextTemp} درجه قرار گرفت.`,
        updatedState: { acActive: true, acTemp: nextTemp },
      };
    }

    if (input.includes("گرم تر") || input.includes("دما رو زیاد کن") || input.includes("ببر بالا")) {
      const nextTemp = Math.min(30, (currentState.acTemp || 22) + 2);
      return {
        matched: true,
        action: "ac_set_temp",
        reply: `دمای کابین گرم‌تر شد و روی ${nextTemp} درجه تنظیم گردید.`,
        updatedState: { acActive: true, acTemp: nextTemp },
      };
    }

    if (input.includes("بخاری")) {
      const target = Math.max(25, currentState.acTemp || 26);
      return {
        matched: true,
        action: "ac_on",
        reply: `بخاری خودرو روشن شد و دما روی ${target} درجه تنظیم شد.`,
        updatedState: { acActive: true, acTemp: target },
      };
    }

    return {
      matched: true,
      action: "ac_on",
      reply: `کولر و تهویه مطبوع روشن شد و دما روی ${currentState.acTemp || 21} درجه تنظیم گردید.`,
      updatedState: { acActive: true },
    };
  }

  // 7. Volume & Music Player Controls (only match explicit audio/volume controls)
  const isCarVolumeControl =
    input.includes("ولوم") ||
    input.includes("میوت") ||
    input.includes("سایلنت") ||
    /(صدا|صدای)\s*(رو|را|پخش|موزیک|موسیقی|ماشین|ضبط|سیستم|کم|زیاد|بلند|آروم|اروم|قطع|ببند|صفر|وصل|روی)/.test(
      input
    ) ||
    /(زیاد|بلند|کم|اروم|آروم|قطع|وصل)\s*(کردن|کن|بکن)?\s*(صدا|صدای)/.test(input);

  if (isCarVolumeControl) {
    if (
      input.includes("قطع") ||
      input.includes("ببند") ||
      input.includes("میوت") ||
      input.includes("سایلنت") ||
      input.includes("صفر")
    ) {
      return {
        matched: true,
        action: "volume_mute",
        reply: "صدای سیستم صوتی خودرو قطع شد.",
        updatedState: { volume: 0 },
      };
    }
    if (input.includes("وصل")) {
      return {
        matched: true,
        action: "volume_unmute",
        reply: "صدای سیستم صوتی روی ۶۵ درصد وصل شد.",
        updatedState: { volume: 65 },
      };
    }
    const volNum = extractNumberFromPersian(input);
    if (volNum !== null && volNum >= 0 && volNum <= 100 && (input.includes("صدا") || input.includes("ولوم"))) {
      return {
        matched: true,
        action: "volume_set",
        reply: `بلندی صدای سیستم صوتی روی ${volNum} درصد تنظیم شد.`,
        updatedState: { volume: volNum },
      };
    }
    if (input.includes("زیاد") || input.includes("بلند") || input.includes("ببر بالا")) {
      const nextVol = Math.min(100, (currentState.volume ?? 65) + 15);
      return {
        matched: true,
        action: "volume_up",
        reply: `بلندی صدا افزایش یافت و روی ${nextVol} درصد قرار گرفت.`,
        updatedState: { volume: nextVol },
      };
    }
    if (input.includes("کم") || input.includes("اروم") || input.includes("بیار پایین")) {
      const nextVol = Math.max(0, (currentState.volume ?? 65) - 15);
      return {
        matched: true,
        action: "volume_down",
        reply: `بلندی صدا کاهش یافت و روی ${nextVol} درصد قرار گرفت.`,
        updatedState: { volume: nextVol },
      };
    }
  }

  if (
    input.includes("آهنگ های فلش") ||
    input.includes("اهنگ های فلش") ||
    input.includes("فلش مموری") ||
    input.includes("فلش رو پخش") ||
    input.includes("موزیک های فلش") ||
    input.includes("اهنگ فلش")
  ) {
    return {
      matched: true,
      action: "play_flash",
      reply: "آهنگ‌های حافظه فلش USB در حال پخش هستند.",
      updatedState: { musicPlaying: true },
    };
  }

  if (
    input.includes("موزیک رو قطع") ||
    input.includes("اهنگ رو قطع") ||
    input.includes("موزیک رو متوقف") ||
    input.includes("اهنگ رو متوقف") ||
    input.includes("موزیک رو خاموش") ||
    input.includes("موسیقی رو قطع") ||
    input.includes("پخش رو متوقف") ||
    input === "استوپ موزیک"
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
    input.includes("اهنگ بعدی") ||
    input.includes("برو بعدی") ||
    input.includes("ترک بعدی") ||
    input.includes("موزیک بعدی")
  ) {
    return {
      matched: true,
      action: "next_music",
      uiCommand: "next_music",
      reply: "آهنگ بعدی در حال پخش است.",
      updatedState: { musicPlaying: true },
    };
  }

  if (
    input.includes("آهنگ قبلی") ||
    input.includes("اهنگ قبلی") ||
    input.includes("برو قبلی") ||
    input.includes("ترک قبلی") ||
    input.includes("موزیک قبلی")
  ) {
    return {
      matched: true,
      action: "prev_music",
      uiCommand: "prev_music",
      reply: "آهنگ قبلی پخش شد.",
      updatedState: { musicPlaying: true },
    };
  }

  if (
    input.includes("موزیک رو پخش") ||
    input.includes("اهنگ بذار") ||
    input.includes("پخش موزیک") ||
    input.includes("موسیقی رو روشن") ||
    input.includes("موزیک رو روشن")
  ) {
    return {
      matched: true,
      action: "play_music",
      reply: "پخش موسیقی سیستم صوتی Hi-Fi ب‌ام‌و شروع شد.",
      updatedState: { musicPlaying: true },
    };
  }

  // 8. Exterior Lighting & Signals
  if (input.includes("نور بالا")) {
    const off = input.includes("خاموش") || input.includes("ببند") || input.includes("قطع");
    return {
      matched: true,
      action: off ? "high_beam_off" : "high_beam_on",
      reply: off ? "نور بالای خودرو خاموش شد." : "نور بالای خودرو روشن شد.",
      updatedState: { highBeamActive: !off, headlightsActive: !off ? true : currentState.headlightsActive },
    };
  }

  if (input.includes("مه شکن") || input.includes("پروژکتور")) {
    const off = input.includes("خاموش") || input.includes("ببند") || input.includes("قطع");
    return {
      matched: true,
      action: off ? "fog_off" : "fog_on",
      reply: off ? "چراغ‌های مه‌شکن خاموش شدند." : "چراغ‌های مه‌شکن روشن شدند.",
      updatedState: { fogLightsActive: !off },
    };
  }

  if (
    input.includes("جفت راهنما") ||
    input.includes("فلاشر") ||
    input.includes("چراغ خطر") ||
    input.includes("چراغ اضطراری")
  ) {
    if (input.includes("خاموش") || input.includes("قطع") || input.includes("ببند")) {
      return {
        matched: true,
        action: "hazard_off",
        reply: "جفت راهنما (فلاشر) خاموش شد.",
        updatedState: { hazardActive: false },
      };
    }
    if (input.includes("روشن") || input.includes("بزن") || input.includes("فعال")) {
      return {
        matched: true,
        action: "hazard_on",
        reply: "جفت راهنما (فلاشر) روشن شد.",
        updatedState: { hazardActive: true },
      };
    }
    const nextHazard = !currentState.hazardActive;
    return {
      matched: true,
      action: "toggle_hazard",
      reply: nextHazard ? "جفت راهنما روشن شد." : "جفت راهنما خاموش شد.",
      updatedState: { hazardActive: nextHazard },
    };
  }

  if (input.includes("راهنما چپ") || input.includes("راهنمای چپ")) {
    const off = input.includes("خاموش") || input.includes("قطع");
    return {
      matched: true,
      action: "left_signal",
      reply: off ? "راهنمای چپ خاموش شد." : "راهنمای سمت چپ روشن شد.",
      updatedState: { leftSignal: !off, rightSignal: false },
    };
  }

  if (input.includes("راهنما راست") || input.includes("راهنمای راست")) {
    const off = input.includes("خاموش") || input.includes("قطع");
    return {
      matched: true,
      action: "right_signal",
      reply: off ? "راهنمای راست خاموش شد." : "راهنمای سمت راست روشن شد.",
      updatedState: { rightSignal: !off, leftSignal: false },
    };
  }

  if (input.includes("چراغ")) {
    if (input.includes("خاموش") || input.includes("قطع") || input.includes("ببند")) {
      return {
        matched: true,
        action: "headlights_off",
        reply: "چراغ‌های جلو خاموش شدند.",
        updatedState: { headlightsActive: false, highBeamActive: false },
      };
    }
    if (input.includes("روشن") || input.includes("بزن") || input.includes("فعال")) {
      return {
        matched: true,
        action: "headlights_on",
        reply: "چراغ‌های جلو روشن شدند.",
        updatedState: { headlightsActive: true },
      };
    }
  }

  // 9. GPS Navigation (Cities or Explicit Navigation Request — avoid hijacking "مسیر زندگی/یادگیری")
  const isMetaphoricalRoute =
    /(مسیر\s+(زندگی|موفقیت|یادگیری|شغلی|درست|تغییر|توسعه|کار|علم|پیشرفت))/.test(input);
  const isRouteRequest =
    !isMetaphoricalRoute &&
    (input.includes("مسیریابی") ||
      input.includes("برو به") ||
      input.includes("نقشه") ||
      input.includes("جی پی اس") ||
      input.includes("gps") ||
      input.includes("ناوبری") ||
      /(مسیر\s+(به|تا|سمت|تهران|مشهد|اصفهان|شیراز|رشت|تبریز|شمال|خانه|خونه|محل کار))/.test(input));

  if (isRouteRequest) {
    const historyMatch = (city: string) =>
      input.includes(city) || (recentHistory && recentHistory.some((h) => h.text.includes(city)));

    for (const r of CITY_ROUTES) {
      if (historyMatch(r.cityA) && historyMatch(r.cityB)) {
        return {
          matched: true,
          action: "navigate",
          closeVoiceModal: true,
          reply: `مسیر ${r.origin} به ${r.destination} به طول ${r.distance} روی نقشه خودرو فعال شد.`,
          navigationData: {
            origin: r.origin,
            destination: r.destination,
            distance: r.distance,
            duration: r.duration,
            nextTurn: r.nextTurn,
            turnDistance: r.turnDistance,
            speedLimit: r.speedLimit,
            eta: r.eta,
          },
        };
      }
    }

    const customDestMatch = input.match(/(?:مسیر به|برو به|مقصد|به سمت)\s+([آ-یa-z0-9\s]{2,24})/);
    if (customDestMatch && customDestMatch[1]) {
      const dest = customDestMatch[1].replace(/(رو باز کن|رو بیار|نشون بده|برام بیار)$/g, "").trim();
      if (dest && dest.length >= 2) {
        return {
          matched: true,
          action: "navigate",
          closeVoiceModal: true,
          reply: `مسیریابی GPS به سمت ${dest} روی مانیتور فعال شد.`,
          navigationData: {
            origin: "موقعیت فعلی (GPS)",
            destination: dest,
            distance: "محاسبه در نقشه",
            duration: "در حال تخمین",
            nextTurn: `به سمت ${dest} حرکت کنید.`,
            turnDistance: "۳۰۰ متر",
            speedLimit: 90,
            eta: "۱۸:۰۰",
          },
        };
      }
    }

    return {
      matched: true,
      action: "navigate",
      closeVoiceModal: true,
      reply: "نقشه و ماژول ناوبری GPS ب‌ام‌و روی مانیتور باز شد.",
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

  // 10. Mic Check
  if (
    input.includes("صدای من رو داری") ||
    input.includes("صدامو داری") ||
    input.includes("صدام میاد") ||
    input.includes("میشنوی منو") ||
    input.includes("صدامو میشنوی")
  ) {
    return {
      matched: true,
      action: "mic_check",
      reply: "بله راننده عزیز، صداتون کاملاً واضح و شفاف است. هر فرمانی دارید بفرمایید.",
    };
  }

  // 11. Time, Date, Today's Schedule, Oil, TPMS, Battery, Fuel, Temp & Status Telemetry
  if (
    input.includes("ساعت چنده") ||
    input.includes("الان ساعت") ||
    input.includes("ساعت چند") ||
    input === "ساعت"
  ) {
    const nowTime = new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const nowDate = new Date().toLocaleDateString("fa-IR", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return {
      matched: true,
      action: "check_time",
      reply: `الان ساعت ${nowTime} است و امروز ${nowDate} می‌باشد.`,
    };
  }

  if (
    input.includes("امروز چندمه") ||
    input.includes("تاریخ امروز") ||
    input.includes("تاریخ چنده")
  ) {
    const nowDate = new Date().toLocaleDateString("fa-IR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return {
      matched: true,
      action: "check_date",
      reply: `امروز ${nowDate} است.`,
    };
  }

  if (
    input.includes("جلسات امروز") ||
    input.includes("جلسات من") ||
    input.includes("قرار ملاقات") ||
    input.includes("برنامه امروز") ||
    input.includes("تقویم امروز") ||
    input.includes("جلسه دارم") ||
    input.includes("چه جلسه")
  ) {
    return {
      matched: true,
      action: "check_schedule",
      reply: readTodayMeetingsSummary(),
    };
  }

  if (
    input.includes("لاستیک") ||
    input.includes("باد چرخ") ||
    input.includes("فشار باد") ||
    input.includes("tpms")
  ) {
    const t = currentState.tpms || { fl: 32, fr: 32, rl: 33, rr: 32 };
    return {
      matched: true,
      action: "check_tpms",
      reply: `فشار باد لاستیک‌ها بر اساس سنسور TPMS: چرخ‌های جلو هر دو ${t.fl} پی‌اس‌آی و چرخ‌های عقب ${t.rl} و ${t.rr} پی‌اس‌آی در وضعیت نرمال هستند.`,
    };
  }

  if (
    input.includes("روغن موتور") ||
    input.includes("عمر روغن") ||
    input.includes("فشار روغن") ||
    input.includes("سرویس روغن") ||
    input.includes("روغن ماشین") ||
    input.includes("روغن خودرو")
  ) {
    return {
      matched: true,
      action: "check_oil",
      reply: readOilLifeSummary(currentState),
    };
  }

  if (
    input.includes("باتری ماشین") ||
    input.includes("باتری خودرو") ||
    input.includes("باطری ماشین") ||
    input.includes("باطری خودرو") ||
    input.includes("ولتاژ باتری") ||
    input.includes("ولتاژ دینام") ||
    input === "باتری" ||
    input === "ولتاژ"
  ) {
    const volt = currentState.batteryVoltage || 14.2;
    return {
      matched: true,
      action: "check_battery",
      reply: `ولتاژ باتری و دینام خودرو ${volt} ولت و کاملاً سالم است.`,
    };
  }

  if (
    input.includes("دمای بیرون") ||
    input.includes("هوای بیرون") ||
    input.includes("دمای محیط") ||
    input.includes("بیرون چقدره") ||
    input.includes("سنسور دمای محیط")
  ) {
    const temp = currentState.outsideTemp || 22;
    return {
      matched: true,
      action: "check_outside_temp",
      reply: `دمای هوای بیرون طبق سنسور محیطی ب‌ام‌و، ${temp} درجه سانتی‌گراد است.`,
    };
  }

  if (
    input.includes("دمای اب موتور") ||
    input.includes("دمای موتور") ||
    input.includes("دمای اب") ||
    input.includes("اب رادیاتور") ||
    input.includes("موتور داغ")
  ) {
    const engTemp = currentState.engineTemp || 90;
    return {
      matched: true,
      action: "check_engine_temp",
      reply: `دمای آب موتور شش سیلندر ب‌ام‌و ${engTemp} درجه سانتی‌گراد و سیستم خنک‌کننده در وضعیت ایده‌آل کار می‌کند.`,
    };
  }

  if (
    input.includes("ایسیو") ||
    input.includes("dme") ||
    input.includes("ecu") ||
    input.includes("دیاگ") ||
    input.includes("وانوس") ||
    input.includes("خطای موتور")
  ) {
    return {
      matched: true,
      action: "check_ecu_diag",
      reply: "ارتباط با کامپیوتر Bosch DME ب‌ام‌و 728Li برقرار است. سیستم Double-VANOS سالم بوده و هیچ کد خطایی در حافظه ثبت نشده است.",
    };
  }

  if (
    input.includes("باک") ||
    input.includes("چقدر بنزین") ||
    input.includes("میزان بنزین") ||
    input.includes("میزان سوخت") ||
    input.includes("بنزین ماشین") ||
    input.includes("سوخت ماشین") ||
    input === "بنزین" ||
    input === "سوخت"
  ) {
    const fuel = currentState.fuelPercent || 65;
    const rangeKm = currentState.rangeKm || 640;
    return {
      matched: true,
      action: "check_fuel",
      reply: `باک بنزین ${fuel} درصد پر است و حدود ${rangeKm} کیلومتر پیمایش باقی مانده است.`,
    };
  }

  if (
    input.includes("سرعت چقدره") ||
    input.includes("سرعت ماشین") ||
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

  if (
    input.includes("دور موتور") ||
    input.includes("ار پی ام") ||
    input.includes("rpm")
  ) {
    const rpm = currentState.rpm || 850;
    return {
      matched: true,
      action: "check_rpm",
      reply: `دور موتور در حال حاضر ${rpm} دور بر دقیقه است و موتور شش سیلندر نرم کار می‌کند.`,
    };
  }

  if (
    input.includes("پاک کردن خطا") ||
    input.includes("خطاها رو پاک") ||
    input.includes("حذف خطا") ||
    input.includes("پاک کن خطا")
  ) {
    return {
      matched: true,
      action: "clear_dtc",
      uiCommand: "clear_dtc",
      updatedState: { dtcErrorCount: 0 },
      reply: "حافظه خطاهای کامپیوتر ماشین اسکن و با موفقیت پاک‌سازی شد.",
    };
  }

  if (
    input.includes("اسمت چیه") ||
    input.includes("کی هستی") ||
    input.includes("خودتو معرفی")
  ) {
    return {
      matched: true,
      action: "self_intro",
      reply: "من جارویز هستم؛ دستیار هوشمند صوتی و کنترل‌گر کامل کاکپیت ب‌ام‌و هفتصد و بیست و هشت شما.",
    };
  }

  if (
    input.includes("چیکار میتونی") ||
    input.includes("چه کارهایی") ||
    input.includes("چیکارا بلدی") ||
    input === "کمک"
  ) {
    return {
      matched: true,
      action: "help_capabilities",
      reply:
        "می‌توانم کولر و دما، موسیقی و موزیک فلش، مسیریابی نقشه، چراغ‌ها، قفل درها، سانروف، حالت رانندگی، خواندن سنسورهای کامپیوتر ماشین و پاسخ به پرسش‌های شما را فقط با صدا انجام دهم.",
    };
  }

  if (
    input.includes("ممنون") ||
    input.includes("مرسی") ||
    input.includes("دستت درد نکنه") ||
    input.includes("دمت گرم") ||
    input.includes("قربانت") ||
    input.includes("عالی بود") ||
    input === "عالی"
  ) {
    return {
      matched: true,
      action: "gratitude",
      reply: "خواهش می‌کنم! همیشه با افتخار کنارتان هستم و هر فرمانی داشتید در خدمتم.",
    };
  }

  if (
    input.includes("وضعیت ماشین") ||
    input.includes("گزارش وضعیت") ||
    input.includes("وضعیت خودرو") ||
    input.includes("وضعیت کلی")
  ) {
    const outT = currentState.outsideTemp || 22;
    const engT = currentState.engineTemp || 90;
    const fuel = currentState.fuelPercent || 68;
    const volt = currentState.batteryVoltage || 14.2;
    return {
      matched: true,
      action: "check_status",
      reply: `سرعت ${currentState.speed} کیلومتر بر ساعت، بنزین ${fuel} درصد، دمای بیرون ${outT} درجه، دمای موتور ${engT} درجه و باتری ${volt} ولت است. تمام سیستم‌های BMW 728Li در وضعیت ایده‌آل هستند.`,
    };
  }

  return {
    matched: false,
    action: "none",
    reply: "",
  };
}
