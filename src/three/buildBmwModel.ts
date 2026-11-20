import * as THREE from "three";
import { BmwMaterialLibrary } from "./bmwMaterials";

export type InteractiveCarPart =
  | "headlights"
  | "sunroof"
  | "doors"
  | "wheels"
  | "hood";

export interface BmwLiveUpdateState {
  speed: number;
  headlightsActive: boolean;
  highBeamActive: boolean;
  fogLightsActive: boolean;
  hazardActive: boolean;
  leftSignal: boolean;
  rightSignal: boolean;
  sunroofOpen: boolean;
  doorsLocked: boolean;
  ambientHex: string;
  ambientBrightness: number;
  explodedAmount: number;
}

export interface Bmw3DAssembly {
  root: THREE.Group;
  interactables: THREE.Object3D[];
  update: (dt: number, elapsed: number, state: BmwLiveUpdateState) => void;
  dispose: () => void;
}

const WHEEL_RADIUS = 0.34;
const FRONT_AXLE_Z = 1.52;
const REAR_AXLE_Z = -1.48;
const TRACK_HALF_X = 0.83;

function tagInteractable(obj: THREE.Object3D, part: InteractiveCarPart, interactables: THREE.Object3D[]) {
  obj.userData.interactPart = part;
  obj.traverse((child) => {
    child.userData.interactPart = part;
  });
  interactables.push(obj);
}

/**
 * Helper to extrude a 2D (zForward, yUp) side-profile shape centered on world X.
 */
