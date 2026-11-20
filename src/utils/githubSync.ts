import { CarState, PreConditioningSchedule, RecordedSession } from "../types";

export interface GitHubSyncConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  lastSyncAt?: string;
  lastCommitUrl?: string;
}

export interface BmwSyncPayload {
  app: string;
  exportedAt: string;
  carState: CarState;
  diagnosticLogs: RecordedSession[];
  tripSummary: {
    tripDistanceKm: number;
    tripElapsedSeconds: number;
    oilMileageKm: number;
    oilEngineHours: number;
  };
  preConditionSchedule?: PreConditioningSchedule;
}

export interface GitHubVerifyResult {
  ok: boolean;
  message: string;
  isPrivate?: boolean;
  fullName?: string;
  defaultBranch?: string;
}

export interface GitHubSyncResult {
  success: boolean;
  message: string;
  commitUrl?: string;
  sha?: string;
  syncedAt?: string;
}

export interface GitHubRestoreResult {
  success: boolean;
  message: string;
  payload?: BmwSyncPayload;
}

const STORAGE_KEY = "bmw728li_github_sync_config";

export function getDefaultGitHubConfig(): GitHubSyncConfig {
  return {
    token: "",
    owner: "",
    repo: "bmw728li-diagnostics-backup",
    branch: "main",
    filePath: "backups/bmw728li-state.json",
  };
}

export function loadGitHubConfig(): GitHubSyncConfig {
  const fallback = getDefaultGitHubConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      token: typeof parsed.token === "string" ? parsed.token : "",
      owner: typeof parsed.owner === "string" ? parsed.owner : "",
      repo: typeof parsed.repo === "string" && parsed.repo.trim() ? parsed.repo : fallback.repo,
      branch: typeof parsed.branch === "string" && parsed.branch.trim() ? parsed.branch : fallback.branch,
      filePath:
        typeof parsed.filePath === "string" && parsed.filePath.trim()
          ? parsed.filePath
          : fallback.filePath,
      lastSyncAt: typeof parsed.lastSyncAt === "string" ? parsed.lastSyncAt : undefined,
      lastCommitUrl: typeof parsed.lastCommitUrl === "string" ? parsed.lastCommitUrl : undefined,
    };
  } catch {
    return fallback;
  }
}

