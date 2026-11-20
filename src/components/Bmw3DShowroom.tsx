import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Gauge,
  Layers,
  Lightbulb,
  Lock,
  RotateCw,
  Sun,
  TriangleAlert,
  Unlock,
  X,
  Zap,
} from "lucide-react";
import { CarState } from "../types";
import { carAudio } from "../utils/carSpeech";
import { getAmbientTheme } from "../utils/ambientThemes";
import { createProceduralTextureBundle } from "../three/proceduralTextures";
import { BMW_PAINT_OPTIONS, BmwPaintId, createBmwMaterials } from "../three/bmwMaterials";
import { buildBmwModel, InteractiveCarPart } from "../three/buildBmwModel";
import { buildShowroomEnvironment, ShowroomEnvMode } from "../three/buildShowroomEnv";

interface Bmw3DShowroomProps {
  carState: CarState;
  onUpdateCarState: (update: Partial<CarState>) => void;
  onClose: () => void;
}

type CameraPresetId = "hero" | "front" | "side" | "top";

interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: CameraPreset[] = [
  { id: "hero", label: "۳/۴ استودیو", position: [4.45, 1.82, 5.05], target: [0, 0.66, 0.08] },
  { id: "front", label: "نمای جلو", position: [0.0, 1.12, 5.25], target: [0, 0.64, 0.35] },
  { id: "side", label: "نمای جانبی", position: [5.65, 1.28, 0.0], target: [0, 0.64, 0.0] },
  { id: "top", label: "نمای بالا", position: [2.25, 3.85, 2.15], target: [0, 0.55, 0.0] },
];

// Pre-allocated scratch math objects (zero allocations in frame loop)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

function detectSoftwareWebGL(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(raw);
  } catch {
    return false;
  }
}

