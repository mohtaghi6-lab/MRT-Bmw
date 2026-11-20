import * as THREE from "three";
import { ProceduralTextureBundle } from "./proceduralTextures";

export type BmwPaintId =
  | "sapphire-black"
  | "titanium-silver"
  | "oxford-green"
  | "imola-red"
  | "estoril-blue";

export interface BmwPaintOption {
  id: BmwPaintId;
  label: string;
  hex: string;
}

export const BMW_PAINT_OPTIONS: BmwPaintOption[] = [
  { id: "sapphire-black", label: "مشکی یاقوتی", hex: "#131822" },
  { id: "titanium-silver", label: "نقره‌ای تیتانیوم", hex: "#b8c2ce" },
  { id: "oxford-green", label: "سبز آکسفورد", hex: "#0b3b2e" },
  { id: "imola-red", label: "قرمز ایمولا", hex: "#8e151d" },
  { id: "estoril-blue", label: "آبی استوریل", hex: "#174694" },
];

export interface BmwMaterialLibrary {
  paint: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshStandardMaterial;
  darkTrim: THREE.MeshStandardMaterial;
  mattePlastic: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  headlightLens: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  alloyRim: THREE.MeshStandardMaterial;
  brakeDisc: THREE.MeshStandardMaterial;
  caliper: THREE.MeshStandardMaterial;
  interiorLeather: THREE.MeshStandardMaterial;
  interiorDashGlow: THREE.MeshStandardMaterial;
  angelEyeLed: THREE.MeshStandardMaterial;
  headlightProjector: THREE.MeshStandardMaterial;
  fogLed: THREE.MeshStandardMaterial;
  tailLed: THREE.MeshStandardMaterial;
  leftBlinkerLed: THREE.MeshStandardMaterial;
  rightBlinkerLed: THREE.MeshStandardMaterial;
  headlightBeam: THREE.MeshBasicMaterial;
  roundelBadge: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  setPaintColor: (paintId: BmwPaintId) => void;
  dispose: () => void;
}

export function createBmwMaterials(
  textures: ProceduralTextureBundle,
  isSoftwareGl: boolean
): BmwMaterialLibrary {
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(BMW_PAINT_OPTIONS[0].hex),
    metalness: 0.84,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.35,
  });

  const chrome = new THREE.MeshStandardMaterial({
    color: 0xe6ecf5,
    metalness: 0.96,
    roughness: 0.11,
    envMapIntensity: 1.5,
  });

  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x101319,
    metalness: 0.18,
    roughness: 0.68,
    envMapIntensity: 0.7,
  });

  const mattePlastic = new THREE.MeshStandardMaterial({
    color: 0x191d24,
    metalness: 0.08,
    roughness: 0.82,
    envMapIntensity: 0.5,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x102235,
    metalness: 0.06,
    roughness: 0.06,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.42,
    transmission: isSoftwareGl ? 0 : 0.44,
    ior: 1.5,
    thickness: 0.04,
    envMapIntensity: 1.4,
    depthWrite: false,
  });

  const headlightLens = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    metalness: 0.05,
    roughness: 0.04,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 1.6,
    depthWrite: false,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x15171b,
    metalness: 0.04,
    roughness: 0.88,
    envMapIntensity: 0.35,
  });

  const alloyRim = new THREE.MeshStandardMaterial({
    color: 0xdce3ed,
    metalness: 0.92,
    roughness: 0.18,
    envMapIntensity: 1.4,
  });

  const brakeDisc = new THREE.MeshStandardMaterial({
    map: textures.brakeDisc,
    color: 0xcbd5e1,
    metalness: 0.84,
    roughness: 0.34,
    envMapIntensity: 1.1,
  });

  const caliper = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    metalness: 0.52,
    roughness: 0.32,
  });

  const interiorLeather = new THREE.MeshStandardMaterial({
    color: 0x221b18,
    metalness: 0.05,
    roughness: 0.78,
  });

  const interiorDashGlow = new THREE.MeshStandardMaterial({
    color: 0xff6a00,
    emissive: new THREE.Color(0xff6a00),
    emissiveIntensity: 1.4,
    roughness: 0.4,
    metalness: 0.1,
  });

  const angelEyeLed = new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: new THREE.Color(0xfef08a),
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.1,
  });

  const headlightProjector = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: new THREE.Color(0xe0f2fe),
    emissiveIntensity: 0.15,
    roughness: 0.15,
    metalness: 0.3,
  });

  const fogLed = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: new THREE.Color(0xfbbf24),
    emissiveIntensity: 0.1,
    roughness: 0.25,
    metalness: 0.2,
  });

  const tailLed = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 0.4,
    roughness: 0.25,
    metalness: 0.2,
  });

  const leftBlinkerLed = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0,
    roughness: 0.25,
    metalness: 0.2,
  });

  const rightBlinkerLed = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0,
    roughness: 0.25,
    metalness: 0.2,
  });

  const headlightBeam = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const roundelBadge = new THREE.MeshStandardMaterial({
    map: textures.roundelLogo,
    roughness: 0.22,
    metalness: 0.45,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: textures.radialShadow,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });

  const allMaterials: THREE.Material[] = [
    paint,
    chrome,
    darkTrim,
    mattePlastic,
    glass,
    headlightLens,
    rubber,
    alloyRim,
    brakeDisc,
    caliper,
    interiorLeather,
    interiorDashGlow,
    angelEyeLed,
    headlightProjector,
    fogLed,
    tailLed,
    leftBlinkerLed,
    rightBlinkerLed,
    headlightBeam,
    roundelBadge,
    contactShadow,
  ];

  return {
    paint,
    chrome,
    darkTrim,
    mattePlastic,
    glass,
    headlightLens,
    rubber,
    alloyRim,
    brakeDisc,
    caliper,
    interiorLeather,
    interiorDashGlow,
    angelEyeLed,
    headlightProjector,
    fogLed,
    tailLed,
    leftBlinkerLed,
    rightBlinkerLed,
    headlightBeam,
    roundelBadge,
    contactShadow,
    setPaintColor: (paintId: BmwPaintId) => {
      const found = BMW_PAINT_OPTIONS.find((p) => p.id === paintId) ?? BMW_PAINT_OPTIONS[0];
      paint.color.set(found.hex);
    },
    dispose: () => {
      for (const m of allMaterials) {
        m.dispose();
      }
    },
  };
}
