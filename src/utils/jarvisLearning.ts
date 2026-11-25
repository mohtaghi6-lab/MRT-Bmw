import { normalizePersianText } from "./offlineEngine";

export interface JarvisStyleProfile {
  totalTurns: number;
  tonePreference: "casual_warm" | "respectful_formal" | "balanced";
  preferredEndingStyle: "colloquial" | "formal";
  dialectTraits: string[];
  signaturePhrases: string[];
  preferredAddressTerm: string;
  learnedGreetings: string[];
  learnedVocabCounts: Record<string, number>;
  speechRateHint: number;
  lastUpdated: string;
}

const STYLE_STORAGE_KEY = "bmw728li_jarvis_style_profile_v1";

const DEFAULT_PROFILE: JarvisStyleProfile = {
  totalTurns: 0,
  tonePreference: "balanced",
  preferredEndingStyle: "colloquial",
  dialectTraits: ["فارسی محاوره‌ای صمیمی"],
  signaturePhrases: [],
  preferredAddressTerm: "",
  learnedGreetings: [],
  learnedVocabCounts: {},
  speechRateHint: 1.0,
  lastUpdated: new Date().toISOString(),
};

const DIALECT_RULES: Array<{ trait: string; patterns: string[] }> = [
  {
    trait: "تهرانی محاوره‌ای و صمیمی",
    patterns: [
      "می خوام",
      "میشه",
      "می شه",
      "بذار",
      "چطوره",
      "یه کم",
      "داش",
      "داداش",
      "رفیق",
      "دمت گرم",
      "اوکی",
      "خیلی حال",
      "بزن",
      "حله",
      "چاکرم",
      "نوکرتم",
      "فدات",
    ],
  },
  {
    trait: "شیرازی و جنوبی گرم",
    patterns: ["کاکو", "عامو", "خش", "ها ", "چطوری کاکو", "میخوام برم", "خوبه عامو", "عامو جان", "شیرینی"],
  },
  {
    trait: "اصفهانی خوش‌صحبت",
    patterns: ["دادا", "قربونت", "چطوری دادا", "بذارش", "اصفان", "عشقی", "جونم"],
  },
  {
    trait: "مشهدی و خراسانی",
    patterns: ["مشتی", "چطوری مشتی", "قربونت برم", "دلم تنگ", "برار", "خیلی مخلصیم"],
  },
  {
    trait: "شمالی و گیلکی گرم",
    patterns: ["برار", "جان برار", "چطوری برار", "قربان تو", "خسته نباشی"],
  },
  {
    trait: "رسمی و محترمانه",
    patterns: [
      "لطفاً",
      "لطفا",
      "بفرمایید",
      "متشکرم",
      "سپاسگزارم",
      "جناب",
      "خواهش می‌کنم",
      "می‌شود",
      "نمایید",
    ],
  },
];

const ADDRESS_CANDIDATES = [
  "کاکو",
  "داداش",
  "داش",
  "رفیق",
  "مشتی",
  "عامو",
  "دادا",
  "برار",
  "عزیزم",
  "عشقی",
  "آقا",
  "مهندس",
  "استاد",
  "سلطان",
];

const SIGNATURE_CANDIDATES = [
  "دمت گرم",
  "قربانت",
  "فدات",
  "عزیزم",
  "داداش",
  "رفیق",
  "کاکو",
  "عامو",
  "مشتی",
  "لطفاً",
  "بی زحمت",
  "یه کم",
  "حال دلت",
  "چاکرم",
  "قربونت",
  "اوکی",
  "باشه",
  "حله",
  "مرسی",
  "عالیه",
  "خفنه",
  "نوکرتم",
  "مخلصیم",
  "عشقی",
  "ایول",
  "بزن بریم",
];

const STOP_WORDS = new Set([
  "من",
  "تو",
  "ما",
  "شما",
  "او",
  "این",
  "آن",
  "رو",
  "را",
  "به",
  "از",
  "در",
  "با",
  "برای",
  "و",
  "یا",
  "که",
  "تا",
  "هم",
  "کن",
  "بکن",
  "کنید",
  "شد",
  "شده",
  "است",
  "هست",
  "جارویز",
  "جارویس",
  "جرویس",
  "ماشین",
  "خودرو",
]);