export default function Bmw3DShowroom({
  carState,
  onUpdateCarState,
  onClose,
}: Bmw3DShowroomProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [paintId, setPaintId] = useState<BmwPaintId>("sapphire-black");
  const [envMode, setEnvMode] = useState<ShowroomEnvMode>("showroom");
  const [activePreset, setActivePreset] = useState<CameraPresetId>("hero");
  const [explodedAmount, setExplodedAmount] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [partToast, setPartToast] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setPartToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setPartToast(null), 2400);
  };

  // Keep live state in a ref so React updates never tear down or reset WebGL
  const liveRef = useRef({
    carState,
    paintId,
    envMode,
    explodedAmount,
    autoRotate,
    onUpdateCarState,
  });
  liveRef.current = {
    carState,
    paintId,
    envMode,
    explodedAmount,
    autoRotate,
    onUpdateCarState,
  };

  // Imperative camera tween trigger shared between UI buttons and Three.js loop
  const cameraTweenRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESETS[0].position),
    target: new THREE.Vector3(...CAMERA_PRESETS[0].target),
  });

  const handleSelectPreset = (presetId: CameraPresetId) => {
    const preset = CAMERA_PRESETS.find((p) => p.id === presetId) ?? CAMERA_PRESETS[0];
    carAudio.playButtonTap();
    setActivePreset(preset.id);
    cameraTweenRef.current.pos.set(...preset.position);
    cameraTweenRef.current.target.set(...preset.target);
    cameraTweenRef.current.active = true;
  };

  // Keyboard shortcuts: Esc exits 3D viewport, H toggles dock visibility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "h" || e.key === "H") {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      // Probe software renderer quickly before final renderer setup if needed
      const probeCanvas = document.createElement("canvas");
      const probeGl = probeCanvas.getContext("webgl2") || probeCanvas.getContext("webgl");
      if (!probeGl) {
        setWebglError("مرورگر یا سیستم فعلی از WebGL پشتیبانی نمی‌کند.");
        return;
      }
      const ext = probeGl.getExtension("WEBGL_debug_renderer_info");
      const gpuName = ext ? String(probeGl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
      const isProbeSoft = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);

      renderer = new THREE.WebGLRenderer({
        antialias: !isProbeSoft,
        powerPreference: "high-performance",
        alpha: false,
      });
    } catch {
      setWebglError("راه‌اندازی موتور گرافیکی سه‌بعدی با خطا مواجه شد.");
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL(renderer);
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    // Scene & Fog
    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(0x070a10);
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2(0x070a10, 0.022);

    // Environment reflections via PMREM + RoomEnvironment (no external HDR)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    // Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(...CAMERA_PRESETS[0].position);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(...CAMERA_PRESETS[0].target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 11.5;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.autoRotateSpeed = 0.65;
    controls.update();

    const onControlStart = () => {
      cameraTweenRef.current.active = false;
    };
    controls.addEventListener("start", onControlStart);

    // Lighting Rig: Warm Key + Cool Hemisphere Fill + Rim + Studio Softboxes
    const keyLight = new THREE.DirectionalLight(0xfff4e2, 2.25);
    keyLight.position.set(5.5, 7.2, 4.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -4.2;
    keyLight.shadow.camera.right = 4.2;
    keyLight.shadow.camera.top = 4.2;
    keyLight.shadow.camera.bottom = -4.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x8fb7e8, 0x151922, 0.72);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.05);
    rimLight.position.set(-5.2, 3.4, -5.6);
    scene.add(rimLight);

    let overheadSoftbox: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      overheadSoftbox = new THREE.RectAreaLight(0xf1f5f9, 2.4, 5.2, 2.4);
      overheadSoftbox.position.set(0, 4.2, 0.2);
      overheadSoftbox.lookAt(0, 0.5, 0.2);
      scene.add(overheadSoftbox);
    }

    // Procedural Textures, Materials, BMW Model & Showroom Env
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextureBundle(maxAnisotropy);
    const materials = createBmwMaterials(textures, isSoftwareGl);
    const bmwModel = buildBmwModel(materials);
    scene.add(bmwModel.root);

    const showroomEnv = buildShowroomEnvironment(textures);
    scene.add(showroomEnv.group);

    // Raycaster for direct clicks on Headlights, Sunroof, Doors, Wheels, Hood
    const raycaster = new THREE.Raycaster();
    let pointerDownX = 0;
    let pointerDownY = 0;

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerDownX;
      const dy = ev.clientY - pointerDownY;
      if (dx * dx + dy * dy > 36) return; // Ignore orbit drags

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      _pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(bmwModel.interactables, true);
      if (!hits.length) return;

      const part = hits[0].object.userData.interactPart as InteractiveCarPart | undefined;
      if (!part) return;

      const cur = liveRef.current;
      if (part === "headlights") {
        const next = !cur.carState.headlightsActive;
        carAudio.playButtonTap();
        cur.onUpdateCarState({
          headlightsActive: next,
          highBeamActive: next ? cur.carState.highBeamActive : false,
        });
        showToast(next ? "چراغ‌های Angel Eyes روشن شد" : "چراغ‌های جلو خاموش شد");
      } else if (part === "sunroof") {
        const next = !cur.carState.sunroofOpen;
        carAudio.playButtonTap();
        cur.onUpdateCarState({ sunroofOpen: next });
        showToast(next ? "سانروف برقی باز شد" : "سانروف بسته شد");
      } else if (part === "doors") {
        const next = !cur.carState.doorsLocked;
        carAudio.playLockBeep(next);
        cur.onUpdateCarState({ doorsLocked: next });
        showToast(next ? "قفل مرکزی درها فعال شد" : "قفل درها باز شد");
      } else if (part === "wheels") {
        carAudio.playButtonTap();
        const nextSpeed = cur.carState.speed === 0 ? 60 : cur.carState.speed < 100 ? 120 : 0;
        const nextRpm = nextSpeed === 0 ? 780 : nextSpeed === 60 ? 2150 : 3450;
        cur.onUpdateCarState({ speed: nextSpeed, rpm: nextRpm });
        showToast(nextSpeed === 0 ? "خودرو متوقف شد" : `سرعت شبیه‌سازی روی ${nextSpeed} km/h`);
      } else if (part === "hood") {
        carAudio.playButtonTap();
        setExplodedAmount((prev) => {
          const next = prev > 0.2 ? 0 : 0.85;
          showToast(next > 0 ? "نمای انفجاری اجزا و موتور M52TU" : "بستن نمای انفجاری");
          return next;
        });
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    // WebGL Context Loss & Restore Handlers
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    // ResizeObserver for crisp viewport sizing
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, Math.floor(entry.contentRect.width));
      const h = Math.max(1, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Software WebGL GPU-fence pacing helper
    const glCtx = renderer.getContext() as WebGL2RenderingContext;
    let rafId = 0;
    let disposed = false;

    const afterDraw = (next: () => void) => {
      if (isSoftwareGl && typeof glCtx.fenceSync === "function") {
        const sync = glCtx.fenceSync(glCtx.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          glCtx.flush();
          const poll = () => {
            if (disposed) {
              glCtx.deleteSync(sync);
              return;
            }
            const status = glCtx.clientWaitSync(sync, 0, 0);
            if (status === glCtx.TIMEOUT_EXPIRED) {
              rafId = requestAnimationFrame(poll);
            } else {
              glCtx.deleteSync(sync);
              rafId = requestAnimationFrame(next);
            }
          };
          rafId = requestAnimationFrame(poll);
          return;
        }
      }
      rafId = requestAnimationFrame(next);
    };

    let lastTime = performance.now();
    let elapsed = 0;
    let lastAppliedPaint: BmwPaintId | null = null;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      const cur = liveRef.current;

      if (cur.paintId !== lastAppliedPaint) {
        lastAppliedPaint = cur.paintId;
        materials.setPaintColor(cur.paintId);
      }

      const ambientTheme = getAmbientTheme(cur.carState.ambientLightingColor);
      const ambientBrightness = cur.carState.ambientLightingBrightness ?? 85;

      // Update BMW composite 3D parts
      bmwModel.update(dt, elapsed, {
        speed: cur.carState.speed,
        headlightsActive: cur.carState.headlightsActive,
        highBeamActive: cur.carState.highBeamActive,
        fogLightsActive: cur.carState.fogLightsActive,
        hazardActive: cur.carState.hazardActive,
        leftSignal: cur.carState.leftSignal,
        rightSignal: cur.carState.rightSignal,
        sunroofOpen: cur.carState.sunroofOpen,
        doorsLocked: cur.carState.doorsLocked,
        ambientHex: ambientTheme.primaryHex,
        ambientBrightness,
        explodedAmount: cur.explodedAmount,
      });

      // Update Showroom / Night Highway Environment
      showroomEnv.update(
        dt,
        cur.envMode,
        cur.carState.speed,
        ambientTheme.primaryHex,
        ambientBrightness
      );

      // Smooth damped camera preset transitions
      if (cameraTweenRef.current.active) {
        _camGoalPos.copy(cameraTweenRef.current.pos);
        _camGoalTarget.copy(cameraTweenRef.current.target);
        const factor = 1 - Math.exp(-6.5 * dt);
        camera.position.lerp(_camGoalPos, factor);
        controls.target.lerp(_camGoalTarget, factor);
        if (
          camera.position.distanceToSquared(_camGoalPos) < 0.0008 &&
          controls.target.distanceToSquared(_camGoalTarget) < 0.0008
        ) {
          camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          cameraTweenRef.current.active = false;
        }
      }

      controls.autoRotate =
        cur.autoRotate && !cameraTweenRef.current.active && cur.envMode === "showroom";
      controls.update();

      renderer.render(scene, camera);
      afterDraw(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      resizeObserver.disconnect();
      controls.removeEventListener("start", onControlStart);
      controls.dispose();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);

      bmwModel.dispose();
      showroomEnv.dispose();
      materials.dispose();
      textures.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  const ambientTheme = getAmbientTheme(carState.ambientLightingColor);

  return (
    <div
      id="bmw-3d-showroom-viewport"
      className="fixed inset-0 z-50 w-screen h-screen bg-[#070a10] text-slate-100 overflow-hidden select-none"
      dir="rtl"
    >
      {/* Dedicated Empty Mount Point for WebGL Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="نمای تعاملی سه‌بعدی BMW 728Li"
      />

      {/* Minimal Top Bar Overlay (solid/rgba surface, zero backdrop-blur) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
        <div
          className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/10"
          style={{ backgroundColor: "rgba(10, 13, 20, 0.88)" }}
        >
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white font-mono tracking-wide">
              BMW 728Li · E38 3D Studio
            </h2>
            <p className="text-[11px] text-slate-300 mt-0.5">
              چرخش با درگ · زوم با اسکرول · کلیک روی چراغ، سانروف، درها یا چرخ‌ها
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              setDockCollapsed((prev) => !prev);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-xs font-medium text-slate-200 hover:text-white transition"
            style={{ backgroundColor: "rgba(10, 13, 20, 0.88)" }}
            title="حالت سینمایی / پنهان کردن پنل (کلید H)"
          >
            <EyeOff className="w-4 h-4" />
            <span className="hidden sm:inline">{dockCollapsed ? "نمایش کنترل‌ها" : "نمای آزاد"}</span>
          </button>

          <button
            id="close-3d-showroom-btn"
            type="button"
            onClick={() => {
              carAudio.playButtonTap();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 text-xs font-bold text-white hover:border-white/30 transition"
            style={{ backgroundColor: "rgba(18, 22, 32, 0.92)" }}
          >
            <X className="w-4 h-4" />
            <span>بازگشت به کاکپیت</span>
          </button>
        </div>
      </div>

      {/* Direct Part Click Feedback Toast */}
      {partToast && (
        <div
          className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl border text-xs font-semibold text-white"
          style={{
            backgroundColor: "rgba(10, 13, 20, 0.92)",
            borderColor: ambientTheme.primaryHex,
          }}
        >
          {partToast}
        </div>
      )}

      {/* WebGL Error or Context Lost Fallback */}
      {(webglError || contextLost) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
          style={{ backgroundColor: "rgba(7, 10, 16, 0.96)" }}
        >
          <TriangleAlert className="w-12 h-12 text-amber-400" />
          <p className="text-sm sm:text-base font-bold text-white">
            {webglError || "اتصال موتور گرافیکی WebGL موقتاً قطع شد."}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white border border-white/20"
            style={{ backgroundColor: ambientTheme.primaryHex }}
          >
            بازگشت به داشبورد
          </button>
        </div>
      )}

      {/* Single Collapsible Bottom Control Dock (no backdrop-filter, <= 15% height) */}
      {!webglError && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-col items-center">
          <div
            className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-white/12 px-3.5 py-2.5 flex flex-col gap-2"
            style={{ backgroundColor: "rgba(10, 13, 20, 0.90)" }}
          >
            {/* Compact Header Row inside Dock */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Camera Presets */}
              <div className="flex items-center gap-1 flex-wrap">
                <Camera className="w-3.5 h-3.5 text-slate-400 ml-1" />
                {CAMERA_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      activePreset === preset.id
                        ? "text-white"
                        : "text-slate-300 hover:text-white bg-white/5"
                    }`}
                    style={
                      activePreset === preset.id
                        ? { backgroundColor: ambientTheme.primaryHex }
                        : undefined
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Environment + AutoRotate + Collapse Toggle */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    setEnvMode((m) => (m === "showroom" ? "highway" : "showroom"));
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 text-slate-200 hover:text-white bg-white/5"
                >
                  محیط: {envMode === "showroom" ? "استودیو نمایشگاه" : "بزرگراه شب"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    carAudio.playButtonTap();
                    setAutoRotate((r) => !r);
                  }}
                  className={`p-1.5 rounded-lg border text-xs transition ${
                    autoRotate
                      ? "border-white/30 text-white bg-white/15"
                      : "border-white/10 text-slate-400 bg-white/5"
                  }`}
                  title="چرخش خودکار استودیو"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setDockCollapsed((c) => !c)}
                  className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white bg-white/5"
                  title={dockCollapsed ? "باز کردن پنل کنترل" : "جمع کردن پنل"}
                >
                  {dockCollapsed ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Expandable Second Row: Paint Swatches, Explode Slider & Car Live Toggles */}
            {!dockCollapsed && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10">
                {/* Metallic Paint Swatches */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 ml-1">رنگ بدنه:</span>
                  {BMW_PAINT_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        carAudio.playButtonTap();
                        setPaintId(p.id);
                      }}
                      title={p.label}
                      aria-label={p.label}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${
                        paintId === p.id ? "scale-125 border-white" : "border-white/25 hover:scale-110"
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </div>

                {/* Exploded View Slider */}
                <div className="flex items-center gap-2 min-w-[155px]">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-300 whitespace-nowrap">انفجاری:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={explodedAmount}
                    onChange={(e) => setExplodedAmount(Number(e.target.value))}
                    style={{ accentColor: ambientTheme.primaryHex }}
                    className="w-24 cursor-pointer"
                    aria-label="نمای انفجاری اجزای BMW"
                  />
                </div>

                {/* Live Vehicle Systems Synced to carState */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      onUpdateCarState({ headlightsActive: !carState.headlightsActive });
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                      carState.headlightsActive
                        ? "border-amber-400/70 text-amber-200 bg-amber-500/20"
                        : "border-white/10 text-slate-300 bg-white/5"
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>چراغ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      onUpdateCarState({
                        highBeamActive: !carState.highBeamActive,
                        headlightsActive: true,
                      });
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                      carState.highBeamActive
                        ? "border-sky-400/70 text-sky-200 bg-sky-500/20"
                        : "border-white/10 text-slate-300 bg-white/5"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>نور بالا</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      onUpdateCarState({ sunroofOpen: !carState.sunroofOpen });
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                      carState.sunroofOpen
                        ? "border-sky-400/70 text-sky-200 bg-sky-500/20"
                        : "border-white/10 text-slate-300 bg-white/5"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>سانروف</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextHazard = !carState.hazardActive;
                      carAudio.playHazardTick(nextHazard);
                      onUpdateCarState({ hazardActive: nextHazard });
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                      carState.hazardActive
                        ? "border-amber-400/70 text-amber-200 bg-amber-500/20"
                        : "border-white/10 text-slate-300 bg-white/5"
                    }`}
                  >
                    <TriangleAlert className="w-3.5 h-3.5" />
                    <span>فلاشر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextLock = !carState.doorsLocked;
                      carAudio.playLockBeep(nextLock);
                      onUpdateCarState({ doorsLocked: nextLock });
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                      carState.doorsLocked
                        ? "border-emerald-500/60 text-emerald-200 bg-emerald-500/15"
                        : "border-rose-500/60 text-rose-200 bg-rose-500/15"
                    }`}
                  >
                    {carState.doorsLocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                    <span>{carState.doorsLocked ? "قفل" : "باز"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      carAudio.playButtonTap();
                      const nextSpeed =
                        carState.speed === 0 ? 60 : carState.speed < 100 ? 120 : 0;
                      const nextRpm = nextSpeed === 0 ? 780 : nextSpeed === 60 ? 2150 : 3450;
                      onUpdateCarState({ speed: nextSpeed, rpm: nextRpm });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-mono font-bold text-white bg-white/10"
                    title="تغییر سرعت چرخش چرخ‌ها و جاده"
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    <span>{carState.speed} km/h</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
