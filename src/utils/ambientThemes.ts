export type AmbientLightingThemeId =
  | "cognac-gold"
  | "classic-orange"
  | "sport-red"
  | "modern-blue"
  | "emerald-touring"
  | "executive-violet"
  | "polar-white";

export interface AmbientThemeConfig {
  id: AmbientLightingThemeId;
  labelEn: string;
  labelFa: string;
  descriptionFa: string;
  primaryHex: string;
  secondaryHex: string;
  textHex: string;
  buttonTextHex: string;
  softBg: string;
  borderHex: string;
  glowHex: string;
}

export const AMBIENT_LIGHTING_THEMES: AmbientThemeConfig[] = [
  {
    id: "cognac-gold",
    labelEn: "Cognac Glass",
    labelFa: "قهوه‌ای روشن شیشه‌ای",
    descriptionFa: "چرم تارتوفو و شیشه گرم لوکس BMW Individual",
    primaryHex: "#d99b52",
    secondaryHex: "#b67231",
    textHex: "#f7d4a6",
    buttonTextHex: "#1c110a",
    softBg: "rgba(217, 155, 82, 0.22)",
    borderHex: "rgba(240, 190, 130, 0.45)",
    glowHex: "rgba(217, 155, 82, 0.35)",
  },
  {
    id: "classic-orange",
    labelEn: "Classic Orange",
    labelFa: "نارنجی کلاسیک BMW",
    descriptionFa: "نورپردازی اصیل امبر کلاسیک اتاق E38",
    primaryHex: "#f97316",
    secondaryHex: "#ea580c",
    textHex: "#fdba74",
    buttonTextHex: "#09090b",
    softBg: "rgba(249, 115, 22, 0.18)",
    borderHex: "rgba(249, 115, 22, 0.45)",
    glowHex: "rgba(249, 115, 22, 0.35)",
  },
  {
    id: "sport-red",
    labelEn: "Sport Red",
    labelFa: "قرمز اسپرت M",
    descriptionFa: "تم تهاجمی و مسابقه‌ای M-Power",
    primaryHex: "#ef4444",
    secondaryHex: "#dc2626",
    textHex: "#fca5a5",
    buttonTextHex: "#ffffff",
    softBg: "rgba(239, 68, 68, 0.18)",
    borderHex: "rgba(239, 68, 68, 0.45)",
    glowHex: "rgba(239, 68, 68, 0.35)",
  },
  {
    id: "modern-blue",
    labelEn: "Modern Blue",
    labelFa: "آبی مدرن iDrive",
    descriptionFa: "نورپردازی مدرن آبی یخی BMW",
    primaryHex: "#0ea5e9",
    secondaryHex: "#2563eb",
    textHex: "#7dd3fc",
    buttonTextHex: "#ffffff",
    softBg: "rgba(14, 165, 233, 0.16)",
    borderHex: "rgba(14, 165, 233, 0.45)",
    glowHex: "rgba(14, 165, 233, 0.35)",
  },
  {
    id: "emerald-touring",
    labelEn: "Emerald Green",
    labelFa: "سبز زمردی تورینگ",
    descriptionFa: "نورپردازی آرامش‌بخش سفرهای شبانه",
    primaryHex: "#10b981",
    secondaryHex: "#059669",
    textHex: "#6ee7b7",
    buttonTextHex: "#09090b",
    softBg: "rgba(16, 185, 129, 0.16)",
    borderHex: "rgba(16, 185, 129, 0.45)",
    glowHex: "rgba(16, 185, 129, 0.35)",
  },
  {
    id: "executive-violet",
    labelEn: "Executive Lilac",
    labelFa: "بنفش تشریفاتی",
    descriptionFa: "نور مخفی کابین لیموزین سری ۷",
    primaryHex: "#a855f7",
    secondaryHex: "#7c3aed",
    textHex: "#d8b4fe",
    buttonTextHex: "#ffffff",
    softBg: "rgba(168, 85, 247, 0.16)",
    borderHex: "rgba(168, 85, 247, 0.45)",
    glowHex: "rgba(168, 85, 247, 0.35)",
  },
  {
    id: "polar-white",
    labelEn: "Polar White",
    labelFa: "سفید یخی خالص",
    descriptionFa: "نورپردازی کریستالی مینیمال روزانه",
    primaryHex: "#e2e8f0",
    secondaryHex: "#94a3b8",
    textHex: "#f8fafc",
    buttonTextHex: "#09090b",
    softBg: "rgba(226, 232, 240, 0.16)",
    borderHex: "rgba(226, 232, 240, 0.45)",
    glowHex: "rgba(226, 232, 240, 0.28)",
  },
];

export const DEFAULT_AMBIENT_THEME_ID: AmbientLightingThemeId = "classic-orange";

export function getAmbientTheme(id?: string): AmbientThemeConfig {
  return (
    AMBIENT_LIGHTING_THEMES.find((t) => t.id === id) ||
    AMBIENT_LIGHTING_THEMES.find((t) => t.id === DEFAULT_AMBIENT_THEME_ID) ||
    AMBIENT_LIGHTING_THEMES[0]
  );
}

export function applyAmbientThemeCssVars(theme: AmbientThemeConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--bmw-accent", theme.primaryHex);
  root.style.setProperty("--bmw-accent-2", theme.secondaryHex);
  root.style.setProperty("--bmw-accent-text", theme.textHex);
  root.style.setProperty("--bmw-accent-btn-text", theme.buttonTextHex);
  root.style.setProperty("--bmw-accent-soft", theme.softBg);
  root.style.setProperty("--bmw-accent-border", theme.borderHex);
  root.style.setProperty("--bmw-accent-glow", theme.glowHex);
}
