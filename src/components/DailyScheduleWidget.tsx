import React, { useCallback, useEffect, useState } from "react";
import { User } from "firebase/auth";
import {
  Calendar,
  Clock,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import {
  CalendarMeetingEvent,
  clearCachedCalendarToken,
  fetchTodaysCalendarEvents,
  getCalendarAccessToken,
  googleSignInForCalendar,
  initCalendarAuth,
  logoutCalendarAuth,
} from "../utils/googleCalendar";
import { carAudio } from "../utils/carSpeech";

interface DailyScheduleWidgetProps {
  onNavigateToLocation?: (location: string, meetingTitle: string) => void;
  isOnline?: boolean;
}

const CACHED_EVENTS_KEY = "bmw728li_daily_schedule_cache_v1";
const LOCAL_MEETINGS_KEY = "bmw728li_local_meetings_v1";

interface LocalMeetingEntry {
  id: string;
  title: string;
  timeHHMM: string;
  location: string;
}

function formatCountdownLabel(minutes: number): string {
  if (minutes <= 0) return "اکنون";
  if (minutes < 60) return `تا ${minutes} دقیقه دیگر`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `تا ${h} ساعت و ${m} دقیقه دیگر` : `تا ${h} ساعت دیگر`;
}

function hydrateLocalMeetings(entries: LocalMeetingEntry[]): CalendarMeetingEvent[] {
  const now = new Date();
  const nowMs = now.getTime();
  return entries.map((entry) => {
    const [hhStr, mmStr] = entry.timeHHMM.split(":");
    const start = new Date(now);
    start.setHours(Number(hhStr) || 9, Number(mmStr) || 0, 0, 0);
    const end = new Date(start.getTime() + 45 * 60_000);
    const startMs = start.getTime();
    const endMs = end.getTime();
    const status: CalendarMeetingEvent["status"] =
      nowMs >= startMs && nowMs <= endMs
        ? "ongoing"
        : nowMs < startMs
          ? "upcoming"
          : "past";
    const minutesUntilStart = Math.max(0, Math.round((startMs - nowMs) / 60_000));
    return {
      id: entry.id,
      title: entry.title,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      startTimeFormatted: entry.timeHHMM,
      endTimeFormatted: end.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false }),
      isAllDay: false,
      location: entry.location || undefined,
      status,
      minutesUntilStart,
    };
  });
}

