import { runMonitorAutoResetAndMatch } from "./headunitAutoSync";

export const APP_BUILD_VERSION = "2.6.0";
export const OTA_STORAGE_KEY = "bmw728li_ota_status_v1";

export interface HeadunitOtaStatus {
  installedVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  cachedAssetsCount: number;
  lastSyncedAt: string;
  latestCommitSha?: string;
  installedResources: string[];
  summaryFa: string;
}

export function loadSavedOtaStatus(): HeadunitOtaStatus {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(OTA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.installedVersion === "string") {
          return parsed as HeadunitOtaStatus;
        }
      }
    } catch {}
  }
  return {
    installedVersion: APP_BUILD_VERSION,
    latestVersion: APP_BUILD_VERSION,
    updateAvailable: false,
    cachedAssetsCount: 0,
    lastSyncedAt: "هنوز همگام‌سازی نشده",
    installedResources: [],
    summaryFa: "آماده بررسی و دانلود بسته‌های مورد نیاز مانیتور هنگام اتصال به اینترنت.",
  };
}

export async function runHeadunitAutoUpdateAndResourceSync(options?: {
  silent?: boolean;
}): Promise<HeadunitOtaStatus> {
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const nowLabel = new Date().toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!isOnline) {
    const prev = loadSavedOtaStatus();
    return {
      ...prev,
      summaryFa: "اینترنت متصل نیست؛ پس از اتصال به وای‌فای یا هات‌اسپات موبایل، بروزرسانی خودکار انجام می‌شود.",
    };
  }

  let latestVersion = APP_BUILD_VERSION;
  let updateAvailable = false;
  let latestCommitSha: string | undefined;
  let requiredAssets: string[] = [
    "/",
    "/icon.svg",
    "/pwa-192x192.png",
    "/pwa-512x512.png",
    "/apple-touch-icon.png",
    "/manifest.webmanifest",
  ];

  // 1. Check local/cloud server manifest & required resources
  try {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), 4500);
    const res = await fetch("/api/headunit/version", {
      signal: controller.signal,
      cache: "no-store",
    });
    window.clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.version === "string" && data.version.trim()) {
        latestVersion = data.version.trim();
        updateAvailable = latestVersion !== APP_BUILD_VERSION;
      }
      if (Array.isArray(data.requiredAssets) && data.requiredAssets.length > 0) {
        requiredAssets = data.requiredAssets;
      }
    }
  } catch {}

  // 2. Check GitHub main commit silently if reachable
  try {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), 4000);
    const ghRes = await fetch(
      "https://api.github.com/repos/mohtaghi6-lab/bmw728li-idrive-cockpit/commits/main",
      { signal: controller.signal }
    );
    window.clearTimeout(t);
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      if (ghData?.sha) {
        latestCommitSha = String(ghData.sha).slice(0, 7);
      }
    }
  } catch {}

  // 3. Trigger Service Worker update so updated JS/CSS chunks download cleanly
  let swUpdated = false;
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting || reg.installing) {
          swUpdated = true;
        }
      }
    } catch {}
  }

  // 4. Pre-download & cache all essential offline packages & assets
  const downloaded: string[] = [];
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open("bmw728li-ota-essentials-v1");
      await Promise.all(
        requiredAssets.map(async (assetUrl) => {
          try {
            const resp = await fetch(assetUrl, { cache: "reload" });
            if (resp.ok || resp.type === "opaque") {
              await cache.put(assetUrl, resp.clone());
              downloaded.push(assetUrl);
            }
          } catch {}
        })
      );
    } catch {}
  }

  // 5. Re-verify headunit display/audio/CAN-Bus calibration profile
  if (!options?.silent) {
    runMonitorAutoResetAndMatch("auto-install");
  }

  const status: HeadunitOtaStatus = {
    installedVersion: APP_BUILD_VERSION,
    latestVersion,
    updateAvailable: updateAvailable || swUpdated,
    cachedAssetsCount: downloaded.length,
    lastSyncedAt: nowLabel,
    latestCommitSha,
    installedResources: downloaded,
    summaryFa:
      updateAvailable || swUpdated
        ? `نسخه جدید مانیتور (${latestVersion}) و ${downloaded.length} بسته ضروری دانلود و آماده اجرا شد.`
        : `مانیتور کاملاً به‌روز است (نسخه ${APP_BUILD_VERSION}) و ${downloaded.length} بسته آفلاین ضروری همگام‌سازی شد.`,
  };

  try {
    localStorage.setItem(OTA_STORAGE_KEY, JSON.stringify(status));
  } catch {}

  return status;
}