export function loadJarvisStyleProfile(): JarvisStyleProfile {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PROFILE };
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          totalTurns: Number(parsed.totalTurns || 0),
          tonePreference: parsed.tonePreference || "balanced",
          preferredEndingStyle: parsed.preferredEndingStyle || "colloquial",
          dialectTraits: Array.isArray(parsed.dialectTraits)
            ? parsed.dialectTraits
            : DEFAULT_PROFILE.dialectTraits,
          signaturePhrases: Array.isArray(parsed.signaturePhrases) ? parsed.signaturePhrases : [],
          preferredAddressTerm:
            typeof parsed.preferredAddressTerm === "string" ? parsed.preferredAddressTerm : "",
          learnedGreetings: Array.isArray(parsed.learnedGreetings) ? parsed.learnedGreetings : [],
          learnedVocabCounts:
            parsed.learnedVocabCounts && typeof parsed.learnedVocabCounts === "object"
              ? parsed.learnedVocabCounts
              : {},
          speechRateHint:
            typeof parsed.speechRateHint === "number" ? parsed.speechRateHint : 1.0,
          lastUpdated:
            typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : new Date().toISOString(),
        };
      }
    }
  } catch {}
  return { ...DEFAULT_PROFILE };
}

export function saveJarvisStyleProfile(profile: JarvisStyleProfile): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

export function learnFromUserUtterance(rawText: string): JarvisStyleProfile {
  const profile = loadJarvisStyleProfile();
  const norm = normalizePersianText(rawText);
  if (!norm) return profile;

  profile.totalTurns += 1;
  profile.lastUpdated = new Date().toISOString();

  // Detect casual vs formal pronouns & endings
  const casualHits = [
    "کن",
    "بگو",
    "بذار",
    "برام",
    "بهم",
    "میشه",
    "می شه",
    "میخوام",
    "می خوام",
    "رو ",
    "یه ",
    "داداش",
    "رفیق",
    "کاکو",
    "چطوری",
    "خوبی",
    "تو ",
    "بزن",
    "بیار",
    "باز کن",
    "ببند",
  ].filter((w) => norm.includes(w)).length;
  const formalHits = [
    "کنید",
    "بفرمایید",
    "لطفاً",
    "لطفا",
    "برایم",
    "می‌شود",
    "میشود",
    "می خواهم",
    "شما",
    "سپاس",
    "متشکرم",
  ].filter((w) => norm.includes(w)).length;

  if (casualHits > formalHits) {
    profile.tonePreference = "casual_warm";
    profile.preferredEndingStyle = "colloquial";
  } else if (formalHits > casualHits) {
    profile.tonePreference = "respectful_formal";
    profile.preferredEndingStyle = "formal";
  }

  // Detect dialect / regional speech traits
  const traitsSet = new Set(profile.dialectTraits);
  for (const rule of DIALECT_RULES) {
    if (rule.patterns.some((p) => norm.includes(normalizePersianText(p)))) {
      traitsSet.add(rule.trait);
    }
  }
  profile.dialectTraits = Array.from(traitsSet).slice(-4);

  // Learn preferred personal address term (e.g. کاکو / داداش / رفیق / آقا / مهندس)
  for (const addr of ADDRESS_CANDIDATES) {
    if (norm.includes(normalizePersianText(addr))) {
      profile.preferredAddressTerm = addr;
      break;
    }
  }

  // Collect driver's recurring personal expressions & greetings
  const sigSet = new Set(profile.signaturePhrases);
  for (const cand of SIGNATURE_CANDIDATES) {
    if (norm.includes(normalizePersianText(cand))) {
      sigSet.add(cand);
    }
  }
  profile.signaturePhrases = Array.from(sigSet).slice(-16);

  if (norm.includes("سلام") || norm.includes("چطوری") || norm.includes("خوبی")) {
    const snippet = rawText.trim().slice(0, 32);
    if (snippet) {
      const gSet = new Set(profile.learnedGreetings);
      gSet.add(snippet);
      profile.learnedGreetings = Array.from(gSet).slice(-6);
    }
  }

  // Learn frequent personal vocabulary words (>= 3 chars, excluding stop words)
  const words = norm.split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const counts = { ...profile.learnedVocabCounts };
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }
  const topVocab = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 35);
  profile.learnedVocabCounts = Object.fromEntries(topVocab);

  // Adapt speech speed slightly to utterance brevity (short punchy speakers get brisker pace)
  if (words.length <= 4) {
    profile.speechRateHint = 1.03;
  } else if (words.length >= 12) {
    profile.speechRateHint = 0.97;
  }

  saveJarvisStyleProfile(profile);
  return profile;
}

