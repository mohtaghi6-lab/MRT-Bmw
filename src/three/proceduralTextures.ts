import * as THREE from "three";

export interface FloorTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export interface ProceduralTextureBundle {
  showroomFloor: FloorTextureSet;
  highwayRoad: FloorTextureSet;
  radialShadow: THREE.CanvasTexture;
  brakeDisc: THREE.CanvasTexture;
  roundelLogo: THREE.CanvasTexture;
  dispose: () => void;
}

function configureRepeatTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
  isColor: boolean
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createShowroomFloorTextures(maxAnisotropy: number): FloorTextureSet {
  const size = 512;

  // Color / Albedo canvas
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext("2d")!;

  cCtx.fillStyle = "#12161e";
  cCtx.fillRect(0, 0, size, size);

  // Subtle architectural tile seams & micro mineral grain
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 16 + Math.floor(Math.random() * 20);
    cCtx.fillStyle = `rgb(${v}, ${v + 3}, ${v + 8})`;
    cCtx.fillRect(x, y, 2, 2);
  }

  cCtx.strokeStyle = "rgba(255,255,255,0.035)";
  cCtx.lineWidth = 2;
  cCtx.strokeRect(1, 1, size - 2, size - 2);
  cCtx.beginPath();
  cCtx.moveTo(size / 2, 0);
  cCtx.lineTo(size / 2, size);
  cCtx.moveTo(0, size / 2);
  cCtx.lineTo(size, size / 2);
  cCtx.stroke();

  // Roughness canvas (NoColorSpace)
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext("2d")!;
  rCtx.fillStyle = "#5c5c5c"; // ~0.36 base polished floor roughness
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 75 + Math.floor(Math.random() * 55);
    rCtx.fillStyle = `rgb(${g},${g},${g})`;
    rCtx.fillRect(x, y, 3, 3);
  }
  rCtx.strokeStyle = "#b0b0b0";
  rCtx.lineWidth = 2;
  rCtx.strokeRect(1, 1, size - 2, size - 2);

  // Bump canvas (NoColorSpace)
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext("2d")!;
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 112 + Math.floor(Math.random() * 32);
    bCtx.fillStyle = `rgb(${g},${g},${g})`;
    bCtx.fillRect(x, y, 2, 2);
  }

  return {
    map: configureRepeatTexture(colorCanvas, 10, 10, maxAnisotropy, true),
    roughnessMap: configureRepeatTexture(roughCanvas, 10, 10, maxAnisotropy, false),
    bumpMap: configureRepeatTexture(bumpCanvas, 10, 10, maxAnisotropy, false),
  };
}

function createHighwayRoadTextures(maxAnisotropy: number): FloorTextureSet {
  const size = 512;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext("2d")!;

  cCtx.fillStyle = "#161920";
  cCtx.fillRect(0, 0, size, size);

  // Asphalt aggregate speckle
  for (let i = 0; i < 7500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 16 + Math.floor(Math.random() * 28);
    cCtx.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
    cCtx.fillRect(x, y, 2, 2);
  }

  // Subtle shoulder lines on left and right edges of road tile
  cCtx.fillStyle = "rgba(226, 232, 240, 0.35)";
  cCtx.fillRect(18, 0, 8, size);
  cCtx.fillRect(size - 26, 0, 8, size);

  // Dashed center highway line
  cCtx.fillStyle = "rgba(245, 158, 11, 0.72)";
  cCtx.fillRect(size / 2 - 5, 24, 10, 170);
  cCtx.fillRect(size / 2 - 5, 280, 10, 170);

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext("2d")!;
  rCtx.fillStyle = "#989898";
  rCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 120 + Math.floor(Math.random() * 80);
    rCtx.fillStyle = `rgb(${g},${g},${g})`;
    rCtx.fillRect(x, y, 2, 2);
  }

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext("2d")!;
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 100 + Math.floor(Math.random() * 55);
    bCtx.fillStyle = `rgb(${g},${g},${g})`;
    bCtx.fillRect(x, y, 2, 2);
  }

  return {
    map: configureRepeatTexture(colorCanvas, 1, 14, maxAnisotropy, true),
    roughnessMap: configureRepeatTexture(roughCanvas, 1, 14, maxAnisotropy, false),
    bumpMap: configureRepeatTexture(bumpCanvas, 1, 14, maxAnisotropy, false),
  };
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.14,
    size / 2,
    size / 2,
    size * 0.5
  );
  grad.addColorStop(0, "rgba(0, 0, 0, 0.88)");
  grad.addColorStop(0.55, "rgba(0, 0, 0, 0.52)");
  grad.addColorStop(0.85, "rgba(0, 0, 0, 0.14)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBrakeDiscTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = "#8a929e";
  ctx.fillRect(0, 0, size, size);

  // Concentric brushed steel rings
  for (let r = 28; r < 122; r += 3) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 6 === 0 ? "rgba(255,255,255,0.16)" : "rgba(30,41,59,0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Cross-drilled cooling vents
  for (let a = 0; a < 12; a++) {
    const baseAngle = (a / 12) * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const r = 64 + k * 18;
      const angle = baseAngle + k * 0.1;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRoundelTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;

  // Outer black bezel
  ctx.beginPath();
  ctx.arc(c, c, 122, 0, Math.PI * 2);
  ctx.fillStyle = "#090b0f";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#d1d5db";
  ctx.stroke();

  // Inner quadrants
  const r = 74;
  // Top-right Blue
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, r, -Math.PI / 2, 0);
  ctx.closePath();
  ctx.fillStyle = "#0066b2";
  ctx.fill();

  // Bottom-left Blue
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, r, Math.PI / 2, Math.PI);
  ctx.closePath();
  ctx.fillStyle = "#0066b2";
  ctx.fill();

  // Top-left White
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
  ctx.fillStyle = "#f8fafc";
  ctx.fill();

  // Bottom-right White
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, r, 0, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = "#f8fafc";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextureBundle(maxAnisotropy: number): ProceduralTextureBundle {
  const showroomFloor = createShowroomFloorTextures(maxAnisotropy);
  const highwayRoad = createHighwayRoadTextures(maxAnisotropy);
  const radialShadow = createRadialShadowTexture();
  const brakeDisc = createBrakeDiscTexture();
  const roundelLogo = createRoundelTexture();

  return {
    showroomFloor,
    highwayRoad,
    radialShadow,
    brakeDisc,
    roundelLogo,
    dispose: () => {
      showroomFloor.map.dispose();
      showroomFloor.roughnessMap.dispose();
      showroomFloor.bumpMap.dispose();
      highwayRoad.map.dispose();
      highwayRoad.roughnessMap.dispose();
      highwayRoad.bumpMap.dispose();
      radialShadow.dispose();
      brakeDisc.dispose();
      roundelLogo.dispose();
    },
  };
}
