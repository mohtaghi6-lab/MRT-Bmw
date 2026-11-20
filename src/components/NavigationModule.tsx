import { useState, useEffect, useRef } from "react";
import {
  Compass,
  Navigation,
  Fuel,
  Flame,
  Hospital,
  Wrench,
  SquareParking,
  UtensilsCrossed,
  Search,
  Crosshair,
  Volume2,
  VolumeX,
  Gauge,
  MapPin,
  Clock,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { CarState, POI, NavigationRoute } from "../types";
import { carAudio } from "../utils/carSpeech";

interface NavigationModuleProps {
  carState: CarState;
  onUpdateCarState: (partial: Partial<CarState>) => void;
  externalSearchQuery?: string;
  externalRoute?: NavigationRoute | null;
}

export default function NavigationModule({
  carState,
  onUpdateCarState,
  externalSearchQuery,
  externalRoute,
}: NavigationModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [pois, setPois] = useState<POI[]>([]);
  const [activeRoute, setActiveRoute] = useState<NavigationRoute | null>({
    origin: "شیراز",
    destination: "اصفهان",
    distance: "۴۸۵ کیلومتر",
    duration: "۵ ساعت و ۲۰ دقیقه",
    nextTurn: "در بزرگراه خلیج فارس به سمت آباده و اصفهان ادامه دهید.",
    turnDistance: "۳۰۰ متر",
    speedLimit: 110,
    eta: "۱۷:۳۰",
  });
  const [gpsSimActive, setGpsSimActive] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Speed simulation / live GPS
  useEffect(() => {
    let interval: any;
    if (gpsSimActive) {
      interval = setInterval(() => {
        // Vary speed smoothly around 55 - 75 km/h
        const delta = (Math.random() - 0.48) * 3;
        onUpdateCarState({
          speed: Math.max(0, Math.min(130, Math.round((carState.speed || 60) + delta))),
          rpm: Math.round(1800 + ((carState.speed || 60) * 18)),
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gpsSimActive, carState.speed]);

  // Update active route if requested by AI voice assistant
  useEffect(() => {
    if (externalRoute) {
      setActiveRoute(externalRoute);
    }
  }, [externalRoute]);

  // Handle external search query from AI Assistant
  useEffect(() => {
    if (externalSearchQuery) {
      setSearchQuery(externalSearchQuery);
      fetchPlaces(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Initial POI fetch
  useEffect(() => {
    fetchPlaces("");
  }, []);

  const OFFLINE_POIS: POI[] = [
    { id: "1", name: "پمپ بنزین سوپر آزادی", type: "fuel", distance: "۸۵۰ متر", address: "بزرگراه شهید لشکری - بنزین سوپر یورو ۵", lat: 35.6997, lng: 51.3380 },
    { id: "2", name: "جایگاه بنزین سوپر یادگار امام", type: "fuel", distance: "۱.۴ کیلومتر", address: "بزرگراه یادگار امام شمال", lat: 35.7042, lng: 51.3491 },
    { id: "3", name: "بیمارستان امام خمینی", type: "hospital", distance: "۳.۲ کیلومتر", address: "خیابان قریب", lat: 35.7056, lng: 51.3789 },
    { id: "4", name: "مرکز تخصصی و خدمات پس از فروش BMW (پرشیا خودرو)", type: "mechanic", distance: "۲.۱ کیلومتر", address: "کیلومتر ۶ جاده مخصوص کرج - نمایندگی مرکزی ب‌ام‌و", lat: 35.6980, lng: 51.3200 },
    { id: "5", name: "پارکینگ طبقاتی کاج", type: "parking", distance: "۱.۱ کیلومتر", address: "میدان کاج، سعادت آباد", lat: 35.7820, lng: 51.3740 },
    { id: "6", name: "مجتمع رفاهی و رستوران بین‌راهی", type: "restaurant", distance: "۴.۵ کیلومتر", address: "کیلومتر ۱۴ جاده مخصوص", lat: 35.7100, lng: 51.2500 },
  ];

  const fetchPlaces = async (query: string) => {
    const filterOffline = (q: string) => {
      const clean = q.trim().toLowerCase();
      if (!clean) return OFFLINE_POIS;
      const matches = OFFLINE_POIS.filter(
        (p) => p.name.toLowerCase().includes(clean) || p.address.toLowerCase().includes(clean)
      );
      return matches.length > 0 ? matches : OFFLINE_POIS;
    };

    if (!carState.isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setPois(filterOffline(query));
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("offline");
      const data = await res.json();
      setPois(Array.isArray(data) && data.length > 0 ? data : filterOffline(query));
    } catch {
      setPois(filterOffline(query));
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const handleSelectPoi = (poi: POI) => {
    carAudio.playButtonTap();
    setActiveRoute({
      destination: poi.name,
      distance: poi.distance,
      duration: "۶ دقیقه",
      nextTurn: `مسیریابی به سمت ${poi.name} آغاز شد. ۳۰۰ متر جلوتر به راست بپیچید.`,
      turnDistance: "۳۰۰ متر",
      speedLimit: 80,
      eta: "۱۲:۳۰",
    });
  };

  const poiCategories = [
    { id: "all", label: "همه نقاط", icon: MapPin },
    { id: "fuel", label: "پمپ بنزین", icon: Fuel, color: "text-amber-400" },
    { id: "cng", label: "جایگاه گاز CNG", icon: Flame, color: "text-blue-400" },
    { id: "hospital", label: "بیمارستان و درمانگاه", icon: Hospital, color: "text-rose-400" },
    { id: "mechanic", label: "تعمیرگاه و امداد", icon: Wrench, color: "text-yellow-400" },
    { id: "parking", label: "پارکینگ", icon: SquareParking, color: "text-cyan-400" },
    { id: "restaurant", label: "رستوران", icon: UtensilsCrossed, color: "text-emerald-400" },
  ];

  const filteredPois =
    selectedCategory === "all"
      ? pois
      : pois.filter((p) => p.type === selectedCategory);

  return (
    <div className="h-full flex-1 p-3 sm:p-4 flex flex-col gap-3 select-none overflow-hidden" dir="rtl">
      {/* Top Banner: Turn-by-Turn Guidance HUD */}
      {activeRoute && (
        <div className="cockpit-panel rounded-3xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bmw-accent-btn flex items-center justify-center font-black shrink-0">
              <ArrowUpRight className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-400">
                  {activeRoute.turnDistance}
                </span>
                <span className="text-sm font-semibold text-slate-100">
                  {activeRoute.nextTurn}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                {activeRoute.origin && (
                  <>
                    <span>مبدا: <strong className="text-cyan-300">{activeRoute.origin}</strong></span>
                    <span className="text-slate-600">➔</span>
                  </>
                )}
                <span>مقصد: <strong className="text-emerald-300">{activeRoute.destination}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>زمان باقی‌مانده: {activeRoute.duration}</span>
              </div>
              <div className="text-xs font-mono text-emerald-400">
                فاصله: {activeRoute.distance} | ورود: {activeRoute.eta}
              </div>
            </div>

            {/* Mute Voice Navigation Toggle */}
            <button
              onClick={() => {
                carAudio.playButtonTap();
                setIsMuted(!isMuted);
              }}
              className={`p-2 rounded-lg border transition ${
                isMuted
                  ? "bg-slate-800 border-slate-700 text-slate-500"
                  : "bg-cyan-950/60 border-cyan-500/40 text-cyan-400"
              }`}
              title={isMuted ? "راهنمای صوتی مسیر قطع است" : "راهنمای صوتی فعال است"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Map & Speedometer (Left) + POI Search & List (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[360px]">
        {/* Left Column: Interactive Visual GPS Map & Speedometer HUD */}
        <div className="lg:col-span-8 cockpit-panel rounded-3xl overflow-hidden flex flex-col relative">
          {/* Simulated In-Car GPS Map Canvas */}
          <div className="flex-1 relative bg-[#04070d] flex items-center justify-center overflow-hidden min-h-[340px]">
            {/* Map Grid Pattern / Street Graphic */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(#06b6d4 1.2px, transparent 1.2px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />

            {/* Geographical terrain contours / highway simulation */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background secondary roads */}
              <path
                d="M 20 400 Q 150 320 300 360 T 550 420"
                fill="none"
                stroke="#1e293b"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 100 80 Q 280 180 400 120 T 750 200"
                fill="none"
                stroke="#1e293b"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Main Highway Road Base */}
              <path
                d="M 60 380 Q 180 260 360 220 T 680 70"
                fill="none"
                stroke="#0f172a"
                strokeWidth="32"
                strokeLinecap="round"
              />
              <path
                d="M 60 380 Q 180 260 360 220 T 680 70"
                fill="none"
                stroke="#1e293b"
                strokeWidth="20"
                strokeLinecap="round"
              />

              {/* Active Route Glow & Animated Line */}
              <path
                d="M 60 380 Q 180 260 360 220 T 680 70"
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="14 8"
                className="animate-pulse"
                filter="url(#glow)"
              />
            </svg>

            {/* Waypoint 1: Origin (e.g., شیراز) */}
            <div className="absolute bottom-[18%] left-[8%] flex flex-col items-center z-10">
              <div className="w-8 h-8 rounded-full bg-cyan-500 border-2 border-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/50 text-slate-950 font-black text-xs">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="mt-1 text-[10px] font-bold bg-slate-950/90 text-cyan-300 px-2 py-0.5 rounded border border-cyan-700 shadow-md">
                مبدا: {activeRoute?.origin || "شیراز"}
              </span>
            </div>

            {/* Waypoint 2: Intermediate city (مرودشت / آباده) */}
            <div className="absolute top-[52%] left-[36%] flex flex-col items-center z-10 pointer-events-none opacity-85">
              <div className="w-3.5 h-3.5 rounded-full bg-slate-600 border border-slate-900 flex items-center justify-center" />
              <span className="mt-0.5 text-[9px] font-medium bg-slate-900/80 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                آباده
              </span>
            </div>

            {/* Waypoint 3: Intermediate city (شهرضا) */}
            <div className="absolute top-[35%] left-[58%] flex flex-col items-center z-10 pointer-events-none opacity-85">
              <div className="w-3.5 h-3.5 rounded-full bg-slate-600 border border-slate-900 flex items-center justify-center" />
              <span className="mt-0.5 text-[9px] font-medium bg-slate-900/80 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                شهرضا
              </span>
            </div>

            {/* Speed Camera Alert Marker along Highway */}
            <div className="absolute top-[42%] left-[48%] flex items-center gap-1 bg-amber-950/90 border border-amber-500/60 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg animate-bounce z-10">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>دوربین کنترل سرعت ۱۱۰</span>
            </div>

            {/* Live Moving In-Car GPS Vehicle Marker */}
            <div className="absolute top-[48%] left-[42%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center animate-ping absolute" />
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 to-cyan-400 border-2 border-slate-950 flex items-center justify-center shadow-xl shadow-cyan-500/80 relative z-10">
                <Navigation className="w-5 h-5 text-slate-950 rotate-45" />
              </div>
              <div className="mt-1 flex items-center gap-1 bg-slate-950/95 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-cyan-600 shadow-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>موقعیت خودرو</span>
              </div>
            </div>

            {/* Destination Pin (e.g., اصفهان) */}
            <div className="absolute top-[12%] right-[15%] flex flex-col items-center z-10">
              <div className="w-9 h-9 rounded-full bg-rose-500 border-2 border-slate-950 flex items-center justify-center shadow-xl shadow-rose-500/60 text-white font-black">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="mt-1 text-[11px] font-bold bg-slate-950/90 text-rose-300 px-2.5 py-0.5 rounded border border-rose-600 shadow-lg">
                مقصد: {activeRoute?.destination || "اصفهان"}
              </span>
            </div>

            {/* Overlaid Speedometer HUD */}
            <div className="absolute bottom-3 left-3 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-xl p-3 flex items-center gap-3 shadow-2xl z-20">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block font-mono">سرعت GPS</span>
                <span className="text-2xl font-black font-mono text-cyan-400 tracking-tight">
                  {carState.speed}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">km/h</span>
              </div>

              <div className="w-px h-10 bg-slate-800" />

              {/* Speed Limit Sign */}
              <div className="w-9 h-9 rounded-full border-2 border-red-500 bg-white text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
                {activeRoute?.speedLimit || 110}
              </div>

              {/* Compass Heading */}
              <div className="flex flex-col items-center text-[10px] text-slate-400">
                <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
                <span className="font-mono mt-0.5">شمال غربی</span>
              </div>
            </div>

            {/* Map Simulation Controls */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
              <button
                onClick={() => {
                  carAudio.playButtonTap();
                  setGpsSimActive(!gpsSimActive);
                }}
                className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 font-mono transition shadow-lg ${
                  gpsSimActive
                    ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-300"
                    : "bg-slate-900 border-slate-700 text-slate-400"
                }`}
                title="تغییر شبیه‌ساز حرکت خودرو"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span className="text-[10px] font-sans">{gpsSimActive ? "شبیه‌ساز GPS فعال" : "توقف"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: POI Quick Search & Destination Finder */}
        <div className="lg:col-span-4 cockpit-panel rounded-3xl p-4 flex flex-col gap-3">
          {/* Search Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchPlaces(searchQuery);
            }}
            className="flex items-center gap-1.5 instrument-well rounded-xl px-3 py-2"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی پمپ بنزین، آدرس، خدمات..."
              className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bmw-accent-btn font-bold text-[11px]"
            >
              بیاب
            </button>
          </form>

          {/* POI Category Filter Controls */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {poiCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    carAudio.playButtonTap();
                    setSelectedCategory(cat.id);
                  }}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                    selectedCategory === cat.id
                      ? "bmw-accent-btn font-bold"
                      : "hardware-key text-slate-300 hover:text-white"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* List of Nearby POIs */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[250px]">
            {filteredPois.map((poi) => (
              <div
                key={poi.id}
                onClick={() => handleSelectPoi(poi)}
                className="bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition active:scale-[0.98]"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400 mt-0.5">
                    {poi.type === "fuel" ? (
                      <Fuel className="w-3.5 h-3.5 text-amber-400" />
                    ) : poi.type === "cng" ? (
                      <Flame className="w-3.5 h-3.5 text-blue-400" />
                    ) : poi.type === "hospital" ? (
                      <Hospital className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{poi.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{poi.address}</p>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-[11px] font-mono font-semibold text-emerald-400 block">
                    {poi.distance}
                  </span>
                  <span className="text-[9px] text-cyan-400 hover:underline">مسیریابی</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
