import { useState, useRef, ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Radio,
  FolderOpen,
  Disc3,
  Usb,
  Search,
  CheckCircle2,
  Trash2,
  HardDriveDownload,
} from "lucide-react";
import { CarState, MusicTrack } from "../types";
import { carAudio } from "../utils/carSpeech";

interface MusicPlayerProps {
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  playlist: MusicTrack[];
  setPlaylist: Dispatch<SetStateAction<MusicTrack[]>>;
  currentTrackIndex: number;
  setCurrentTrackIndex: (idx: number) => void;
  audioProgress?: number;
  audioCurrentTime?: string;
  onSeekAudio?: (percent: number) => void;
  onUploadUsbFiles?: (files: FileList | File[]) => Promise<void>;
  onConnectUsbFolder?: () => Promise<boolean>;
  onRemoveUsbTrack?: (trackId: string) => Promise<void>;
  onClearUsbVault?: () => Promise<void>;
  usbSavedCount?: number;
  usbFolderName?: string;
}

export default function MusicPlayerModule({
  carState,
  onUpdateCarState,
  playlist,
  setPlaylist,
  currentTrackIndex,
  setCurrentTrackIndex,
  audioProgress = 0,
  audioCurrentTime = "00:00",
  onSeekAudio,
  onUploadUsbFiles,
  onConnectUsbFolder,
  onRemoveUsbTrack,
  onClearUsbVault,
  usbSavedCount = 0,
  usbFolderName = "",
}: MusicPlayerProps) {
  const [radioMode, setRadioMode] = useState(false);
  const [radioFreq, setRadioFreq] = useState(91.5);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSavingUsb, setIsSavingUsb] = useState(false);
  const [usbNotice, setUsbNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const currentTrack = playlist[currentTrackIndex] || playlist[0];

  const togglePlay = () => {
    carAudio.playButtonTap();
    onUpdateCarState({ musicPlaying: !carState.musicPlaying });
  };

  const nextTrack = () => {
    carAudio.playButtonTap();
    if (playlist.length === 0) return;
    const nextIdx = (currentTrackIndex + 1) % playlist.length;
    setCurrentTrackIndex(nextIdx);
    onUpdateCarState({ musicPlaying: true });
  };

  const prevTrack = () => {
    carAudio.playButtonTap();
    if (playlist.length === 0) return;
    const prevIdx = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    setCurrentTrackIndex(prevIdx);
    onUpdateCarState({ musicPlaying: true });
  };

  // Persist uploaded USB files / folders permanently inside IndexedDB
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsSavingUsb(true);
    try {
      if (onUploadUsbFiles) {
        await onUploadUsbFiles(files);
        setUsbNotice(
          `${files.length} فایل صوتی از فلش به‌صورت دائمی در برنامه ذخیره شد؛ از این به بعد بدون اسکن مجدد آماده پخش است.`
        );
      } else {
        const newTracks: MusicTrack[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = URL.createObjectURL(file);
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
          const cleanName = file.name.replace(/\.[^/.]+$/, "");
          newTracks.push({
            id: `flash-${Date.now()}-${i}`,
            title: cleanName,
            artist: "فلش USB خودرو",
            duration: "03:40",
            url,
            isFlash: true,
            fileSize: `${sizeMB} MB`,
            fileName: file.name,
          });
        }
        setPlaylist((prev) => [...newTracks, ...prev]);
        setCurrentTrackIndex(0);
        onUpdateCarState({ musicPlaying: true });
      }
      carAudio.playBmwGong();
    } finally {
      setIsSavingUsb(false);
      e.target.value = "";
    }
  };

  const handleFolderScanClick = async () => {
    carAudio.playButtonTap();
    if (onConnectUsbFolder) {
      setIsSavingUsb(true);
      try {
        const usedDirPicker = await onConnectUsbFolder();
        if (usedDirPicker) {
          setUsbNotice("پوشه فلش USB به برنامه متصل و تمام آهنگ‌ها به‌صورت دائمی ذخیره شدند.");
          carAudio.playBmwGong();
          return;
        }
      } finally {
        setIsSavingUsb(false);
      }
    }
    folderInputRef.current?.click();
  };

  const filteredPlaylist = playlist.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const radioStations = [
    { name: "رادیو پیام (ترافیک و خبر)", freq: 104.0 },
    { name: "رادیو آوا (موسیقی و ترانه)", freq: 93.5 },
    { name: "رادیو جوان (انرژی و جوانان)", freq: 88.0 },
    { name: "رادیو ورزش", freq: 92.0 },
  ];

  return (
    <div className="h-full flex-1 p-3 sm:p-4 flex flex-col gap-3 select-none overflow-y-auto" dir="rtl">
      {/* Hidden local files inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1">
        {/* Left/Main Column: Player Deck & Equalizer (7 Cols) */}
        <div className="lg:col-span-7 cockpit-panel rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
          {/* Header Switcher: USB / Media vs FM Radio */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.1] pb-3">
            <div className="flex items-center gap-1 instrument-well p-1 rounded-xl">
              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  setRadioMode(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  !radioMode ? "bmw-accent-btn" : "text-amber-100/70 hover:text-white"
                }`}
              >
                پخش‌کننده موزیک
              </button>

              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  setRadioMode(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  radioMode ? "bmw-accent-btn" : "text-amber-100/70 hover:text-white"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>رادیو FM</span>
              </button>
            </div>

            {/* Load from USB / Flash Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                id="usb-add-files-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSavingUsb}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hardware-key text-amber-50 text-xs hover:text-white disabled:opacity-60"
                title="افزودن آهنگ‌ها به حافظه دائمی برنامه از فلش USB"
              >
                <Usb className="w-3.5 h-3.5 bmw-accent-text" />
                <span>افزودن از فلش</span>
              </button>

              <button
                id="usb-connect-folder-btn"
                onClick={handleFolderScanClick}
                disabled={isSavingUsb}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hardware-key text-amber-50 text-xs hover:text-white disabled:opacity-60"
                title="اتصال و ذخیره خودکار پوشه فلش بدون نیاز به اسکن مجدد"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
                <span>{isSavingUsb ? "در حال ذخیره دائمی..." : "اتصال دائمی پوشه فلش"}</span>
              </button>
            </div>
          </div>

          {usbNotice && (
            <div className="mt-2.5 rounded-xl bg-emerald-950/60 border border-emerald-400/40 px-3 py-2 text-[11px] text-emerald-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDriveDownload className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>{usbNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setUsbNotice(null)}
                className="text-emerald-200 hover:text-white text-[10px] font-bold px-2 py-0.5 rounded bg-white/10"
              >
                تایید
              </button>
            </div>
          )}

          {!radioMode ? (
            /* Media Player View */
            <div className="flex flex-col items-center justify-center my-auto py-3 gap-4">
              <div className="relative">
                {/* Rotating Vinyl Disc */}
                <div
                  className={`w-28 h-28 rounded-full border-4 border-amber-200/20 bg-gradient-to-tr from-[#26170e] via-[#4a3020] to-[#26170e] flex items-center justify-center shadow-2xl ${
                    carState.musicPlaying ? "animate-spin-slow" : ""
                  }`}
                >
                  <Disc3 className="w-14 h-14 bmw-accent-text" />
                </div>
              </div>

              {/* Title & Artist */}
              <div className="text-center max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white truncate">
                    {currentTrack?.title || "آهنگ انتخاب نشده"}
                  </h3>
                  {currentTrack?.isFlash && (
                    <span className="text-[11px] bmw-accent-text font-mono font-semibold">
                      · USB Flash
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-100/75">
                  {currentTrack?.artist || "پخش صوتی خودرو"}
                </p>
              </div>

              {/* Animated Equalizer Visualizer */}
              <div className="flex items-center gap-1 h-8">
                {[30, 60, 90, 45, 80, 100, 70, 40, 85, 65, 95, 50, 75].map((val, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-200 ${
                      carState.musicPlaying ? "bmw-accent-fill" : "bg-white/15"
                    }`}
                    style={{
                      height: carState.musicPlaying
                        ? `${Math.max(15, (val * (idx % 2 === 0 ? 1 : 0.75)) % 100)}%`
                        : "15%",
                    }}
                  />
                ))}
              </div>

              {/* Interactive Seekable Progress Bar */}
              <div className="w-full max-w-md space-y-1">
                <div
                  onClick={(e) => {
                    if (!onSeekAudio) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const pct = (clickX / rect.width) * 100;
                    onSeekAudio(pct);
                  }}
                  className="w-full h-2 bg-white/15 rounded-full overflow-hidden cursor-pointer"
                  title="لمس برای جابجایی زمان آهنگ"
                >
                  <div
                    className="h-full bmw-accent-fill rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, audioProgress))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-amber-100/70 font-mono tabular-nums">
                  <span>{audioCurrentTime}</span>
                  <span>{currentTrack?.duration || "03:30"}</span>
                </div>
              </div>

              {/* Player Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={prevTrack}
                  className="p-3 rounded-full hardware-key text-amber-100 hover:text-white active:scale-95"
                  title="آهنگ قبلی"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button
                  id="music-play-btn"
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bmw-accent-btn flex items-center justify-center hover:brightness-110 transition active:scale-90 font-bold"
                  title={carState.musicPlaying ? "توقف" : "پخش"}
                >
                  {carState.musicPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5 fill-current" />
                  )}
                </button>

                <button
                  onClick={nextTrack}
                  className="p-3 rounded-full hardware-key text-amber-100 hover:text-white active:scale-95"
                  title="آهنگ بعدی"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            /* FM Radio Tuner View */
            <div className="flex flex-col items-center justify-center my-auto py-3 gap-4">
              <div className="text-center">
                <span className="text-[11px] text-amber-100/75 font-mono block">
                  فرکانس رادیویی FM خودرو
                </span>
                <div className="text-4xl font-black font-mono bmw-accent-text mt-1">
                  {radioFreq.toFixed(1)}{" "}
                  <span className="text-xs text-amber-200/60">MHz</span>
                </div>
              </div>

              {/* Radio Preset Buttons */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {radioStations.map((station, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      carAudio.playButtonTap();
                      setRadioFreq(station.freq);
                      onUpdateCarState({ musicPlaying: true });
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-right transition ${
                      Math.abs(radioFreq - station.freq) < 0.1
                        ? "bmw-accent-surface font-bold"
                        : "instrument-well text-amber-100/75 hover:text-white"
                    }`}
                  >
                    <span className="block font-bold text-white">{station.name}</span>
                    <span className="text-[10px] font-mono bmw-accent-text">
                      {station.freq} MHz
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Volume Slider */}
          <div className="flex items-center justify-between border-t border-white/[0.1] pt-2.5 px-2">
            <div className="flex items-center gap-2 text-xs text-amber-100/80">
              <Volume2 className="w-4 h-4 bmw-accent-text" />
              <span>میزان صدای خودرو:</span>
              <span className="font-mono font-bold text-white">%{carState.volume}</span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={carState.volume}
              onChange={(e) => onUpdateCarState({ volume: parseInt(e.target.value, 10) })}
              className="w-36 accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Right Column: Persistent USB Playlist & Audio Storage (5 Cols) */}
        <div className="lg:col-span-5 cockpit-panel rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.1] pb-2.5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Usb className="w-4 h-4 bmw-accent-text shrink-0" />
                <h3 className="text-xs font-bold text-white truncate">
                  آهنگ‌های فلش USB {usbFolderName ? `(${usbFolderName})` : "و حافظه دائمی"}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] bmw-accent-text font-mono font-semibold tabular-nums">
                  {playlist.length} ترانه
                </span>
                {usbSavedCount > 0 && onClearUsbVault && (
                  <button
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      void onClearUsbVault();
                    }}
                    className="p-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-300"
                    title="پاک کردن آهنگ‌های ذخیره شده از حافظه فلش"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Search */}
            <div className="mt-3 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در بین آهنگ‌های ذخیره شده..."
                className="w-full instrument-well focus:border-amber-200/30 rounded-xl px-3 py-2 text-xs text-white placeholder-amber-200/50 outline-none pr-8"
              />
              <Search className="w-3.5 h-3.5 text-amber-200/50 absolute right-2.5 top-2.5" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 my-2 max-h-[220px]">
            {filteredPlaylist.map((track, idx) => {
              const originalIdx = playlist.findIndex((t) => t.id === track.id);
              const isSelected = currentTrackIndex === originalIdx;

              return (
                <div
                  key={track.id}
                  onClick={() => {
                    carAudio.playButtonTap();
                    setCurrentTrackIndex(originalIdx >= 0 ? originalIdx : idx);
                    onUpdateCarState({ musicPlaying: true });
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition active:scale-[0.98] ${
                    isSelected
                      ? "bmw-accent-surface"
                      : "instrument-well text-amber-100/75 hover:text-white hover:border-amber-200/25"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                        isSelected ? "bmw-accent-btn" : "bg-black/30 text-amber-200/60"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="max-w-[140px] sm:max-w-[170px]">
                      <h4 className="text-xs font-semibold text-white truncate">
                        {track.title}
                      </h4>
                      <p className="text-[10px] text-amber-100/65 truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {track.isFlash && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded font-mono">
                        USB
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-amber-100/70">
                      {track.duration}
                    </span>
                    {track.id.startsWith("usb-") && onRemoveUsbTrack && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          carAudio.playButtonTap();
                          void onRemoveUsbTrack(track.id);
                        }}
                        className="p-1 rounded hover:bg-rose-500/20 text-amber-200/60 hover:text-rose-300"
                        title="حذف این آهنگ از حافظه فلش"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Persistent USB Storage Status */}
          <div className="instrument-well p-2.5 rounded-xl text-[10px] text-amber-100/80 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                {usbSavedCount > 0
                  ? `${usbSavedCount} آهنگ فلش به‌صورت دائمی ذخیره شد (بدون نیاز به اسکن مجدد)`
                  : "با یک‌بار افزودن از فلش، تمام آهنگ‌ها داخل برنامه ذخیره می‌شوند"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
