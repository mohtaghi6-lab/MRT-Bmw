import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// In-memory cache ONLY for the OAuth access token (never localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface RawGoogleCalendarEvent {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

export interface CalendarMeetingEvent {
  id: string;
  title: string;
  location?: string;
  isAllDay: boolean;
  startIso: string;
  endIso: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  status: "ongoing" | "upcoming" | "past";
  minutesUntilStart: number;
  htmlLink?: string;
}

export const initCalendarAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignInForCalendar = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("دریافت توکن دسترسی تقویم گوگل ناموفق بود.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getCalendarAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearCachedCalendarToken = (): void => {
  cachedAccessToken = null;
};

export const logoutCalendarAuth = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

function formatTimeHHMM(date: Date): string {
  return date.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function parseCalendarEventsForDay(
  rawItems: RawGoogleCalendarEvent[],
  now: Date = new Date()
): CalendarMeetingEvent[] {
  const nowMs = now.getTime();
  const parsed: CalendarMeetingEvent[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const ev = rawItems[i];
    if (!ev || ev.status === "cancelled") continue;

    const isAllDay = Boolean(ev.start?.date && !ev.start?.dateTime);
    const startRaw = ev.start?.dateTime || ev.start?.date;
    const endRaw = ev.end?.dateTime || ev.end?.date || startRaw;
    if (!startRaw || !endRaw) continue;

    const startDate = isAllDay ? new Date(`${startRaw}T00:00:00`) : new Date(startRaw);
    const endDate = isAllDay ? new Date(`${endRaw}T00:00:00`) : new Date(endRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) continue;

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    let status: "ongoing" | "upcoming" | "past" = "upcoming";
    if (isAllDay) {
      status = "ongoing";
    } else if (nowMs >= startMs && nowMs <= endMs) {
      status = "ongoing";
    } else if (nowMs > endMs) {
      status = "past";
    }

    const minutesUntilStart = Math.round((startMs - nowMs) / 60000);
    const trimmedLocation = typeof ev.location === "string" ? ev.location.trim() : "";

    parsed.push({
      id: ev.id || `cal-ev-${i}`,
      title: (ev.summary || "جلسه بدون عنوان").trim(),
      location: trimmedLocation || undefined,
      isAllDay,
      startIso: startRaw,
      endIso: endRaw,
      startTimeFormatted: isAllDay ? "تمام روز" : formatTimeHHMM(startDate),
      endTimeFormatted: isAllDay ? "" : formatTimeHHMM(endDate),
      status,
      minutesUntilStart,
      htmlLink: ev.htmlLink,
    });
  }

  return parsed;
}

export async function fetchTodaysCalendarEvents(
  accessToken: string
): Promise<CalendarMeetingEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "25",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (res.status === 401) {
    cachedAccessToken = null;
    const err = new Error("UNAUTHORIZED");
    (err as any).code = 401;
    throw err;
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `خطا در دریافت رویدادهای تقویم (${res.status})`);
  }

  const data = await res.json();
  const rawItems = Array.isArray(data?.items) ? (data.items as RawGoogleCalendarEvent[]) : [];
  return parseCalendarEventsForDay(rawItems, now);
}
