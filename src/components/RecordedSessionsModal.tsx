import { useState } from "react";
import {
  X,
  Trash2,
  Calendar,
  Clock,
  Download,
  ShieldCheck,
  Activity,
  Cpu,
  FileText,
} from "lucide-react";
import { RecordedSession } from "../types";
import { carAudio } from "../utils/carSpeech";

interface RecordedSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: RecordedSession[];
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
}

export default function RecordedSessionsModal({
  isOpen,
  onClose,
  sessions,
  onDeleteSession,
  onClearAll,
}: RecordedSessionsModalProps) {
  const [selectedSession, setSelectedSession] = useState<RecordedSession | null>(null);

  if (!isOpen) return null;

  const handleExportSession = (session: RecordedSession) => {
    carAudio.playButtonTap();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `car-diagnostic-log-${session.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      id="recorded-sessions-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-fadeIn"
      dir="rtl"
      onClick={onClose}
    >
      <div
        id="recorded-sessions-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>گزارشات دیاگ، سفرها و وضعیت فنی خودرو</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  {sessions.length} گزارش
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ثبت تاریخچه عملکرد سنسورها، خطاهای دیاگ DME، سیستم Double-VANOS و پیمایش BMW 728Li
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessions.length > 0 && (
              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  if (confirm("آیا مایل به پاکسازی تمامی گزارش‌ها هستید؟")) {
                    onClearAll();
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-600/40 text-rose-300 text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
                title="پاکسازی تمام تاریخچه"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف همه</span>
              </button>
            )}

            <button
              onClick={() => {
                carAudio.playButtonTap();
                onClose();
              }}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: List of Logs */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {sessions.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
              <FileText className="w-12 h-12 text-slate-600" />
              <p className="text-sm font-bold text-slate-300">هنوز گزارشی ثبت نشده است.</p>
              <p className="text-xs text-slate-500 max-w-sm">
                اطلاعات دیاگ و پیمایش خودرو به صورت خودکار در این بخش ذخیره می‌شوند.
              </p>
            </div>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 transition flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white">{sess.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{sess.startTime}</span>
                    </span>

                    <button
                      onClick={() => handleExportSession(sess)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs transition"
                      title="دانلود خروجی JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        carAudio.playButtonTap();
                        onDeleteSession(sess.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-rose-300 text-xs transition"
                      title="حذف گزارش"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Log entries */}
                <div className="space-y-1.5 text-xs">
                  {sess.turns.map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-start gap-2"
                    >
                      <span className="text-[10px] text-cyan-400 font-mono shrink-0 mt-0.5">
                        [{t.timestamp}]
                      </span>
                      <span className="text-slate-300">{t.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