export default function DailyScheduleWidget({
  onNavigateToLocation,
  isOnline = true,
}: DailyScheduleWidgetProps) {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [remoteEvents, setRemoteEvents] = useState<CalendarMeetingEvent[]>(() => {
    try {
      const raw = localStorage.getItem(CACHED_EVENTS_KEY);
      if (raw) return JSON.parse(raw) as CalendarMeetingEvent[];
    } catch {}
    return [];
  });
  const [localEntries, setLocalEntries] = useState<LocalMeetingEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_MEETINGS_KEY);
      if (raw) return JSON.parse(raw) as LocalMeetingEntry[];
    } catch {}
    return [
      {
        id: "local-bmw-checkup",
        title: "سرویس دوره‌ای و چکاپ BMW 728Li",
        timeHHMM: "16:30",
        location: "مرکز تخصصی BMW پرشیا خودرو",
      },
    ];
  });
  const [showAddLocalForm, setShowAddLocalForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("14:00");
  const [newLocation, setNewLocation] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>("");

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(localEntries));
    } catch {}
  }, [localEntries]);

  const loadEvents = useCallback(
    async (explicitToken?: string) => {
      if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
        return;
      }
      const token = explicitToken || (await getCalendarAccessToken());
      if (!token) {
        setNeedsAuth(true);
        return;
      }

      setLoading(true);
      setErrorMsg(null);
      try {
        const todaysEvents = await fetchTodaysCalendarEvents(token);
        setRemoteEvents(todaysEvents);
        try {
          localStorage.setItem(CACHED_EVENTS_KEY, JSON.stringify(todaysEvents));
        } catch {}
        setLastUpdatedLabel(
          new Date().toLocaleTimeString("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      } catch (err: any) {
        if (err?.code === 401 || err?.message === "UNAUTHORIZED") {
          clearCachedCalendarToken();
          setNeedsAuth(true);
          setErrorMsg("نشست دسترسی به تقویم منقضی شد. لطفاً دوباره وارد شوید.");
        } else {
          setErrorMsg(err?.message || "خطا در بارگذاری جلسات امروز.");
        }
      } finally {
        setLoading(false);
      }
    },
    [isOnline]
  );

  useEffect(() => {
    const unsubscribe = initCalendarAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setNeedsAuth(false);
        void loadEvents(token);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [loadEvents]);

  const handleLogin = async () => {
    carAudio.playButtonTap();
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setErrorMsg("در حال حاضر اینترنت قطع است؛ از لیست جلسات آفلاین خودرو استفاده کنید.");
      return;
    }
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const result = await googleSignInForCalendar();
      setUser(result.user);
      setNeedsAuth(false);
      await loadEvents(result.accessToken);
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setErrorMsg(err?.message || "ورود با حساب گوگل انجام نشد.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    carAudio.playButtonTap();
    await logoutCalendarAuth();
    setUser(null);
    setRemoteEvents([]);
    try {
      localStorage.removeItem(CACHED_EVENTS_KEY);
    } catch {}
    setNeedsAuth(true);
    setErrorMsg(null);
  };

  const handleAddLocalMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    carAudio.playButtonTap();
    setLocalEntries((prev) => [
      ...prev,
      {
        id: "local-" + Date.now(),
        title: newTitle.trim(),
        timeHHMM: newTime || "12:00",
        location: newLocation.trim(),
      },
    ]);
    setNewTitle("");
    setNewLocation("");
    setShowAddLocalForm(false);
  };

  const handleDeleteLocalMeeting = (id: string) => {
    carAudio.playButtonTap();
    setLocalEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const handleNavigate = (event: CalendarMeetingEvent) => {
    if (!event.location) return;
    carAudio.playBmwGong();
    onNavigateToLocation?.(event.location, event.title);
  };

  const events: CalendarMeetingEvent[] = [
    ...remoteEvents,
    ...hydrateLocalMeetings(localEntries),
  ].sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  const upcomingOrOngoing = events.filter(
    (e) => e.status === "ongoing" || e.status === "upcoming"
  );
  const nextPriorityMeeting = upcomingOrOngoing[0] || null;
  const pastMeetingsCount = events.filter((e) => e.status === "past").length;

  return (
    <section
      id="daily-schedule-widget"
      aria-label="برنامه روزانه و جلسات تقویم"
      className="cockpit-panel rounded-3xl p-4 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl border bmw-accent-surface flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
              برنامه روزانه و جلسات امروز (Daily Schedule)
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {!isOnline
                ? `حالت آفلاین خودرو · ${upcomingOrOngoing.length} جلسه ذخیره شده`
                : needsAuth
                  ? "تقویم گوگل + جلسات آفلاین خودرو با پیشنهاد خودکار مسیریابی"
                  : `${upcomingOrOngoing.length} جلسه پیش‌رو · ${pastMeetingsCount} انجام‌شده${
                      lastUpdatedLabel ? ` · بروزرسانی ${lastUpdatedLabel}` : ""
                    }`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 px-2 py-1 rounded-lg bg-amber-950/50 border border-amber-500/30">
              <WifiOff className="w-3 h-3" />
              <span>آفلاین</span>
            </span>
          )}
          <button
            id="daily-schedule-add-local-btn"
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              setShowAddLocalForm((prev) => !prev);
            }}
            className="px-2.5 py-1.5 rounded-xl hardware-key text-[11px] font-semibold text-slate-200 hover:text-white flex items-center gap-1 active:scale-95"
            title="افزودن جلسه آفلاین به حافظه خودرو"
          >
            <Plus className="w-3.5 h-3.5 bmw-accent-text" />
            <span>جلسه آفلاین</span>
          </button>

          {!needsAuth && (
            <>
              {user?.email && (
                <span
                  className="hidden sm:inline text-[10px] font-mono text-slate-400 truncate max-w-[120px]"
                  dir="ltr"
                >
                  {user.email}
                </span>
              )}
              <button
                id="daily-schedule-refresh-btn"
                type="button"
                onClick={() => {
                  carAudio.playButtonTap();
                  void loadEvents();
                }}
                disabled={loading || !isOnline}
                className="p-2 rounded-xl hardware-key text-slate-300 hover:text-white active:scale-95 disabled:opacity-50"
                title="بروزرسانی جلسات امروز"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin bmw-accent-text" : ""}`} />
              </button>
              <button
                id="daily-schedule-logout-btn"
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl hardware-key text-slate-400 hover:text-rose-300 active:scale-95"
                title="خروج از تقویم گوگل"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Local Offline Meeting Form */}
      {showAddLocalForm && (
        <form
          onSubmit={handleAddLocalMeeting}
          className="instrument-well rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="عنوان جلسه یا قرار امروز..."
            className="sm:col-span-5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-sky-500"
            required
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="sm:col-span-2 px-2.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-white outline-none focus:border-sky-500"
            dir="ltr"
          />
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="آدرس مقصد (برای ناوبری)..."
            className="sm:col-span-3 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="sm:col-span-2 px-3 py-2 rounded-xl bmw-accent-btn text-xs font-bold active:scale-95"
          >
            ثبت آفلاین
          </button>
        </form>
      )}

      {/* Error State */}
      {errorMsg && (
        <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-rose-200">
          <TriangleAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Optional Google Calendar Sign-In Card when Online & Unauthenticated */}
      {needsAuth && isOnline && (
        <div className="instrument-well rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="space-y-0.5 text-center sm:text-right">
            <p className="text-xs font-bold text-slate-100">
              اتصال به Google Calendar (اختیاری در حالت آنلاین)
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              با اتصال حساب گوگل، جلسات تقویم روی خودرو همگام و برای اجرای آفلاین کش می‌شوند.
            </p>
          </div>

          <button
            id="google-calendar-signin-btn"
            type="button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="gsi-material-button shrink-0"
          >
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="block w-full h-full"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span>{isLoggingIn ? "در حال اتصال..." : "Sign in with Google"}</span>
            </div>
          </button>
        </div>
      )}

      {/* Events List (Works Offline via Cached + Local Meetings) */}
      {loading && events.length === 0 ? (
        /* Loading Skeleton */
        <div className="instrument-well rounded-2xl p-3 space-y-2.5 animate-pulse">
          <div className="h-4 bg-white/10 rounded w-2/3" />
          <div className="h-3 bg-white/[0.06] rounded w-1/2" />
          <div className="h-10 bg-white/[0.05] rounded-xl w-full" />
        </div>
      ) : events.length === 0 ? (
        /* Empty State */
        <div className="instrument-well rounded-2xl p-4 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-300">
            هیچ رویداد یا جلسه‌ای برای امروز در تقویم شما ثبت نشده است.
          </p>
          <p className="text-[11px] text-slate-500">
            رویدادهای جدید با آدرس مکان به‌صورت خودکار گزینه مسیریابی سریع را نمایش می‌دهند.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Navigation Prompt Banner for Next Upcoming Meeting with Location */}
          {nextPriorityMeeting && nextPriorityMeeting.location && (
            <div
              id="daily-schedule-nav-prompt"
              className="rounded-2xl p-3 border bmw-accent-surface flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Navigation className="w-4 h-4 bmw-accent-text shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-white flex-wrap">
                    <span>پیشنهاد مسیریابی جلسه بعدی:</span>
                    <span className="bmw-accent-text truncate">{nextPriorityMeeting.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    مقصد: {nextPriorityMeeting.location} ·{" "}
                    <span className="font-mono">
                      {nextPriorityMeeting.isAllDay
                        ? "تمام روز"
                        : `${nextPriorityMeeting.startTimeFormatted} (${formatCountdownLabel(
                            nextPriorityMeeting.minutesUntilStart
                          )})`}
                    </span>
                  </p>
                </div>
              </div>

              <button
                id="daily-schedule-start-nav-btn"
                type="button"
                onClick={() => handleNavigate(nextPriorityMeeting)}
                className="px-3.5 py-2 rounded-xl bmw-accent-btn text-xs font-bold flex items-center gap-1.5 transition hover:brightness-110 active:scale-95 whitespace-nowrap shrink-0"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>شروع مسیریابی</span>
              </button>
            </div>
          )}

          {/* Parsed Events List */}
          <div className="instrument-well rounded-2xl divide-y divide-white/[0.06] max-h-60 overflow-y-auto">
            {events.map((ev) => {
              const isPast = ev.status === "past";
              const isOngoing = ev.status === "ongoing";

              return (
                <div
                  key={ev.id}
                  className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                    isPast ? "opacity-55" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Time Readout */}
                    <div
                      className="min-w-[68px] text-center font-mono tabular-nums text-[11px] shrink-0 pt-0.5"
                      dir="ltr"
                    >
                      <div
                        className={`font-bold ${
                          isOngoing
                            ? "text-emerald-400"
                            : isPast
                              ? "text-slate-500"
                              : "bmw-accent-text"
                        }`}
                      >
                        {ev.startTimeFormatted}
                      </div>
                      {!ev.isAllDay && ev.endTimeFormatted && (
                        <div className="text-[10px] text-slate-500">{ev.endTimeFormatted}</div>
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-100 truncate">
                          {ev.title}
                        </h4>
                        <span
                          className={`text-[10px] font-medium ${
                            isOngoing
                              ? "text-emerald-400"
                              : isPast
                                ? "text-slate-500"
                                : "text-amber-300"
                          }`}
                        >
                          ·{" "}
                          {isOngoing
                            ? "در حال برگزاری"
                            : isPast
                              ? "پایان‌یافته"
                              : formatCountdownLabel(ev.minutesUntilStart)}
                        </span>
                      </div>

                      {ev.location ? (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                          <MapPin className="w-3 h-3 bmw-accent-text shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>بدون موقعیت مکانی ثبت‌شده</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Per-Meeting Actions (Navigation & Local Meeting Delete) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {ev.location && (
                      <button
                        type="button"
                        onClick={() => handleNavigate(ev)}
                        className="px-2.5 py-1.5 rounded-xl hardware-key text-[11px] font-semibold text-slate-200 hover:text-white flex items-center gap-1 active:scale-95 whitespace-nowrap shrink-0"
                        title={`مسیریابی به ${ev.location}`}
                      >
                        <Navigation className="w-3 h-3 bmw-accent-text" />
                        <span>مسیر</span>
                      </button>
                    )}
                    {ev.id.startsWith("local-") && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLocalMeeting(ev.id)}
                        className="p-1.5 rounded-xl hardware-key text-slate-400 hover:text-rose-400 active:scale-95"
                        title="حذف جلسه آفلاین"
                        aria-label="حذف جلسه آفلاین"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