function createSideExtrudeGeometry(
  shape: THREE.Shape,
  width: number,
  bevelThickness = 0.05,
  bevelSize = 0.04,
  bevelSegments = 4
): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments: 24,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createTireProfileGeometry(): THREE.LatheGeometry {
  const outerR = WHEEL_RADIUS;
  const innerR = 0.235;
  const halfW = 0.115;

  const pts: THREE.Vector2[] = [
    new THREE.Vector2(innerR, -halfW * 0.82),
    new THREE.Vector2(innerR + 0.03, -halfW * 0.98),
    new THREE.Vector2(outerR - 0.025, -halfW),
    new THREE.Vector2(outerR, -halfW * 0.72),
    new THREE.Vector2(outerR, halfW * 0.72),
    new THREE.Vector2(outerR - 0.025, halfW),
    new THREE.Vector2(innerR + 0.03, halfW * 0.98),
    new THREE.Vector2(innerR, halfW * 0.82),
    new THREE.Vector2(innerR, -halfW * 0.82),
  ];

  const geo = new THREE.LatheGeometry(pts, 40);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildBmwModel(materials: BmwMaterialLibrary): Bmw3DAssembly {
  const root = new THREE.Group();
  root.name = "bmw-728li-e38";

  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const interactables: THREE.Object3D[] = [];

  // Ground contact shadow plane
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(2.85, 5.85));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(shadowGeo, materials.contactShadow);
  shadowMesh.position.set(0, 0.004, 0.02);
  shadowMesh.renderOrder = 1;
  root.add(shadowMesh);

  // =========================================================================
  // 1. LOWER BODY CHASSIS & WHEEL WELLS (Primary Mass)
  // =========================================================================
  const lowerChassisGroup = new THREE.Group();
  root.add(lowerChassisGroup);

  const lowerShape = new THREE.Shape();
  lowerShape.moveTo(-2.38, 0.30);
  lowerShape.lineTo(-2.43, 0.56);
  lowerShape.quadraticCurveTo(-2.41, 0.84, -2.30, 0.88);
  // Trunk deck line -> C-pillar base
  lowerShape.lineTo(-1.42, 0.91);
  // Beltline across doors
  lowerShape.lineTo(0.84, 0.88);
  // Hood shoulder tapering toward nose
  lowerShape.quadraticCurveTo(1.75, 0.83, 2.36, 0.69);
  lowerShape.quadraticCurveTo(2.46, 0.56, 2.41, 0.34);
  lowerShape.lineTo(2.26, 0.24);
  // Underbody sill with clean wheel arch gaps
  lowerShape.lineTo(1.90, 0.24);
  lowerShape.absarc(FRONT_AXLE_Z, 0.34, 0.38, 0.12, Math.PI - 0.12, false);
  lowerShape.lineTo(1.12, 0.22);
  lowerShape.lineTo(-1.08, 0.22);
  lowerShape.absarc(REAR_AXLE_Z, 0.34, 0.38, 0.12, Math.PI - 0.12, false);
  lowerShape.lineTo(-1.88, 0.24);
  lowerShape.closePath();

  const lowerGeo = trackGeo(createSideExtrudeGeometry(lowerShape, 1.72, 0.06, 0.045, 4));
  const lowerMesh = new THREE.Mesh(lowerGeo, materials.paint);
  lowerMesh.castShadow = true;
  lowerMesh.receiveShadow = true;
  lowerChassisGroup.add(lowerMesh);

  // Underbody floor pan & dark wheelhouse liners
  const floorPanGeo = trackGeo(new THREE.BoxGeometry(1.56, 0.08, 4.45));
  const floorPan = new THREE.Mesh(floorPanGeo, materials.mattePlastic);
  floorPan.position.set(0, 0.23, 0.02);
  floorPan.castShadow = true;
  lowerChassisGroup.add(floorPan);

  const archLinerGeo = trackGeo(
    new THREE.CylinderGeometry(0.375, 0.375, 0.32, 24, 1, false, 0, Math.PI)
  );
  archLinerGeo.rotateZ(Math.PI / 2);
  const archPositions: [number, number][] = [
    [-0.76, FRONT_AXLE_Z],
    [0.76, FRONT_AXLE_Z],
    [-0.76, REAR_AXLE_Z],
    [0.76, REAR_AXLE_Z],
  ];
  for (const [ax, az] of archPositions) {
    const liner = new THREE.Mesh(archLinerGeo, materials.mattePlastic);
    liner.position.set(ax, 0.34, az);
    liner.rotation.x = Math.PI / 2;
    lowerChassisGroup.add(liner);
  }

  // Chrome side body beltline trim & rocker sill molding
  const trimStripGeo = trackGeo(new THREE.BoxGeometry(0.022, 0.022, 2.28));
  const chromeBeltGeo = trackGeo(new THREE.BoxGeometry(0.018, 0.016, 2.22));
  for (const side of [-1, 1]) {
    const darkMold = new THREE.Mesh(trimStripGeo, materials.darkTrim);
    darkMold.position.set(side * 0.905, 0.50, 0.02);
    lowerChassisGroup.add(darkMold);

    const chromeLine = new THREE.Mesh(chromeBeltGeo, materials.chrome);
    chromeLine.position.set(side * 0.908, 0.515, 0.02);
    lowerChassisGroup.add(chromeLine);

    const sillChrome = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.02, 0.018, 2.1)),
      materials.chrome
    );
    sillChrome.position.set(side * 0.895, 0.25, 0.02);
    lowerChassisGroup.add(sillChrome);
  }

  // Inline-6 M52TUB28 Engine Bay Detail (revealed when hood lifts in Exploded View)
  const engineGroup = new THREE.Group();
  engineGroup.position.set(0, 0.50, 1.56);
  const blockMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.56, 0.26, 0.82)),
    materials.darkTrim
  );
  blockMesh.castShadow = true;
  engineGroup.add(blockMesh);

  const valveCover = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.32, 0.08, 0.72)),
    materials.mattePlastic
  );
  valveCover.position.set(0, 0.15, 0);
  engineGroup.add(valveCover);

  // 6 chrome intake runners
  const runnerGeo = trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 12));
  runnerGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const runner = new THREE.Mesh(runnerGeo, materials.chrome);
    runner.position.set(0.18, 0.11, -0.26 + i * 0.104);
    engineGroup.add(runner);
  }
  lowerChassisGroup.add(engineGroup);

  // =========================================================================
  // 2. SCULPTED HOOD (BONNET)
  // =========================================================================
  const hoodGroup = new THREE.Group();
  root.add(hoodGroup);

  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(0.84, 0.88);
  hoodShape.lineTo(1.55, 0.84);
  hoodShape.quadraticCurveTo(2.15, 0.77, 2.38, 0.69);
  hoodShape.lineTo(2.34, 0.65);
  hoodShape.lineTo(0.84, 0.83);
  hoodShape.closePath();

  const hoodGeo = trackGeo(createSideExtrudeGeometry(hoodShape, 1.52, 0.045, 0.035, 3));
  const hoodMesh = new THREE.Mesh(hoodGeo, materials.paint);
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  hoodGroup.add(hoodMesh);

  // Raised BMW power dome center ridge
  const powerDomeGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.032, 1.38));
  const powerDome = new THREE.Mesh(powerDomeGeo, materials.paint);
  powerDome.position.set(0, 0.825, 1.56);
  powerDome.rotation.x = 0.125;
  powerDome.castShadow = true;
  hoodGroup.add(powerDome);

  // Front BMW Roundel on hood nose
  const hoodBadge = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.036, 0.038, 0.008, 24)),
    materials.roundelBadge
  );
  hoodBadge.position.set(0, 0.735, 2.28);
  hoodBadge.rotation.x = 0.24;
  hoodGroup.add(hoodBadge);
  tagInteractable(hoodGroup, "hood", interactables);

  // =========================================================================
  // 3. TRUNK LID & REAR BADGE
  // =========================================================================
  const trunkGroup = new THREE.Group();
  root.add(trunkGroup);

  const trunkShape = new THREE.Shape();
  trunkShape.moveTo(-2.34, 0.87);
  trunkShape.lineTo(-1.46, 0.915);
  trunkShape.lineTo(-1.46, 0.87);
  trunkShape.lineTo(-2.32, 0.82);
  trunkShape.closePath();

  const trunkGeo = trackGeo(createSideExtrudeGeometry(trunkShape, 1.52, 0.035, 0.03, 3));
  const trunkMesh = new THREE.Mesh(trunkGeo, materials.paint);
  trunkMesh.castShadow = true;
  trunkGroup.add(trunkMesh);

  // Chrome trunk handle bar & rear BMW roundel
  const trunkChrome = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.56, 0.022, 0.025)),
    materials.chrome
  );
  trunkChrome.position.set(0, 0.78, -2.41);
  trunkGroup.add(trunkChrome);

  const rearBadge = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.036, 0.038, 0.008, 24)),
    materials.roundelBadge
  );
  rearBadge.rotation.x = -Math.PI / 2;
  rearBadge.position.set(0, 0.82, -2.415);
  trunkGroup.add(rearBadge);

  // =========================================================================
  // 4. INTERIOR CABIN SILHOUETTE (Visible through glass & exploded view)
  // =========================================================================
  const interiorGroup = new THREE.Group();
  root.add(interiorGroup);

  const seatGeo = trackGeo(new THREE.BoxGeometry(0.52, 0.48, 0.50));
  const backrestGeo = trackGeo(new THREE.BoxGeometry(0.48, 0.56, 0.14));
  const seatPositions: [number, number][] = [
    [-0.38, 0.12],
    [0.38, 0.12],
    [-0.38, -0.78],
    [0.38, -0.78],
  ];
  for (const [sx, sz] of seatPositions) {
    const cushion = new THREE.Mesh(seatGeo, materials.interiorLeather);
    cushion.position.set(sx, 0.44, sz);
    interiorGroup.add(cushion);

    const back = new THREE.Mesh(backrestGeo, materials.interiorLeather);
    back.position.set(sx, 0.72, sz - 0.22);
    back.rotation.x = -0.18;
    interiorGroup.add(back);
  }

  // Center console & Dashboard cowl
  const dashCowl = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.38, 0.26, 0.42)),
    materials.darkTrim
  );
  dashCowl.position.set(0, 0.78, 0.62);
  interiorGroup.add(dashCowl);

  // Glowing Ambient LED Interior Dash Strip (syncs to carState.ambientLightingColor)
  const ambientDashStrip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.32, 0.016, 0.025)),
    materials.interiorDashGlow
  );
  ambientDashStrip.position.set(0, 0.83, 0.415);
  interiorGroup.add(ambientDashStrip);

  // Steering wheel (left-hand drive)
  const steeringWheel = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.16, 0.022, 12, 28)),
    materials.darkTrim
  );
  steeringWheel.position.set(0.38, 0.88, 0.36);
  steeringWheel.rotation.x = -0.35;
  interiorGroup.add(steeringWheel);

  // =========================================================================
  // 5. GREENHOUSE CABIN, HOFMEISTER KINK GLASS & INTERACTIVE SUNROOF
  // =========================================================================
  const cabinGroup = new THREE.Group();
  root.add(cabinGroup);

  // Roof cap & A/B/C pillars with Hofmeister Kink silhouette
  const roofFrameShape = new THREE.Shape();
  roofFrameShape.moveTo(-1.58, 0.89);
  roofFrameShape.lineTo(-0.98, 1.40);
  roofFrameShape.quadraticCurveTo(-0.32, 1.44, 0.30, 1.40);
  roofFrameShape.lineTo(0.84, 0.88);
  roofFrameShape.lineTo(0.70, 0.88);
  roofFrameShape.lineTo(0.24, 1.33);
  roofFrameShape.lineTo(-0.90, 1.33);
  roofFrameShape.lineTo(-1.42, 0.89);
  roofFrameShape.closePath();

  const roofFrameGeo = trackGeo(createSideExtrudeGeometry(roofFrameShape, 1.42, 0.035, 0.025, 3));
  const roofFrameMesh = new THREE.Mesh(roofFrameGeo, materials.paint);
  roofFrameMesh.castShadow = true;
  cabinGroup.add(roofFrameMesh);

  // Roof metal skin panel (leaving opening for sunroof)
  const rearRoofPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.34, 0.045, 0.56)),
    materials.paint
  );
  rearRoofPanel.position.set(0, 1.395, -0.64);
  rearRoofPanel.castShadow = true;
  cabinGroup.add(rearRoofPanel);

  const frontRoofHeader = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.34, 0.045, 0.22)),
    materials.paint
  );
  frontRoofHeader.position.set(0, 1.395, 0.18);
  cabinGroup.add(frontRoofHeader);

  // Interactive Sunroof Glass Panel
  const sunroofGroup = new THREE.Group();
  sunroofGroup.position.set(0, 1.405, -0.14);
  const sunroofGlass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.92, 0.025, 0.44)),
    materials.glass
  );
  const sunroofFrame = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.96, 0.018, 0.48)),
    materials.darkTrim
  );
  sunroofFrame.position.y = -0.008;
  sunroofGroup.add(sunroofFrame, sunroofGlass);
  cabinGroup.add(sunroofGroup);
  tagInteractable(sunroofGroup, "sunroof", interactables);

  // Tinted Glass Greenhouse Volume (Windshield + Rear Glass + Side Windows)
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-1.50, 0.90);
  glassShape.lineTo(-0.94, 1.37);
  glassShape.quadraticCurveTo(-0.30, 1.41, 0.27, 1.37);
  glassShape.lineTo(0.80, 0.89);
  glassShape.closePath();

  const glassGeo = trackGeo(createSideExtrudeGeometry(glassShape, 1.38, 0.015, 0.01, 2));
  const glassMesh = new THREE.Mesh(glassGeo, materials.glass);
  cabinGroup.add(glassMesh);

  // Chrome window frame upper arches & B-pillars
  for (const side of [-1, 1]) {
    const bPillar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.03, 0.46, 0.11)),
      materials.darkTrim
    );
    bPillar.position.set(side * 0.72, 1.13, -0.22);
    bPillar.rotation.z = side * 0.14;
    cabinGroup.add(bPillar);

    const cChrome = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.02, 0.02, 1.24)),
      materials.chrome
    );
    cChrome.position.set(side * 0.715, 1.375, -0.32);
    cabinGroup.add(cChrome);
  }

  // =========================================================================
  // 6. FRONT FASCIA: ICONIC BMW TWIN KIDNEY GRILLES & BUMPER
  // =========================================================================
  const frontEndGroup = new THREE.Group();
  root.add(frontEndGroup);

  // Lower front bumper skirt & central air dam
  const frontBumper = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.76, 0.24, 0.22)),
    materials.paint
  );
  frontBumper.position.set(0, 0.36, 2.38);
  frontBumper.castShadow = true;
  frontEndGroup.add(frontBumper);

  const lowerIntakeMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.18, 0.11, 0.06)),
    materials.mattePlastic
  );
  lowerIntakeMesh.position.set(0, 0.31, 2.475);
  frontEndGroup.add(lowerIntakeMesh);

  // License Plate Plinth
  const frontPlate = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.48, 0.11, 0.025)),
    materials.chrome
  );
  frontPlate.position.set(0, 0.41, 2.495);
  frontEndGroup.add(frontPlate);

  // BMW Twin Kidney Grilles (2 sculpted chrome bezels + vertical slats)
  for (const side of [-1, 1]) {
    const kidneyGroup = new THREE.Group();
    kidneyGroup.position.set(side * 0.17, 0.61, 2.455);

    const bezel = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.28, 0.165, 0.035)),
      materials.chrome
    );
    const innerVoid = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.245, 0.132, 0.042)),
      materials.darkTrim
    );
    kidneyGroup.add(bezel, innerVoid);

    // 9 vertical chrome/dark kidney slats
    const slatGeo = trackGeo(new THREE.BoxGeometry(0.01, 0.125, 0.048));
    for (let s = -4; s <= 4; s++) {
      const slat = new THREE.Mesh(slatGeo, s % 2 === 0 ? materials.chrome : materials.darkTrim);
      slat.position.x = s * 0.025;
      kidneyGroup.add(slat);
    }
    frontEndGroup.add(kidneyGroup);
  }

  // Front Fog Lamps
  const fogGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 18));
  fogGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const fog = new THREE.Mesh(fogGeo, materials.fogLed);
    fog.position.set(side * 0.68, 0.32, 2.48);
    frontEndGroup.add(fog);
  }

  // =========================================================================
  // 7. QUAD ANGEL EYES HEADLIGHTS + VOLUMETRIC LIGHT CONES
  // =========================================================================
  const headlightsGroup = new THREE.Group();
  root.add(headlightsGroup);

  const haloGeo = trackGeo(new THREE.TorusGeometry(0.056, 0.009, 12, 28));
  const projectorGeo = trackGeo(new THREE.SphereGeometry(0.038, 16, 16));
  const housingGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.135, 0.08));
  const clearCoverGeo = trackGeo(new THREE.BoxGeometry(0.37, 0.145, 0.02));
  const blinkerCornerGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.11, 0.085));
  const beamGeo = trackGeo(new THREE.ConeGeometry(0.75, 4.2, 24, 1, true));
  beamGeo.translate(0, -2.1, 0);
  beamGeo.rotateX(-Math.PI / 2);

  for (const side of [-1, 1]) {
    const cluster = new THREE.Group();
    cluster.position.set(side * 0.61, 0.61, 2.41);

    const housing = new THREE.Mesh(housingGeo, materials.darkTrim);
    cluster.add(housing);

    // Outer & Inner twin Angel Eye halos
    for (const offset of [-0.08, 0.08]) {
      const halo = new THREE.Mesh(haloGeo, materials.angelEyeLed);
      halo.position.set(offset, 0, 0.042);
      cluster.add(halo);

      const proj = new THREE.Mesh(projectorGeo, materials.headlightProjector);
      proj.position.set(offset, 0, 0.02);
      cluster.add(proj);
    }

    const cover = new THREE.Mesh(clearCoverGeo, materials.headlightLens);
    cover.position.set(0, 0, 0.052);
    cluster.add(cover);

    // Corner Amber Turn Indicator
    const blinkerMat = side === 1 ? materials.leftBlinkerLed : materials.rightBlinkerLed;
    const cornerBlinker = new THREE.Mesh(blinkerCornerGeo, blinkerMat);
    cornerBlinker.position.set(side * 0.21, 0, -0.015);
    cluster.add(cornerBlinker);

    // Volumetric headlight beam cone (kept above ground plane y=0)
    const beam = new THREE.Mesh(beamGeo, materials.headlightBeam);
    beam.position.set(0, -0.05, 0.1);
    beam.rotation.x = 0.08;
    cluster.add(beam);

    headlightsGroup.add(cluster);
  }
  tagInteractable(headlightsGroup, "headlights", interactables);

  // =========================================================================
  // 8. REAR TAILLIGHTS, BUMPER & TWIN CHROME EXHAUSTS
  // =========================================================================
  const rearEndGroup = new THREE.Group();
  root.add(rearEndGroup);

  const rearBumper = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.76, 0.25, 0.20)),
    materials.paint
  );
  rearBumper.position.set(0, 0.36, -2.38);
  rearBumper.castShadow = true;
  rearEndGroup.add(rearBumper);

  const diffuser = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.48, 0.11, 0.07)),
    materials.mattePlastic
  );
  diffuser.position.set(0, 0.25, -2.46);
  rearEndGroup.add(diffuser);

  const exhaustPipeGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.22, 18));
  exhaustPipeGeo.rotateX(Math.PI / 2);
  const exhaustInnerGeo = trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.23, 16));
  exhaustInnerGeo.rotateX(Math.PI / 2);

  for (const ex of [-0.56, -0.46, 0.46, 0.56]) {
    const pipe = new THREE.Mesh(exhaustPipeGeo, materials.chrome);
    pipe.position.set(ex, 0.23, -2.44);
    const bore = new THREE.Mesh(exhaustInnerGeo, materials.darkTrim);
    bore.position.set(ex, 0.23, -2.445);
    rearEndGroup.add(pipe, bore);
  }

  // L-Shaped Red Taillights & Amber Blinkers
  const tailGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.12, 0.05));
  const rearBlinkerGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.05, 0.055));
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(tailGeo, materials.tailLed);
    tail.position.set(side * 0.67, 0.72, -2.425);
    rearEndGroup.add(tail);

    const rBlinkerMat = side === 1 ? materials.leftBlinkerLed : materials.rightBlinkerLed;
    const rBlinker = new THREE.Mesh(rearBlinkerGeo, rBlinkerMat);
    rBlinker.position.set(side * 0.74, 0.76, -2.43);
    rearEndGroup.add(rBlinker);
  }

  // =========================================================================
  // 9. SIDE MIRRORS & FLUSH DOOR HANDLES
  // =========================================================================
  const doorsTrimGroup = new THREE.Group();
  root.add(doorsTrimGroup);

  const mirrorCapGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.095, 0.13));
  const mirrorStemGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.04, 0.07));
  const handleGeo = trackGeo(new THREE.BoxGeometry(0.03, 0.028, 0.17));

  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(mirrorCapGeo, materials.paint);
    cap.position.set(side * 0.96, 0.92, 0.54);
    cap.castShadow = true;
    doorsTrimGroup.add(cap);

    const stem = new THREE.Mesh(mirrorStemGeo, materials.darkTrim);
    stem.position.set(side * 0.87, 0.90, 0.56);
    doorsTrimGroup.add(stem);

    for (const hz of [0.16, -0.68]) {
      const handle = new THREE.Mesh(handleGeo, materials.chrome);
      handle.position.set(side * 0.91, 0.76, hz);
      doorsTrimGroup.add(handle);
    }
  }
  tagInteractable(doorsTrimGroup, "doors", interactables);

  // =========================================================================
  // 10. 4 MULTI-PART WHEELS (Tire + 10-Spoke M-Parallel Rim + Rotor + Caliper)
  // =========================================================================
  const tireGeo = trackGeo(createTireProfileGeometry());
  const rimBarrelGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.19, 32, 1, true));
  rimBarrelGeo.rotateZ(Math.PI / 2);
  const rimLipGeo = trackGeo(new THREE.TorusGeometry(0.235, 0.015, 10, 32));
  rimLipGeo.rotateY(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.06, 0.06, 20));
  hubGeo.rotateZ(Math.PI / 2);
  const centerCapGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.038, 0.01, 20));
  centerCapGeo.rotateZ(Math.PI / 2);
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.022, 0.19, 0.022));
  const rotorGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.024, 28));
  rotorGeo.rotateZ(Math.PI / 2);
  const caliperGeo = trackGeo(new THREE.BoxGeometry(0.052, 0.11, 0.065));

  interface WheelAssembly {
    container: THREE.Group;
    spinGroup: THREE.Group;
    baseX: number;
    side: number;
  }

  const wheels: WheelAssembly[] = [];
  const wheelCoords: [number, number][] = [
    [TRACK_HALF_X, FRONT_AXLE_Z],
    [-TRACK_HALF_X, FRONT_AXLE_Z],
    [TRACK_HALF_X, REAR_AXLE_Z],
    [-TRACK_HALF_X, REAR_AXLE_Z],
  ];

  for (const [wx, wz] of wheelCoords) {
    const side = Math.sign(wx);
    const container = new THREE.Group();
    container.position.set(wx, WHEEL_RADIUS, wz);

    const spinGroup = new THREE.Group();
    container.add(spinGroup);

    const tire = new THREE.Mesh(tireGeo, materials.rubber);
    tire.castShadow = true;
    spinGroup.add(tire);

    const barrel = new THREE.Mesh(rimBarrelGeo, materials.alloyRim);
    spinGroup.add(barrel);

    const lip = new THREE.Mesh(rimLipGeo, materials.chrome);
    lip.position.x = side * 0.095;
    spinGroup.add(lip);

    const hub = new THREE.Mesh(hubGeo, materials.alloyRim);
    hub.position.x = side * 0.065;
    spinGroup.add(hub);

    const cap = new THREE.Mesh(centerCapGeo, materials.roundelBadge);
    cap.position.x = side * 0.098;
    cap.rotation.y = side > 0 ? 0 : Math.PI;
    spinGroup.add(cap);

    // 10 M-Parallel twin radial spokes
    for (let i = 0; i < 10; i++) {
      const spoke = new THREE.Mesh(spokeGeo, materials.alloyRim);
      const angle = (i / 10) * Math.PI * 2 + (i % 2 === 0 ? -0.06 : 0.06);
      spoke.position.set(
        side * 0.075,
        Math.cos(angle) * 0.13,
        Math.sin(angle) * 0.13
      );
      spoke.rotation.x = angle;
      spinGroup.add(spoke);
    }

    const rotor = new THREE.Mesh(rotorGeo, materials.brakeDisc);
    rotor.position.x = -side * 0.015;
    spinGroup.add(rotor);

    // Static brake caliper attached to container (doesn't spin with tire)
    const caliper = new THREE.Mesh(caliperGeo, materials.caliper);
    caliper.position.set(-side * 0.015, 0.05, -0.14);
    container.add(caliper);

    root.add(container);
    wheels.push({ container, spinGroup, baseX: wx, side });
    tagInteractable(container, "wheels", interactables);
  }

  // Smooth runtime animation state
  let currentExplode = 0;
  let currentSunroof = 0;
  let currentHeadlightPower = 0;
  let wheelAngle = 0;

  return {
    root,
    interactables,
    update: (dt: number, elapsed: number, state: BmwLiveUpdateState) => {
      const clampedDt = Math.min(dt, 0.05);

      // 1. Exploded view smooth damping
      currentExplode = THREE.MathUtils.damp(currentExplode, state.explodedAmount, 6.5, clampedDt);
      hoodGroup.position.y = currentExplode * 0.56;
      hoodGroup.position.z = currentExplode * 0.18;
      cabinGroup.position.y = currentExplode * 0.72;
      trunkGroup.position.y = currentExplode * 0.35;
      trunkGroup.position.z = -currentExplode * 0.14;
      frontEndGroup.position.z = currentExplode * 0.36;
      rearEndGroup.position.z = -currentExplode * 0.28;
      headlightsGroup.position.z = currentExplode * 0.36;

      for (const w of wheels) {
        w.container.position.x = w.baseX + w.side * currentExplode * 0.48;
      }

      // 2. Sunroof slide/tilt damping
      currentSunroof = THREE.MathUtils.damp(
        currentSunroof,
        state.sunroofOpen ? 1 : 0,
        7.5,
        clampedDt
      );
      sunroofGroup.position.y = 1.405 + currentSunroof * 0.04;
      sunroofGroup.position.z = -0.14 - currentSunroof * 0.28;
      sunroofGroup.rotation.x = currentSunroof * 0.11;

      // 3. Wheel rotation proportional to vehicle speed (m/s = km/h / 3.6)
      const speedMps = Math.max(0, state.speed) / 3.6;
      wheelAngle += (speedMps / WHEEL_RADIUS) * clampedDt;
      for (const w of wheels) {
        w.spinGroup.rotation.x = wheelAngle;
      }

      // 4. Headlights, Angel Eyes & Volumetric Cones
      const targetLight = state.headlightsActive ? (state.highBeamActive ? 2.0 : 1.0) : 0;
      currentHeadlightPower = THREE.MathUtils.damp(
        currentHeadlightPower,
        targetLight,
        10,
        clampedDt
      );
      materials.angelEyeLed.emissiveIntensity = 0.25 + currentHeadlightPower * 2.2;
      materials.headlightProjector.emissiveIntensity = currentHeadlightPower * 2.4;
      materials.headlightBeam.opacity = Math.min(0.24, currentHeadlightPower * 0.12);
      materials.fogLed.emissiveIntensity = state.fogLightsActive ? 2.1 : 0.05;
      materials.tailLed.emissiveIntensity =
        state.headlightsActive || state.speed === 0 ? 1.8 : 0.35;

      // 5. Turn Signal & Hazard Relay Blink (450ms cadence)
      const blinkOn = Math.floor(elapsed / 0.45) % 2 === 0;
      const leftActive = (state.hazardActive || state.leftSignal) && blinkOn;
      const rightActive = (state.hazardActive || state.rightSignal) && blinkOn;
      materials.leftBlinkerLed.emissiveIntensity = leftActive ? 2.8 : 0;
      materials.rightBlinkerLed.emissiveIntensity = rightActive ? 2.8 : 0;

      // 6. Ambient Interior LED Dash Glow
      materials.interiorDashGlow.color.set(state.ambientHex);
      materials.interiorDashGlow.emissive.set(state.ambientHex);
      materials.interiorDashGlow.emissiveIntensity =
        0.5 + (state.ambientBrightness / 100) * 1.8;

      // 7. Lock / Unlock Door Accent Cue (subtle suspension settle when driving)
      const bob = state.speed > 0 ? Math.sin(elapsed * 8.5) * 0.004 : 0;
      lowerChassisGroup.position.y = bob;
      interiorGroup.position.y = bob;
    },
    dispose: () => {
      for (const g of geometries) {
        g.dispose();
      }
    },
  };
}