export function buildStyleInstructionForAI(profile?: Partial<JarvisStyleProfile>): string {
  const base = loadJarvisStyleProfile();
  const p: JarvisStyleProfile = { ...base, ...(profile || {}) };
  const toneDesc =
    p.tonePreference === "casual_warm"
      ? "لحن محاوره‌ای بسیار صمیمی و خودمانی (دقیقاً با افعال شکسته و گفتاری مثل می‌شه، برات، بذار، رو، بریم، حله)"
      : p.tonePreference === "respectful_formal"
        ? "لحن محترمانه، شیک و متین با استفاده از ضمیر «شما»"
        : "لحن گرم، زنده و طبیعی ایرانی";

  const dialectTraits = Array.isArray(p.dialectTraits) ? p.dialectTraits : [];
  const signaturePhrases = Array.isArray(p.signaturePhrases) ? p.signaturePhrases : [];

  const traits =
    dialectTraits.length > 0 ? dialectTraits.join("، ") : "فارسی محاوره‌ای روان";
  const words =
    signaturePhrases.length > 0
      ? `تکیه‌کلام‌ها و واژگان محبوب راننده: ${signaturePhrases.join("، ")}.`
      : "";
  const addr = p.preferredAddressTerm
    ? `هنگام خطاب قرار دادن صمیمی، طبیعی از کلماتی مثل «${p.preferredAddressTerm}» استفاده کن.`
    : "";
  const frequentWords = Object.entries(p.learnedVocabCounts || {})
    .filter(([, count]) => count >= 2)
    .slice(0, 8)
    .map(([w]) => w);
  const vocabNote =
    frequentWords.length > 0
      ? `کلمات پرتکرار در کلام راننده: ${frequentWords.join("، ")}.`
      : "";

  return `شخصیت و تقلید تدریجی لهجه (تعامل شماره ${Number(p.totalTurns || 0)}): دقیقاً مثل یک هم‌سفر ایرانی واقعی و دستیار صوتی زنده صحبت کن — طبیعی، روان، بدون لحن کتابی یا رباتیک. ${toneDesc}. الگوهای گفتاری و لهجه کشف‌شده از راننده: [${traits}]. ${words} ${addr} ${vocabNote} به تدریج و به‌شکل طبیعی ریتم کلام، لهجه و واژگان او را در پاسخ‌هایت بازتاب بده تا احساس هم‌صحبتی کاملاً شخصی داشته باشد.`;
}

export function adaptOfflineReplyToUserStyle(
  reply: string,
  profile?: Partial<JarvisStyleProfile>
): string {
  const base = loadJarvisStyleProfile();
  const p: JarvisStyleProfile = { ...base, ...(profile || {}) };
  if (!reply) return reply;

  const signaturePhrases = Array.isArray(p.signaturePhrases) ? p.signaturePhrases : [];
  let adapted = reply;

  // Even on turn 1+, convert stiff bookish Persian phrases to warm spoken Persian unless user prefers formal
  if (p.tonePreference !== "respectful_formal") {
    adapted = adapted
      .replace(/می‌باشد\./g, "هست.")
      .replace(/می‌باشند\./g, "هستند.")
      .replace(/گردید\./g, "شد.")
      .replace(/قرار دارد\./g, "هست.")
      .replace(/به‌صورت/g, "به شکل")
      .replace(/بفرمایید چه کاری براتون انجام بدم/g, "بگو چه کاری برات انجام بدم");
  }

  if (Number(p.totalTurns || 0) >= 2 && p.tonePreference === "casual_warm") {
    adapted = adapted
      .replace(/شما/g, "تو")
      .replace(/براتون/g, "برات")
      .replace(/صداتون/g, "صدات")
      .replace(/بفرمایید/g, "بگو ببینم")
      .replace(/در خدمت شما هستم/g, "در خدمتم رفیق")
      .replace(/است\./g, "هست.");

    const addr = p.preferredAddressTerm;
    if (addr) {
      if (adapted.includes("راننده عزیز")) {
        adapted = adapted.replace(/راننده عزیز/g, `${addr} جان`);
      } else if (adapted.includes("راننده")) {
        adapted = adapted.replace(/راننده/g, addr);
      }
    } else if (signaturePhrases.includes("کاکو") && !adapted.includes("کاکو")) {
      adapted = adapted.replace(/راننده عزیز/g, "کاکو جان");
    } else if (signaturePhrases.includes("داداش") && !adapted.includes("داداش")) {
      adapted = adapted.replace(/راننده عزیز/g, "داداش گلم");
    } else if (signaturePhrases.includes("رفیق") && !adapted.includes("رفیق")) {
      adapted = adapted.replace(/راننده عزیز/g, "رفیق جان");
    }

    if (signaturePhrases.includes("حله") && !adapted.includes("حله") && adapted.endsWith("شد.")) {
      adapted = `حله، ${adapted}`;
    } else if (
      signaturePhrases.includes("اوکی") &&
      !adapted.includes("اوکی") &&
      adapted.endsWith("شد.")
    ) {
      adapted = `اوکی، ${adapted}`;
    }
  }

  return adapted;
}