export function saveGitHubConfig(config: GitHubSyncConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function clearGitHubToken(): GitHubSyncConfig {
  const current = loadGitHubConfig();
  const cleared: GitHubSyncConfig = {
    ...current,
    token: "",
  };
  saveGitHubConfig(cleared);
  return cleared;
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function decodeUtf8Base64(base64: string): string {
  const clean = base64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function sanitizePath(path: string): string {
  return path
    .trim()
    .replace(/^\/+/, "")
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function mapGitHubError(status: number, bodyMsg?: string): string {
  if (status === 401) {
    return "توکن گیت‌هاب (PAT) نامعتبر یا منقضی شده است.";
  }
  if (status === 403) {
    return "دسترسی توکن کافی نیست. لطفاً مجوز Contents (Read & Write) را برای مخزن فعال کنید.";
  }
  if (status === 404) {
    return "مخزن یا مسیر فایل در گیت‌هاب یافت نشد. نام کاربری و نام مخزن را بررسی کنید.";
  }
  if (status === 422) {
    return `خطای اعتبارسنجی شاخه یا SHA در گیت‌هاب: ${bodyMsg || "Unprocessable Entity"}`;
  }
  return bodyMsg ? `خطای گیت‌هاب (${status}): ${bodyMsg}` : `خطای ارتباط با گیت‌هاب (${status})`;
}

export async function verifyGitHubRepoConnection(
  config: GitHubSyncConfig
): Promise<GitHubVerifyResult> {
  const token = config.token.trim();
  const owner = config.owner.trim();
  const repo = config.repo.trim();

  if (!token || !owner || !repo) {
    return {
      ok: false,
      message: "لطفاً توکن دسترسی (PAT)، نام کاربری و نام مخزن را وارد کنید.",
    };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers: buildHeaders(token) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: mapGitHubError(res.status, data?.message),
      };
    }

    return {
      ok: true,
      message: `اتصال به مخزن ${data.full_name} (${data.private ? "Private" : "Public"}) برقرار شد.`,
      isPrivate: Boolean(data.private),
      fullName: data.full_name,
      defaultBranch: data.default_branch,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "خطای شبکه هنگام اتصال به GitHub API.",
    };
  }
}

export async function syncStateToGitHub(
  config: GitHubSyncConfig,
  payload: BmwSyncPayload
): Promise<GitHubSyncResult> {
  const token = config.token.trim();
  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const branch = (config.branch || "main").trim();
  const rawPath = (config.filePath || "backups/bmw728li-state.json").trim();

  if (!token || !owner || !repo) {
    return {
      success: false,
      message: "اطلاعات اتصال گیت‌هاب (توکن، مالک و نام مخزن) کامل نیست.",
    };
  }

  const encodedPath = sanitizePath(rawPath);
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
  const headers = buildHeaders(token);

  try {
    // 1. Check if file already exists on the target branch to obtain its SHA
    let existingSha: string | undefined;
    const checkRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });

    if (checkRes.ok) {
      const existingData = await checkRes.json();
      if (existingData && typeof existingData.sha === "string") {
        existingSha = existingData.sha;
      }
    } else if (checkRes.status !== 404) {
      const errData = await checkRes.json().catch(() => ({}));
      return {
        success: false,
        message: mapGitHubError(checkRes.status, errData?.message),
      };
    }

    // 2. Upload updated JSON snapshot
    const jsonContent = JSON.stringify(payload, null, 2);
    const putBody: Record<string, string> = {
      message: `chore(bmw728li): sync diagnostic logs & vehicle state (${new Date().toISOString()})`,
      content: encodeUtf8Base64(jsonContent),
      branch,
    };
    if (existingSha) {
      putBody.sha = existingSha;
    }

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(putBody),
    });

    const putData = await putRes.json().catch(() => ({}));
    if (!putRes.ok) {
      return {
        success: false,
        message: mapGitHubError(putRes.status, putData?.message),
      };
    }

    const syncedAt = new Date().toLocaleString("fa-IR");
    const commitUrl = putData?.commit?.html_url || putData?.content?.html_url;
    const sha = putData?.commit?.sha || putData?.content?.sha;

    return {
      success: true,
      message: "گزارش‌های دیاگ و وضعیت کامل خودرو با موفقیت در مخزن گیت‌هاب ذخیره شد.",
      commitUrl,
      sha,
      syncedAt,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "خطا در ارسال اطلاعات به مخزن گیت‌هاب.",
    };
  }
}

export async function restoreStateFromGitHub(
  config: GitHubSyncConfig
): Promise<GitHubRestoreResult> {
  const token = config.token.trim();
  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const branch = (config.branch || "main").trim();
  const rawPath = (config.filePath || "backups/bmw728li-state.json").trim();

  if (!token || !owner || !repo) {
    return {
      success: false,
      message: "برای بازیابی از گیت‌هاب، توکن، نام کاربری و نام مخزن را وارد کنید.",
    };
  }

  const encodedPath = sanitizePath(rawPath);
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

  try {
    const res = await fetch(apiUrl, { headers: buildHeaders(token) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: mapGitHubError(res.status, data?.message),
      };
    }

    if (!data?.content || typeof data.content !== "string") {
      return {
        success: false,
        message: "فایل انتخاب‌شده در مخزن گیت‌هاب فاقد محتوای معتبر است.",
      };
    }

    const decodedText = decodeUtf8Base64(data.content);
    const parsed = JSON.parse(decodedText) as BmwSyncPayload;
    if (!parsed || !parsed.carState) {
      return {
        success: false,
        message: "فرمت فایل بکاپ با ساختار وضعیت BMW 728Li مطابقت ندارد.",
      };
    }

    return {
      success: true,
      message: "وضعیت خودرو و لاگ‌های دیاگ با موفقیت از مخزن گیت‌هاب بازیابی شد.",
      payload: parsed,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "خطا در خواندن فایل بکاپ از گیت‌هاب.",
    };
  }
}
