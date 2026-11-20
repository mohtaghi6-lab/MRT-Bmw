import * as THREE from "three";
import { ProceduralTextureBundle } from "./proceduralTextures";

export type ShowroomEnvMode = "showroom" | "highway";

export interface ShowroomEnvironment {
  group: THREE.Group;
  update: (
    dt: number,
    mode: ShowroomEnvMode,
    speedKmh: number,
    ambientHex: string,
    ambientBrightness: number
  ) => void;
  dispose: () => void;
}

const _scratchObj = new THREE.Object3D();

export function buildShowroomEnvironment(
  textures: ProceduralTextureBundle
): ShowroomEnvironment {
  const group = new THREE.Group();
  group.name = "bmw-showroom-env";

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Main Ground Plane (Showroom slate or Highway asphalt)
  const groundGeo = new THREE.PlaneGeometry(80, 140);
  groundGeo.rotateX(-Math.PI / 2);
  geometries.push(groundGeo);

  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.showroomFloor.map,
    roughnessMap: textures.showroomFloor.roughnessMap,
    bumpMap: textures.showroomFloor.bumpMap,
    bumpScale: 0.015,
    roughness: 0.55,
    metalness: 0.18,
    envMapIntensity: 0.9,
  });
  materials.push(groundMat);

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  groundMesh.position.y = 0;
  group.add(groundMesh);

  // 2. Showroom Circular Turntable Plinth + Perimeter LED Ring
  const plinthGroup = new THREE.Group();
  group.add(plinthGroup);

  const plinthGeo = new THREE.CylinderGeometry(3.4, 3.55, 0.05, 64);
  geometries.push(plinthGeo);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x151922,
    metalness: 0.72,
    roughness: 0.28,
    envMapIntensity: 1.15,
  });
  materials.push(plinthMat);

  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = -0.025;
  plinth.receiveShadow = true;
  plinthGroup.add(plinth);

  const chromeRimGeo = new THREE.TorusGeometry(3.42, 0.022, 12, 72);
  chromeRimGeo.rotateX(Math.PI / 2);
  geometries.push(chromeRimGeo);
  const chromeRimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.94,
    roughness: 0.14,
  });
  materials.push(chromeRimMat);
  const chromeRim = new THREE.Mesh(chromeRimGeo, chromeRimMat);
  chromeRim.position.y = 0.005;
  plinthGroup.add(chromeRim);

  const ledRingGeo = new THREE.TorusGeometry(3.32, 0.018, 12, 72);
  ledRingGeo.rotateX(Math.PI / 2);
  geometries.push(ledRingGeo);
  const ledRingMat = new THREE.MeshStandardMaterial({
    color: 0xff6a00,
    emissive: new THREE.Color(0xff6a00),
    emissiveIntensity: 1.8,
    roughness: 0.25,
    metalness: 0.1,
  });
  materials.push(ledRingMat);
  const ledRing = new THREE.Mesh(ledRingGeo, ledRingMat);
  ledRing.position.y = 0.008;
  plinthGroup.add(ledRing);

  // 3. InstancedMesh: Showroom Architectural Overhead Light Louvers (28 instances)
  const louverCount = 28;
  const louverGeo = new THREE.BoxGeometry(0.14, 0.06, 4.4);
  geometries.push(louverGeo);
  const louverMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: new THREE.Color(0xe2e8f0),
    emissiveIntensity: 1.25,
    roughness: 0.25,
  });
  materials.push(louverMat);

  const louverInstanced = new THREE.InstancedMesh(louverGeo, louverMat, louverCount);
  for (let i = 0; i < louverCount; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    _scratchObj.position.set(side * 1.45, 4.35, -7.8 + row * 1.2);
    _scratchObj.rotation.set(0, 0, 0);
    _scratchObj.scale.set(1, 1, 0.35);
    _scratchObj.updateMatrix();
    louverInstanced.setMatrixAt(i, _scratchObj.matrix);
  }
  louverInstanced.instanceMatrix.needsUpdate = true;
  louverInstanced.computeBoundingSphere();
  plinthGroup.add(louverInstanced);

  // 4. InstancedMesh: Highway Night Light Poles & Luminaires (32 instances, scrolled by speed)
  const highwayGroup = new THREE.Group();
  highwayGroup.visible = false;
  group.add(highwayGroup);

  const poleCount = 32;
  const poleGeo = new THREE.BoxGeometry(0.12, 4.2, 0.12);
  geometries.push(poleGeo);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.78,
    roughness: 0.38,
  });
  materials.push(poleMat);

  const lampGeo = new THREE.BoxGeometry(0.65, 0.08, 0.22);
  geometries.push(lampGeo);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: new THREE.Color(0xfbbf24),
    emissiveIntensity: 2.1,
    roughness: 0.2,
  });
  materials.push(lampMat);

  const poleInstanced = new THREE.InstancedMesh(poleGeo, poleMat, poleCount);
  const lampInstanced = new THREE.InstancedMesh(lampGeo, lampMat, poleCount);
  const poleSpacing = 7.5;
  const loopSpan = (poleCount / 2) * poleSpacing;

  const updateHighwayPoles = (scrollZ: number) => {
    for (let i = 0; i < poleCount; i++) {
      const pairIdx = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      const rawZ = pairIdx * poleSpacing - scrollZ;
      const wrappedZ = ((((rawZ + loopSpan / 2) % loopSpan) + loopSpan) % loopSpan) - loopSpan / 2;

      _scratchObj.position.set(side * 4.8, 2.1, wrappedZ);
      _scratchObj.rotation.set(0, 0, 0);
      _scratchObj.scale.set(1, 1, 1);
      _scratchObj.updateMatrix();
      poleInstanced.setMatrixAt(i, _scratchObj.matrix);

      _scratchObj.position.set(side * 4.45, 4.18, wrappedZ);
      _scratchObj.updateMatrix();
      lampInstanced.setMatrixAt(i, _scratchObj.matrix);
    }
    poleInstanced.instanceMatrix.needsUpdate = true;
    lampInstanced.instanceMatrix.needsUpdate = true;
  };

  updateHighwayPoles(0);
  poleInstanced.computeBoundingSphere();
  lampInstanced.computeBoundingSphere();
  highwayGroup.add(poleInstanced, lampInstanced);

  let currentMode: ShowroomEnvMode = "showroom";
  let roadScroll = 0;

  return {
    group,
    update: (
      dt: number,
      mode: ShowroomEnvMode,
      speedKmh: number,
      ambientHex: string,
      ambientBrightness: number
    ) => {
      if (mode !== currentMode) {
        currentMode = mode;
        const activeTex = mode === "highway" ? textures.highwayRoad : textures.showroomFloor;
        groundMat.map = activeTex.map;
        groundMat.roughnessMap = activeTex.roughnessMap;
        groundMat.bumpMap = activeTex.bumpMap;
        groundMat.needsUpdate = true;

        plinthGroup.visible = mode === "showroom";
        highwayGroup.visible = mode === "highway";
      }

      // Sync perimeter showroom LED ring with active BMW Ambient Lighting theme
      ledRingMat.color.set(ambientHex);
      ledRingMat.emissive.set(ambientHex);
      ledRingMat.emissiveIntensity = 0.65 + (ambientBrightness / 100) * 1.9;

      // Scroll asphalt texture & roadside lamps in Highway mode
      if (mode === "highway" && speedKmh > 0) {
        const mps = speedKmh / 3.6;
        roadScroll += mps * Math.min(dt, 0.05);
        // Highway road plane length is 140m with repeatY=14 (1 tile = 10m)
        textures.highwayRoad.map.offset.y = -(roadScroll / 10) % 1;
        textures.highwayRoad.roughnessMap.offset.y = textures.highwayRoad.map.offset.y;
        textures.highwayRoad.bumpMap.offset.y = textures.highwayRoad.map.offset.y;
        updateHighwayPoles(roadScroll);
      }
    },
    dispose: () => {
      for (const g of geometries) {
        g.dispose();
      }
      for (const m of materials) {
        m.dispose();
      }
    },
  };
}
