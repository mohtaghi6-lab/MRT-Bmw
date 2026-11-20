import { useState, useRef, useEffect, ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Radio,
  Music,
  FolderOpen,
  Repeat,
  Shuffle,
  Disc3,
  SlidersHorizontal,
  Headphones,
  Usb,
  Search,
  CheckCircle2,
  Sparkles,
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
}

export default function MusicPlayerModule({
  carState,
  onUpdateCarState,
  playlist,
  setPlaylist,
  currentTrackIndex,
  setCurrentTrackIndex,
}: MusicPlayerProps) {
  const [progress, setProgress] = useState(35);
  const [radioMode, setRadioMode] = useState(false);
  const [radioFreq, setRadioFreq] = useState(91.5);
  const [searchQuery, setSearchQuery] = useState("");
  const [flashConnected, setFlashConnected] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const currentTrack = playlist[currentTrackIndex] || playlist[0];

  // Sync real HTML5 audio playback
  useEffect(() => {
    if (!audioRef.current) return;

    if (currentTrack?.url) {
      if (audioRef.current.src !== currentTrack.url) {
        audioRef.current.src = currentTrack.url;
      }
      if (carState.musicPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    } else {
      // If no custom URL, simulate track
      if (!carState.musicPlaying && audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [currentTrack, carState.musicPlaying]);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, carState.volume / 100));
    }
  }, [carState.volume]);

  // Play / Pause toggle
  const togglePlay = () => {
    carAudio.playButtonTap();
    const nextPlaying = !carState.musicPlaying;
    onUpdateCarState({ musicPlaying: nextPlaying });
  };

  const nextTrack = () => {
    carAudio.playButtonTap();
    const nextIdx = (currentTrackIndex + 1) % playlist.length;
    setCurrentTrackIndex(nextIdx);
    onUpdateCarState({ musicPlaying: true });
    setProgress(0);
  };

  const prevTrack = () => {
    carAudio.playButtonTap();
    const prevIdx = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    setCurrentTrackIndex(prevIdx);
    onUpdateCarState({ musicPlaying: true });
    setProgress(0);
  };

  // Progress ticker for synthetic or real tracks
  useEffect(() => {
    let interval: any;
    if (carState.musicPlaying) {
      interval = setInterval(() => {
        if (audioRef.current && audioRef.current.duration) {
          const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setProgress(percent);
        } else {
          setProgress((prev) => (prev >= 100 ? 0 : prev + 0.6));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [carState.musicPlaying]);

  // Handle local multi-file upload from car flash / USB
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: MusicTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const cleanName = file.name.replace(/\.[^/.]+$/, "");

      newTracks.push({
        id: `flash-${Date.now()}-${i}`,
        title: cleanName,
        artist: "خواننده / فلش USB",
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
    setProgress(0);
    setFlashConnected(true);
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
      {/* Hidden audio element for genuine in-car MP3 playback */}
      <audio
        ref={audioRef}
        onEnded={nextTrack}
        className="hidden"
      />

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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-1 instrument-well p-1 rounded-xl">
              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  setRadioMode(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  !radioMode
                    ? "bmw-accent-btn"
                    : "text-slate-400 hover:text-slate-100"
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
                  radioMode
                    ? "bmw-accent-btn"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>رادیو FM</span>
              </button>
            </div>

            {/* Load from USB / Flash Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hardware-key text-slate-200 text-xs hover:text-white"
                title="انتخاب آهنگ از فلش USB مانیتور"
              >
                <Usb className="w-3.5 h-3.5 bmw-accent-text" />
                <span>افزودن از فلش</span>
              </button>

              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hardware-key text-slate-200 text-xs hover:text-white"
                title="اسکن کل پوشه آهنگ‌های فلش مموری"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>اسکن پوشه فلش</span>
              </button>
            </div>
          </div>

          {!radioMode ? (
            /* Media Player View */
            <div className="flex flex-col items-center justify-center my-auto py-3 gap-4">
              <div className="relative">
                {/* Rotating Vinyl Disc */}
                <div
                  className={`w-28 h-28 rounded-full border-4 border-white/10 bg-gradient-to-tr from-[#05070b] via-[#131926] to-[#05070b] flex items-center justify-center shadow-2xl ${
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
                <p className="text-xs text-slate-400">
                  {currentTrack?.artist || "پخش صوتی خودرو"}
                </p>
              </div>

              {/* Animated Equalizer Visualizer */}
              <div className="flex items-center gap-1 h-8">
                {[30, 60, 90, 45, 80, 100, 70, 40, 85, 65, 95, 50, 75].map((val, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-200 ${
                      carState.musicPlaying
                        ? "bmw-accent-fill"
                        : "bg-white/10"
                    }`}
                    style={{
                      height: carState.musicPlaying
                        ? `${Math.max(15, (val * (idx % 2 === 0 ? 1 : 0.75)) % 100)}%`
                        : "15%",
                    }}
                  />
                ))}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-1">
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bmw-accent-fill rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                  <span>01:24</span>
                  <span>{currentTrack?.duration || "03:30"}</span>
                </div>
              </div>

              {/* Player Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={prevTrack}
                  className="p-3 rounded-full hardware-key text-slate-300 hover:text-white active:scale-95"
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
                  className="p-3 rounded-full hardware-key text-slate-300 hover:text-white active:scale-95"
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
                <span className="text-[11px] text-slate-400 font-mono block">
                  فرکانس رادیویی FM خودرو
                </span>
                <div className="text-4xl font-black font-mono text-cyan-400 mt-1">
                  {radioFreq.toFixed(1)}{" "}
                  <span className="text-xs text-slate-500">MHz</span>
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
                        ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="block font-bold text-slate-100">
                      {station.name}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      {station.freq} MHz
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Volume Slider */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-2.5 px-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>میزان صدای خودرو:</span>
              <span className="font-mono font-bold text-slate-200">
                %{carState.volume}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={carState.volume}
              onChange={(e) =>
                onUpdateCarState({ volume: parseInt(e.target.value, 10) })
              }
              className="w-36 accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Right Column: Playlist & Audio Storage (5 Cols) */}
        <div className="lg:col-span-5 cockpit-panel rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-2">
                <Usb className="w-4 h-4 bmw-accent-text" />
                <h3 className="text-xs font-bold text-white">
                  آهنگ‌های فلش USB و حافظه خودرو
                </h3>
              </div>
              <span className="text-[11px] bmw-accent-text font-mono font-semibold tabular-nums">
                {playlist.length} ترانه
              </span>
            </div>

            {/* Quick Search */}
            <div className="mt-3 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در بین آهنگ‌های فلش..."
                className="w-full instrument-well focus:border-white/25 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none pr-8"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 my-2 max-h-[200px]">
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
                      ? "bg-cyan-950/70 border-cyan-500/50 text-cyan-300"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                        isSelected
                          ? "bg-cyan-500 text-slate-950"
                          : "bg-slate-900 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="max-w-[140px] sm:max-w-[180px]">
                      <h4 className="text-xs font-semibold text-slate-200 truncate">
                        {track.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {track.isFlash && (
                      <span className="text-[9px] bg-cyan-900/60 text-cyan-300 px-1 py-0.5 rounded font-mono">
                        USB
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500">
                      {track.duration}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Audio Storage & Voice Instruction Notice */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-400 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                فلش USB متصل و آماده
              </span>
              <span className="text-cyan-400 font-mono">فرمان صوتی: «MRT آهنگ فلش»</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
