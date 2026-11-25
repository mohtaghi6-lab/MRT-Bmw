import { normalizePersianText } from "./offlineEngine";

const WAKE_PATTERNS = [
  "سلام جارویز",
  "سلام جارویس",
  "هی جارویز",
  "هی جارویس",
  "بیدار شو جارویز",
  "بیدار شو جارویس",
  "الو جارویز",
  "الو جارویس",
  "جانم جارویز",
  "جانم جارویس",
  "آهای جارویز",
  "آهای جارویس",
  "hey jarvis",
  "hi jarvis",
  "ok jarvis",
  "hello jarvis",
  "جارویز",
  "جارویس",
  "جار ویز",
  "جار ویس",
  "جا رویز",
  "جا رویس",
  "جارو یز",
  "جارو یس",
  "جرویز",
  "جرویس",
  "جر ویز",
  "جر ویس",
  "ژارویز",
  "ژارویس",
  "ژار ویز",
  "ژار ویس",
  "چارویز",
  "چارویس",
  "یارویز",
  "یارویس",
  "دارویز",
  "دارویس",
  "کارویز",
  "کارویس",
  "گارویز",
  "گارویس",
  "جارویش",
  "جاروئیس",
  "جاروئز",
  "جاربیز",
  "جاربیس",
  "jarvis",
  "jarviz",
  "jarves",
  "gervis",
];

// Phonetic fallback regex for Persian STT variations of "Jarvis" (avoids common words like سرویس)
const PHONETIC_JARVIS_REGEX =
  /(?:^|\s)([جژچگ]\s*[اآ]?\s*ر\s*[وب]\s*[ییئ]?\s*[زسش]|jarv[aeiuo][sz]|jerv[aeiuo][sz])(?:\s|$)/i;

const GOODBYE_PATTERNS = [
  "خداحافظ جارویز",
  "خداحافظ جارویس",
  "خدا حافظ جارویز",
  "خدا حافظ جارویس",
  "خدافظ جارویز",
  "خدافظ جارویس",
  "بای جارویز",
  "بای جارویس",
  "فعلا جارویز",
  "فعلا جارویس",
  "پایان صحبت جارویز",
  "پایان صحبت جارویس",
  "پایان صحبت",
  "خداحافظی با جارویز",
  "خداحافظی با جارویس",
  "خاموش شو جارویز",
  "خاموش شو جارویس",
  "goodbye jarvis",
  "bye jarvis",
];

export function matchJarvisGoodbye(rawText: string): boolean {
  const norm = normalizePersianText(rawText);
  if (!norm) return false;
  return GOODBYE_PATTERNS.some((p) => norm.includes(normalizePersianText(p)));
}

export function matchJarvisWake(rawText: string): {
  woke: boolean;
  remainderCommand: string;
} {
  const norm = normalizePersianText(rawText);
  if (!norm || matchJarvisGoodbye(norm)) {
    return { woke: false, remainderCommand: "" };
  }

  for (const pattern of WAKE_PATTERNS) {
    const normPattern = normalizePersianText(pattern);
    if (norm === normPattern || norm.includes(normPattern)) {
      const remainder = norm.replace(normPattern, " ").replace(/\s+/g, " ").trim();
      return {
        woke: true,
        remainderCommand: remainder,
      };
    }
  }

  const phoneticMatch = norm.match(PHONETIC_JARVIS_REGEX);
  if (phoneticMatch) {
    const matchedToken = phoneticMatch[1] || phoneticMatch[0];
    const remainder = norm.replace(matchedToken, " ").replace(/\s+/g, " ").trim();
    return {
      woke: true,
      remainderCommand: remainder,
    };
  }

  return { woke: false, remainderCommand: "" };
}

export function matchJarvisWakeFromAlternatives(resultItem: any): {
  woke: boolean;
  remainderCommand: string;
} {
  if (!resultItem) return { woke: false, remainderCommand: "" };
  const len = typeof resultItem.length === "number" ? resultItem.length : 1;
  for (let i = 0; i < len; i++) {
    const transcript = resultItem[i]?.transcript || "";
    const match = matchJarvisWake(transcript);
    if (match.woke) return match;
  }
  return { woke: false, remainderCommand: "" };
}
