import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Pause,
  Play,
  Crosshair,
  Activity,
  Scan,
  ShieldCheck
} from 'lucide-react';

export type ViewMode = 'twin' | 'wireframe' | 'lidar';

export const BuildingViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('twin');
  const [isAutoOrbit, setIsAutoOrbit] = useState<boolean>(true);
  const [azimuthDeg, setAzimuthDeg] = useState<number>(42);

  // References for imperative controls from UI buttons
  const controlsRef = useRef<{
    resetView: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    toggleOrbit: () => void;
    setMode: (mode: ViewMode) => void;
  }>({
    resetView: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    toggleOrbit: () => {},
    setMode: () => {},
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 540;

    // --- 1. SCENE SETUP ---
    const scene = new THREE.Scene();

    // --- 2. CAMERA SETUP (Precision Isometric Angle) ---
    let cameraDistance = 19.5;
    const defaultDistance = 19.5;
    const minDistance = 11.5;
    const maxDistance = 29.0;
    const cameraTarget = new THREE.Vector3(0, 3.4, 0);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);

    const updateCameraPos = () => {
      const dir = new THREE.Vector3(13.5, 11.0, 15.0).normalize();
      camera.position.copy(cameraTarget).addScaledVector(dir, cameraDistance);
      camera.lookAt(cameraTarget);
    };
    updateCameraPos();

    // --- 3. RENDERER SETUP ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- 4. LIGHTING SYSTEM ---
    const ambientLight = new THREE.AmbientLight(0x0a1c3d, 2.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xa5f3fc, 3.8);
    keyLight.position.set(16, 26, 14);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 4.6);
    rimLight.position.set(-16, 18, -14);
    scene.add(rimLight);

    const blueFill = new THREE.DirectionalLight(0x1d4ed8, 2.4);
    blueFill.position.set(-10, -4, 12);
    scene.add(blueFill);

    const groundBounce = new THREE.DirectionalLight(0x0284c7, 1.4);
    groundBounce.position.set(0, -10, 0);
    scene.add(groundBounce);

    const lobbyPointLight = new THREE.PointLight(0x7dd3fc, 3.8, 9);
    lobbyPointLight.position.set(-1.2, 1.3, 1.8);
    scene.add(lobbyPointLight);

    const corePointLight = new THREE.PointLight(0x00d2ff, 3.5, 11);
    corePointLight.position.set(1.5, 4.6, 0.2);
    scene.add(corePointLight);

    const beaconLight = new THREE.PointLight(0x00ffff, 4.2, 8);
    beaconLight.position.set(1.6, 9.9, 0.2);
    scene.add(beaconLight);

    // --- 5. ROOT ROTATING SCENE GROUP ---
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Track all standard materials for wireframe/lidar toggles
    const standardMaterials: (THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial)[] = [];
    const edgeSegments: THREE.LineSegments[] = [];

    // Helper for tracked materials
    const registerMat = <T extends THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>(mat: T): T => {
      standardMaterials.push(mat);
      return mat;
    };

    // Helper for tracked edge segments
    const registerEdges = (edges: THREE.LineSegments): THREE.LineSegments => {
      edgeSegments.push(edges);
      return edges;
    };

    // --- 6. MATERIALS PALETTE ---
    const glassMat = registerMat(new THREE.MeshPhysicalMaterial({
      color: 0x0099ff,
      metalness: 0.1,
      roughness: 0.08,
      transmission: 0.75,
      transparent: true,
      opacity: 0.82,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    }));

    const railingGlassMat = registerMat(new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      metalness: 0.05,
      roughness: 0.1,
      transmission: 0.8,
      transparent: true,
      opacity: 0.65,
    }));

    const darkCompositeMat = registerMat(new THREE.MeshStandardMaterial({
      color: 0x0a1426,
      roughness: 0.42,
      metalness: 0.65,
    }));

    const floorSlabMat = registerMat(new THREE.MeshStandardMaterial({
      color: 0x0e1b33,
      roughness: 0.38,
      metalness: 0.7,
    }));

    const metalMullionMat = registerMat(new THREE.MeshStandardMaterial({
      color: 0x081020,
      roughness: 0.25,
      metalness: 0.85,
    }));

    const equipmentMat = registerMat(new THREE.MeshStandardMaterial({
      color: 0x122342,
      roughness: 0.3,
      metalness: 0.8,
    }));

    const roadMat = registerMat(new THREE.MeshStandardMaterial({
      color: 0x060b17,
      roughness: 0.88,
      metalness: 0.15,
    }));

    const sidewalkMat = registerMat(new THREE.MeshStandardMaterial({
      color: 0x0e1a34,
      roughness: 0.55,
      metalness: 0.4,
    }));

    const cyanLineMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85,
    });

    const windowEmissiveBright = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.8,
    });

    const windowEmissiveDim = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.45,
    });

    const windowEmissiveWarm = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.65,
    });

    const carPaintBlue = registerMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 }));
    const carPaintSilver = registerMat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95, roughness: 0.15 }));
    const carPaintDark = registerMat(new THREE.MeshStandardMaterial({ color: 0x030712, metalness: 0.8, roughness: 0.3 }));
    const carTireMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x05070e, roughness: 0.9 }));
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

    const roadMarkingMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.8,
    });

    // --- 7. REFINED HOLOGRAPHIC STAGE & GROUND PEDESTAL ---
    // Instead of a floating raw box that cuts off harshly in space, we create a
    // futuristic circular cybernetic dais + soft radial fade disc so it blends 100% smoothly into the page.

    // A. Soft Radial Gradient Ground Shadow / Fade Disc
    const createRadialFadeTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
        grad.addColorStop(0, 'rgba(0, 210, 255, 0.22)');
        grad.addColorStop(0.35, 'rgba(10, 25, 55, 0.45)');
        grad.addColorStop(0.65, 'rgba(4, 12, 28, 0.25)');
        grad.addColorStop(1, 'rgba(2, 10, 24, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const radialGroundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({
        map: createRadialFadeTexture(),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    radialGroundPlane.rotation.x = -Math.PI / 2;
    radialGroundPlane.position.y = 0.02;
    rootGroup.add(radialGroundPlane);

    // B. Tiered Circular Cybernetic Dais (Turntable Platform)
    const daisRadiusTop = 8.6;
    const daisRadiusBottom = 9.2;
    const daisHeight = 0.35;
    const daisGeo = new THREE.CylinderGeometry(daisRadiusTop, daisRadiusBottom, daisHeight, 64);
    const daisMesh = new THREE.Mesh(
      daisGeo,
      registerMat(new THREE.MeshStandardMaterial({
        color: 0x050c1c,
        roughness: 0.35,
        metalness: 0.85,
      }))
    );
    daisMesh.position.y = daisHeight / 2;
    rootGroup.add(daisMesh);

    // Dais Glowing Perimeter Trim Rings
    const daisRingGeo = new THREE.RingGeometry(daisRadiusTop - 0.08, daisRadiusTop, 64);
    const daisRingMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const daisRing = new THREE.Mesh(daisRingGeo, daisRingMat);
    daisRing.rotation.x = -Math.PI / 2;
    daisRing.position.y = daisHeight + 0.005;
    rootGroup.add(daisRing);

    // Sub-stage outer ring
    const daisLowerRingGeo = new THREE.RingGeometry(daisRadiusBottom - 0.06, daisRadiusBottom, 64);
    const daisLowerRing = new THREE.Mesh(
      daisLowerRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x0088ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      })
    );
    daisLowerRing.rotation.x = -Math.PI / 2;
    daisLowerRing.position.y = 0.05;
    rootGroup.add(daisLowerRing);

    // C. Architectural Plaza & Roads on Top of Turntable
    const siteSize = 11.8;

    const basePlatformGeo = new THREE.BoxGeometry(siteSize, 0.16, siteSize);
    const basePlatform = new THREE.Mesh(basePlatformGeo, sidewalkMat);
    basePlatform.position.y = daisHeight + 0.08;
    rootGroup.add(basePlatform);

    const basePlatformEdges = registerEdges(
      new THREE.LineSegments(new THREE.EdgesGeometry(basePlatformGeo), cyanLineMat)
    );
    basePlatformEdges.position.copy(basePlatform.position);
    rootGroup.add(basePlatformEdges);

    // Roadway Along South & East
    const roadElevation = basePlatform.position.y + 0.085;
    const southRoadGeo = new THREE.BoxGeometry(siteSize - 0.4, 0.02, 2.0);
    const southRoad = new THREE.Mesh(southRoadGeo, roadMat);
    southRoad.position.set(0, roadElevation, 4.6);
    rootGroup.add(southRoad);

    const eastRoadGeo = new THREE.BoxGeometry(2.0, 0.02, siteSize - 2.4);
    const eastRoad = new THREE.Mesh(eastRoadGeo, roadMat);
    eastRoad.position.set(4.6, roadElevation, -1.0);
    rootGroup.add(eastRoad);

    // Dashed Road Markings
    const dashGeo = new THREE.PlaneGeometry(0.65, 0.08);
    for (let x = -4.8; x <= 4.8; x += 1.3) {
      const dash = new THREE.Mesh(dashGeo, roadMarkingMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, roadElevation + 0.015, 4.6);
      rootGroup.add(dash);
    }

    const eastDashGeo = new THREE.PlaneGeometry(0.08, 0.65);
    for (let z = -5.4; z <= 3.2; z += 1.3) {
      const dash = new THREE.Mesh(eastDashGeo, roadMarkingMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(4.6, roadElevation + 0.015, z);
      rootGroup.add(dash);
    }

    // Pedestrian Zebra Crosswalk
    for (let i = 0; i < 5; i++) {
      const zebraBar = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1.2), roadMarkingMat);
      zebraBar.rotation.x = -Math.PI / 2;
      zebraBar.position.set(3.3 + i * 0.3, roadElevation + 0.015, 4.6);
      rootGroup.add(zebraBar);
    }

    // Curbs separating roads from sidewalk
    const curbMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x142747, roughness: 0.5 }));
    const curbSouthGeo = new THREE.BoxGeometry(siteSize - 0.4, 0.06, 0.12);
    const curbSouth = new THREE.Mesh(curbSouthGeo, curbMat);
    curbSouth.position.set(0, roadElevation + 0.03, 3.55);
    rootGroup.add(curbSouth);

    const curbEastGeo = new THREE.BoxGeometry(0.12, 0.06, siteSize - 2.4);
    const curbEast = new THREE.Mesh(curbEastGeo, curbMat);
    curbEast.position.set(3.55, roadElevation + 0.03, -1.0);
    rootGroup.add(curbEast);

    // Parking Stalls
    const parkingStallMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.7 });
    const stallOffsets = [-4.0, -2.7, -1.4];
    stallOffsets.forEach((sx) => {
      const pts = [
        new THREE.Vector3(sx - 0.55, roadElevation + 0.02, 3.4),
        new THREE.Vector3(sx - 0.55, roadElevation + 0.02, 2.1),
        new THREE.Vector3(sx + 0.55, roadElevation + 0.02, 2.1),
        new THREE.Vector3(sx + 0.55, roadElevation + 0.02, 3.4),
      ];
      const stallLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), parkingStallMat);
      rootGroup.add(stallLine);
    });

    // Parked Autonomous Vehicles
    const createVehicle = (x: number, z: number, rotationY: number, bodyMat: THREE.Material) => {
      const carGroup = new THREE.Group();
      carGroup.position.set(x, roadElevation + 0.02, z);
      carGroup.rotation.y = rotationY;

      const chassisGeo = new THREE.BoxGeometry(0.9, 0.2, 1.7);
      const chassis = new THREE.Mesh(chassisGeo, bodyMat);
      chassis.position.y = 0.16;
      carGroup.add(chassis);

      const cabinGeo = new THREE.BoxGeometry(0.76, 0.2, 0.95);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.34, -0.04);
      carGroup.add(cabin);

      const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.07, 10);
      const wheelOffsets = [
        [-0.44, 0.12, 0.52], [0.44, 0.12, 0.52],
        [-0.44, 0.12, -0.52], [0.44, 0.12, -0.52]
      ];
      wheelOffsets.forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(wheelGeo, carTireMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, wy, wz);
        carGroup.add(wheel);
      });

      const hlGeo = new THREE.BoxGeometry(0.16, 0.04, 0.03);
      const hlL = new THREE.Mesh(hlGeo, headlightMat);
      hlL.position.set(-0.3, 0.2, -0.86);
      carGroup.add(hlL);
      const hlR = hlL.clone();
      hlR.position.x = 0.3;
      carGroup.add(hlR);

      const tlL = new THREE.Mesh(hlGeo, taillightMat);
      tlL.position.set(-0.3, 0.2, 0.86);
      carGroup.add(tlL);
      const tlR = tlL.clone();
      tlR.position.x = 0.3;
      carGroup.add(tlR);

      rootGroup.add(carGroup);
    };

    createVehicle(-4.0, 2.75, 0, carPaintBlue);
    createVehicle(-2.7, 2.75, 0, carPaintSilver);
    createVehicle(-1.4, 2.75, 0, carPaintDark);
    createVehicle(4.6, -1.6, -Math.PI / 2, carPaintBlue);

    // Modern Street Lamps
    const createStreetLamp = (x: number, z: number, rotY: number) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(x, roadElevation + 0.02, z);
      lampGroup.rotation.y = rotY;

      const poleGeo = new THREE.CylinderGeometry(0.022, 0.03, 1.3, 8);
      const pole = new THREE.Mesh(poleGeo, metalMullionMat);
      pole.position.y = 0.65;
      lampGroup.add(pole);

      const armGeo = new THREE.BoxGeometry(0.035, 0.035, 0.3);
      const arm = new THREE.Mesh(armGeo, metalMullionMat);
      arm.position.set(0, 1.3, 0.13);
      lampGroup.add(arm);

      const headGeo = new THREE.BoxGeometry(0.05, 0.02, 0.18);
      const head = new THREE.Mesh(headGeo, windowEmissiveBright);
      head.position.set(0, 1.28, 0.2);
      lampGroup.add(head);

      rootGroup.add(lampGroup);
    };

    createStreetLamp(-4.6, 3.7, 0);
    createStreetLamp(0.5, 3.7, 0);
    createStreetLamp(3.7, 1.8, Math.PI / 2);
    createStreetLamp(3.7, -3.2, Math.PI / 2);

    // Architectural Digital-Twin Trees
    const treeTrunkMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x091428, roughness: 0.8 }));
    const foliageMat = registerMat(new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
      metalness: 0.4,
      wireframe: true,
    }));

    const createArchitecturalTree = (tx: number, tz: number, scale: number = 1.0) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(tx, roadElevation + 0.02, tz);
      treeGroup.scale.set(scale, scale, scale);

      const trunkGeo = new THREE.CylinderGeometry(0.045, 0.07, 0.6, 6);
      const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
      trunk.position.y = 0.3;
      treeGroup.add(trunk);

      const folGeo = new THREE.DodecahedronGeometry(0.44, 1);
      const folMesh = new THREE.Mesh(folGeo, foliageMat);
      folMesh.position.y = 0.88;
      treeGroup.add(folMesh);

      const coreGeo = new THREE.SphereGeometry(0.22, 8, 8);
      const coreMesh = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.65 }));
      coreMesh.position.y = 0.88;
      treeGroup.add(coreMesh);

      const ringGeo = new THREE.CylinderGeometry(0.26, 0.3, 0.07, 8);
      const ringMesh = new THREE.Mesh(ringGeo, darkCompositeMat);
      ringMesh.position.y = 0.035;
      treeGroup.add(ringMesh);

      rootGroup.add(treeGroup);
    };

    const treeCoords = [
      [-4.6, -4.5, 1.15], [-3.2, -4.6, 1.0], [-1.6, -4.6, 1.05],
      [-4.6, -2.2, 0.95], [-4.6, 0.4, 1.0],
      [2.8, 2.8, 0.95], [1.5, 2.8, 0.9],
      [2.8, -4.2, 1.1], [1.3, -4.4, 0.95]
    ];
    treeCoords.forEach(([tx, tz, sc]) => createArchitecturalTree(tx, tz, sc));

    // --- 8. MULTI-TIERED HIGH-DETAIL ARCHITECTURAL COMPLEX ---
    const buildingCenter = new THREE.Group();
    buildingCenter.position.set(-0.2, roadElevation + 0.02, -0.35);
    rootGroup.add(buildingCenter);

    // =========================================================================
    // WING A: MAIN CURTAIN-WALL GLASS TOWER (7 FLOORS)
    // =========================================================================
    const wingAWidth = 4.2;
    const wingADepth = 3.6;
    const wingAFloors = 7;
    const floorH = 0.88;
    const wingAX = -0.7;
    const wingAZ = 0.1;

    for (let f = 0; f < wingAFloors; f++) {
      const yBottom = f * floorH;
      const yMid = yBottom + floorH / 2;

      // Floor Slab
      const slabGeo = new THREE.BoxGeometry(wingAWidth + 0.28, 0.14, wingADepth + 0.28);
      const slab = new THREE.Mesh(slabGeo, floorSlabMat);
      slab.position.set(wingAX, yBottom + 0.07, wingAZ);
      buildingCenter.add(slab);

      const slabEdge = registerEdges(
        new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), cyanLineMat)
      );
      slabEdge.position.copy(slab.position);
      buildingCenter.add(slabEdge);

      // Glass Envelope
      const glassGeo = new THREE.BoxGeometry(wingAWidth, floorH - 0.14, wingADepth);
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(wingAX, yMid, wingAZ);
      buildingCenter.add(glass);

      // Vertical Mullions
      const numMullionsX = 5;
      const stepX = wingAWidth / numMullionsX;
      for (let m = 0; m <= numMullionsX; m++) {
        const mx = wingAX - wingAWidth / 2 + m * stepX;
        const mullionGeo = new THREE.BoxGeometry(0.045, floorH - 0.14, 0.08);

        const mullionFront = new THREE.Mesh(mullionGeo, metalMullionMat);
        mullionFront.position.set(mx, yMid, wingAZ + wingADepth / 2);
        buildingCenter.add(mullionFront);

        const mullionBack = new THREE.Mesh(mullionGeo, metalMullionMat);
        mullionBack.position.set(mx, yMid, wingAZ - wingADepth / 2);
        buildingCenter.add(mullionBack);
      }

      // Interior Columns
      const colGeo = new THREE.CylinderGeometry(0.08, 0.08, floorH - 0.14, 8);
      const colPositions = [
        [wingAX - 1.4, wingAZ - 1.1], [wingAX + 1.4, wingAZ - 1.1],
        [wingAX - 1.4, wingAZ + 1.1], [wingAX + 1.4, wingAZ + 1.1]
      ];
      colPositions.forEach(([cx, cz]) => {
        const col = new THREE.Mesh(colGeo, darkCompositeMat);
        col.position.set(cx, yMid, cz);
        buildingCenter.add(col);
      });

      // Office Windows
      const roomGeo = new THREE.BoxGeometry(0.85, floorH - 0.22, 0.1);
      const offsetsX = [-1.4, -0.45, 0.5, 1.4];
      offsetsX.forEach((ox, idx) => {
        const matPick = (f + idx) % 4 === 0 ? windowEmissiveWarm : (f + idx) % 3 === 0 ? windowEmissiveBright : windowEmissiveDim;
        const windowPane = new THREE.Mesh(roomGeo, matPick);
        windowPane.position.set(wingAX + ox, yMid, wingAZ + wingADepth / 2 - 0.08);
        buildingCenter.add(windowPane);
      });

      // Balconies on floors 2 & 4
      if (f === 2 || f === 4) {
        const balcWidth = 1.8;
        const balcDepth = 0.65;
        const balcFloorGeo = new THREE.BoxGeometry(balcWidth, 0.1, balcDepth);
        const balcFloor = new THREE.Mesh(balcFloorGeo, floorSlabMat);
        balcFloor.position.set(wingAX - 1.0, yBottom + 0.05, wingAZ + wingADepth / 2 + balcDepth / 2);
        buildingCenter.add(balcFloor);

        const railFrontGeo = new THREE.BoxGeometry(balcWidth, 0.38, 0.04);
        const railFront = new THREE.Mesh(railFrontGeo, railingGlassMat);
        railFront.position.set(wingAX - 1.0, yBottom + 0.28, wingAZ + wingADepth / 2 + balcDepth);
        buildingCenter.add(railFront);

        const railSideGeo = new THREE.BoxGeometry(0.04, 0.38, balcDepth);
        const railSide = new THREE.Mesh(railSideGeo, railingGlassMat);
        railSide.position.set(wingAX - 1.0 - balcWidth / 2, yBottom + 0.28, wingAZ + wingADepth / 2 + balcDepth / 2);
        buildingCenter.add(railSide);
      }
    }

    // =========================================================================
    // WING B: TALL SERVICE & EXECUTIVE TOWER (9 FLOORS)
    // =========================================================================
    const wingBWidth = 2.4;
    const wingBDepth = 3.8;
    const wingBHeight = 9 * floorH;
    const wingBX = 1.8;
    const wingBZ = 0.2;

    const coreGeo = new THREE.BoxGeometry(wingBWidth, wingBHeight, wingBDepth);
    const coreMesh = new THREE.Mesh(coreGeo, darkCompositeMat);
    coreMesh.position.set(wingBX, wingBHeight / 2, wingBZ);
    buildingCenter.add(coreMesh);

    const coreEdges = registerEdges(
      new THREE.LineSegments(new THREE.EdgesGeometry(coreGeo), cyanLineMat)
    );
    coreEdges.position.copy(coreMesh.position);
    buildingCenter.add(coreEdges);

    // LED Corner Strip
    const ledStripGeo = new THREE.BoxGeometry(0.06, wingBHeight, 0.06);
    const ledStrip = new THREE.Mesh(ledStripGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    ledStrip.position.set(wingBX + wingBWidth / 2 + 0.02, wingBHeight / 2, wingBZ + wingBDepth / 2 + 0.02);
    buildingCenter.add(ledStrip);

    // Ribbon Windows
    for (let f = 0; f < 8; f++) {
      const wy = 0.6 + f * floorH;
      const slitGeo = new THREE.BoxGeometry(0.3, 0.52, 0.06);

      const slit1 = new THREE.Mesh(slitGeo, windowEmissiveBright);
      slit1.position.set(wingBX - 0.5, wy, wingBZ + wingBDepth / 2 + 0.02);
      buildingCenter.add(slit1);

      const slit2 = new THREE.Mesh(slitGeo, windowEmissiveWarm);
      slit2.position.set(wingBX + 0.5, wy, wingBZ + wingBDepth / 2 + 0.02);
      buildingCenter.add(slit2);
    }

    // =========================================================================
    // WING C: GROUND LEVEL LOBBY & ENTRANCE PORTAL
    // =========================================================================
    const lobbyWidth = 2.8;
    const lobbyDepth = 1.6;
    const lobbyHeight = floorH * 1.6;
    const lobbyX = -0.8;
    const lobbyZ = wingAZ + wingADepth / 2 + lobbyDepth / 2;

    const lobbyGlassGeo = new THREE.BoxGeometry(lobbyWidth, lobbyHeight, lobbyDepth);
    const lobbyGlass = new THREE.Mesh(lobbyGlassGeo, glassMat);
    lobbyGlass.position.set(lobbyX, lobbyHeight / 2, lobbyZ);
    buildingCenter.add(lobbyGlass);

    const lobbyRoofGeo = new THREE.BoxGeometry(lobbyWidth + 0.35, 0.12, lobbyDepth + 0.35);
    const lobbyRoof = new THREE.Mesh(lobbyRoofGeo, floorSlabMat);
    lobbyRoof.position.set(lobbyX, lobbyHeight + 0.06, lobbyZ);
    buildingCenter.add(lobbyRoof);

    const lobbyRoofEdge = registerEdges(
      new THREE.LineSegments(new THREE.EdgesGeometry(lobbyRoofGeo), cyanLineMat)
    );
    lobbyRoofEdge.position.copy(lobbyRoof.position);
    buildingCenter.add(lobbyRoofEdge);

    // Canopy
    const canopyGeo = new THREE.BoxGeometry(2.2, 0.06, 1.2);
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.position.set(lobbyX, 1.4, lobbyZ + lobbyDepth / 2 + 0.6);
    buildingCenter.add(canopy);

    const canopyEdge = registerEdges(
      new THREE.LineSegments(new THREE.EdgesGeometry(canopyGeo), cyanLineMat)
    );
    canopyEdge.position.copy(canopy.position);
    buildingCenter.add(canopyEdge);

    // Canopy Struts
    const strutGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6);
    [-0.9, 0.9].forEach((sx) => {
      const strut = new THREE.Mesh(strutGeo, metalMullionMat);
      strut.position.set(lobbyX + sx, 1.7, lobbyZ + lobbyDepth / 2 + 0.4);
      strut.rotation.x = Math.PI / 4;
      buildingCenter.add(strut);
    });

    // Steps
    for (let s = 0; s < 3; s++) {
      const stepGeo = new THREE.BoxGeometry(2.6 + s * 0.3, 0.05, 0.35);
      const step = new THREE.Mesh(stepGeo, sidewalkMat);
      step.position.set(lobbyX, (2 - s) * 0.05, lobbyZ + lobbyDepth / 2 + 1.1 + s * 0.25);
      buildingCenter.add(step);
    }

    // =========================================================================
    // ROOFTOP ARCHITECTURE
    // =========================================================================
    const penthouseH = 1.1;
    const penthouseGeo = new THREE.BoxGeometry(1.8, penthouseH, 2.0);
    const penthouse = new THREE.Mesh(penthouseGeo, equipmentMat);
    penthouse.position.set(wingBX, wingBHeight + penthouseH / 2, wingBZ);
    buildingCenter.add(penthouse);

    const penthouseEdges = registerEdges(
      new THREE.LineSegments(new THREE.EdgesGeometry(penthouseGeo), cyanLineMat)
    );
    penthouseEdges.position.copy(penthouse.position);
    buildingCenter.add(penthouseEdges);

    for (let v = 0; v < 4; v++) {
      const ventGeo = new THREE.BoxGeometry(0.9, 0.05, 0.04);
      const vent = new THREE.Mesh(ventGeo, new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
      vent.position.set(wingBX, wingBHeight + 0.3 + v * 0.14, wingBZ + 1.02);
      buildingCenter.add(vent);
    }

    const antennaBaseGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.6, 8);
    const antennaBase = new THREE.Mesh(antennaBaseGeo, darkCompositeMat);
    antennaBase.position.set(wingBX, wingBHeight + penthouseH + 0.3, wingBZ);
    buildingCenter.add(antennaBase);

    const antennaNeedleGeo = new THREE.CylinderGeometry(0.02, 0.05, 1.8, 8);
    const antennaNeedle = new THREE.Mesh(antennaNeedleGeo, new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    antennaNeedle.position.set(wingBX, wingBHeight + penthouseH + 1.4, wingBZ);
    buildingCenter.add(antennaNeedle);

    const beaconGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const beaconMesh = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    beaconMesh.position.set(wingBX, wingBHeight + penthouseH + 2.3, wingBZ);
    buildingCenter.add(beaconMesh);

    const dishGeo = new THREE.CylinderGeometry(0.42, 0.08, 0.18, 16);
    const dishMesh = new THREE.Mesh(dishGeo, equipmentMat);
    dishMesh.rotation.z = Math.PI / 3;
    dishMesh.rotation.x = Math.PI / 6;
    dishMesh.position.set(wingBX - 0.6, wingBHeight + 0.45, wingBZ - 0.6);
    buildingCenter.add(dishMesh);

    // Wing A Rooftop
    const roofAY = wingAFloors * floorH;
    const parapetGeo = new THREE.BoxGeometry(wingAWidth + 0.1, 0.32, wingADepth + 0.1);
    const parapetEdges = registerEdges(
      new THREE.LineSegments(new THREE.EdgesGeometry(parapetGeo), cyanLineMat)
    );
    parapetEdges.position.set(wingAX, roofAY + 0.16, wingAZ);
    buildingCenter.add(parapetEdges);

    [-0.7, 0.7].forEach((hx) => {
      const hvacGeo = new THREE.BoxGeometry(0.9, 0.55, 1.1);
      const hvac = new THREE.Mesh(hvacGeo, equipmentMat);
      hvac.position.set(wingAX + hx, roofAY + 0.28, wingAZ);
      buildingCenter.add(hvac);

      const fanGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16);
      const fan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true }));
      fan.position.set(wingAX + hx, roofAY + 0.58, wingAZ);
      buildingCenter.add(fan);
    });

    const tankGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.85, 16);
    const tank = new THREE.Mesh(tankGeo, darkCompositeMat);
    tank.position.set(wingAX - 1.2, roofAY + 0.43, wingAZ - 0.9);
    buildingCenter.add(tank);

    const tankBandGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.06, 16);
    const tankBand = new THREE.Mesh(tankBandGeo, new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
    tankBand.position.copy(tank.position);
    buildingCenter.add(tankBand);

    // --- 9. DYNAMIC SCANNING LASER GRID PLANE ---
    // A translucent cyan wireframe plane that sweeps vertically to evoke active photogrammetry scanning
    const scanPlaneGeo = new THREE.PlaneGeometry(9.6, 9.6, 16, 16);
    const scanPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    const scanPlaneMesh = new THREE.Mesh(scanPlaneGeo, scanPlaneMat);
    scanPlaneMesh.rotation.x = Math.PI / 2;
    scanPlaneMesh.position.set(-0.2, 2.0, -0.35);
    rootGroup.add(scanPlaneMesh);

    // Dynamic horizontal scan laser bar
    const scanBarGeo = new THREE.BoxGeometry(9.8, 0.04, 0.04);
    const scanBarMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 });
    const scanBarMesh = new THREE.Mesh(scanBarGeo, scanBarMat);
    scanBarMesh.position.y = 2.0;
    rootGroup.add(scanBarMesh);

    // --- 10. RECONSTRUCTED POINT CLOUD DATA PARTICLES ---
    // Floating spatial vertices around the structure
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount; p++) {
      const px = (Math.random() - 0.5) * 14.0;
      const py = 0.5 + Math.random() * 9.0;
      const pz = (Math.random() - 0.5) * 14.0;
      particlePositions[p * 3] = px;
      particlePositions[p * 3 + 1] = py;
      particlePositions[p * 3 + 2] = pz;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.12,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particleSystem);

    // --- 11. HOLOGRAPHIC COMPASS & DRONE SCAN COORDINATE RINGS ---
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    const ringRadius1 = 9.8;
    const ringGeo1 = new THREE.RingGeometry(ringRadius1 - 0.035, ringRadius1, 96);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 2;
    ringMesh1.position.y = 0.06;
    ringGroup.add(ringMesh1);

    const ringRadius2 = 11.4;
    const ringGeo2 = new THREE.RingGeometry(ringRadius2 - 0.025, ringRadius2, 96);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x0077ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28,
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.x = Math.PI / 2.12;
    ringMesh2.position.y = 0.08;
    ringGroup.add(ringMesh2);

    const makeTextSprite = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#00d2ff';
        ctx.font = 'bold 64px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 64);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.7 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.2, 1.2, 1);
      return sprite;
    };

    const north = makeTextSprite('N');
    north.position.set(0, 0.35, -ringRadius1);
    ringGroup.add(north);

    const south = makeTextSprite('S');
    south.position.set(0, 0.35, ringRadius1);
    ringGroup.add(south);

    const east = makeTextSprite('E');
    east.position.set(ringRadius1, 0.35, 0);
    ringGroup.add(east);

    const west = makeTextSprite('W');
    west.position.set(-ringRadius1, 0.35, 0);
    ringGroup.add(west);

    // Orbiting Drone Scanner Beacon
    const orbiterGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const orbiterMesh = new THREE.Mesh(orbiterGeo, new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    ringGroup.add(orbiterMesh);

    // --- 12. SMOOTH INTERACTIVE CONTROLS & CAMERA DAMPING ---
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let mouseDeltaY = 0;
    let mouseDeltaX = 0;
    let targetMouseDeltaX = 0;
    let targetCameraDistance = cameraDistance;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      mouseDeltaY += dx * 0.005;
      targetMouseDeltaX = Math.max(-0.4, Math.min(0.4, targetMouseDeltaX + dy * 0.0035));
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.012;
      targetCameraDistance = Math.max(minDistance, Math.min(maxDistance, targetCameraDistance + e.deltaY * zoomSpeed));
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - prevMouse.x;
      const dy = e.touches[0].clientY - prevMouse.y;
      mouseDeltaY += dx * 0.005;
      targetMouseDeltaX = Math.max(-0.4, Math.min(0.4, targetMouseDeltaX + dy * 0.0035));
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // Imperative UI actions
    let autoOrbitActive = true;

    controlsRef.current.resetView = () => {
      mouseDeltaY = 0;
      targetMouseDeltaX = 0;
      targetCameraDistance = defaultDistance;
    };

    controlsRef.current.zoomIn = () => {
      targetCameraDistance = Math.max(minDistance, targetCameraDistance - 2.5);
    };

    controlsRef.current.zoomOut = () => {
      targetCameraDistance = Math.min(maxDistance, targetCameraDistance + 2.5);
    };

    controlsRef.current.toggleOrbit = () => {
      autoOrbitActive = !autoOrbitActive;
    };

    controlsRef.current.setMode = (mode: ViewMode) => {
      if (mode === 'wireframe') {
        standardMaterials.forEach((m) => {
          m.wireframe = true;
          m.opacity = 0.85;
          m.transparent = true;
        });
        particleMat.opacity = 0.9;
        scanPlaneMat.opacity = 0.45;
      } else if (mode === 'lidar') {
        standardMaterials.forEach((m) => {
          m.wireframe = false;
          m.opacity = 0.35;
          m.transparent = true;
        });
        particleMat.opacity = 1.0;
        particleMat.size = 0.18;
        scanPlaneMat.opacity = 0.6;
      } else {
        // Digital Twin Solid
        standardMaterials.forEach((m) => {
          m.wireframe = false;
          m.opacity = 1.0;
          m.transparent = false;
        });
        glassMat.transparent = true;
        glassMat.opacity = 0.82;
        railingGlassMat.transparent = true;
        railingGlassMat.opacity = 0.65;
        particleMat.opacity = 0.6;
        particleMat.size = 0.12;
        scanPlaneMat.opacity = 0.22;
      }
    };

    // --- 13. ANIMATION & SHIMMER LOOP ---
    let animId: number;
    let autoAngle = 0;
    let orbiterAngle = 0;
    let lastDegUpdate = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = performance.now() * 0.001;

      // Continuous auto-orbit when enabled and not dragging
      if (autoOrbitActive && !isDragging) {
        autoAngle += 0.0035;
      }
      ringGroup.rotation.y += 0.001;

      // Smooth camera zoom lerp
      if (Math.abs(cameraDistance - targetCameraDistance) > 0.01) {
        cameraDistance += (targetCameraDistance - cameraDistance) * 0.08;
        updateCameraPos();
      }

      // Smooth pitch tilt damping
      mouseDeltaX += (targetMouseDeltaX - mouseDeltaX) * 0.08;

      // Apply root rotation
      rootGroup.rotation.y = autoAngle + mouseDeltaY;
      rootGroup.rotation.x = mouseDeltaX;

      // Update HUD compass azimuth reading every 12 frames
      if (performance.now() - lastDegUpdate > 200) {
        const currentDeg = Math.round(((rootGroup.rotation.y * 180) / Math.PI) % 360);
        setAzimuthDeg(currentDeg >= 0 ? currentDeg : currentDeg + 360);
        lastDegUpdate = performance.now();
      }

      // Scanning Laser Vertical Sweep
      const scanY = 0.8 + (Math.sin(time * 1.5) * 0.5 + 0.5) * 8.0;
      scanPlaneMesh.position.y = scanY;
      scanBarMesh.position.y = scanY;
      scanBarMesh.position.z = Math.sin(time * 2.0) * 0.4 - 0.35;

      // Orbiting drone scanner pulse
      orbiterAngle += 0.016;
      orbiterMesh.position.set(
        Math.cos(orbiterAngle) * ringRadius2,
        0.25 + Math.sin(orbiterAngle) * 0.35,
        Math.sin(orbiterAngle) * ringRadius2
      );

      // Subtle breathing illumination
      beaconLight.intensity = 3.2 + Math.sin(time * 4.5) * 1.8;
      corePointLight.intensity = 2.8 + Math.sin(time * 2.0) * 1.0;
      lobbyPointLight.intensity = 3.0 + Math.cos(time * 1.8) * 0.8;

      renderer.render(scene, camera);
    };

    animate();

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });

    resizeObserver.observe(container);

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleModeSelect = (mode: ViewMode) => {
    setViewMode(mode);
    controlsRef.current.setMode(mode);
  };

  const handleReset = () => {
    controlsRef.current.resetView();
  };

  const handleZoomIn = () => {
    controlsRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    controlsRef.current.zoomOut();
  };

  return (
    <div className="relative w-full h-full min-h-[500px] lg:min-h-[560px] flex items-center justify-center group">
      
      {/* Precision Corner Reticles (Aero HUD Frame) */}
      <div className="absolute -top-1 -left-1 w-6 h-6 border-l-2 border-t-2 border-cyan-400/60 rounded-tl-lg pointer-events-none z-30 transition-all group-hover:w-8 group-hover:h-8 group-hover:border-cyan-300" />
      <div className="absolute -top-1 -right-1 w-6 h-6 border-r-2 border-t-2 border-cyan-400/60 rounded-tr-lg pointer-events-none z-30 transition-all group-hover:w-8 group-hover:h-8 group-hover:border-cyan-300" />
      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-2 border-b-2 border-cyan-400/60 rounded-bl-lg pointer-events-none z-30 transition-all group-hover:w-8 group-hover:h-8 group-hover:border-cyan-300" />
      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-2 border-b-2 border-cyan-400/60 rounded-br-lg pointer-events-none z-30 transition-all group-hover:w-8 group-hover:h-8 group-hover:border-cyan-300" />

      {/* Atmospheric Pedestal Glow Behind 3D Scene */}
      <div className="absolute inset-0 bg-radial-glow pointer-events-none opacity-80" />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[70%] h-[140px] bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />

      {/* Main Glassmorphic Viewport Container */}
      <div className="relative w-full h-full rounded-2xl sm:rounded-3xl border border-[#13274f]/70 bg-gradient-to-b from-[#061024]/70 via-[#030919]/50 to-[#020713]/85 backdrop-blur-xl shadow-[0_12px_45px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col">
        
        {/* Top Telemetry & Mode Control Bar */}
        <div className="relative z-20 px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between border-b border-[#0f2142]/60 bg-[#040c1d]/60 backdrop-blur-md">
          
          {/* Left Telemetry Pill */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-cyan-300 font-mono">
                <span>DIGITAL TWIN</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">BLDG-04</span>
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                LOD-400 Architectural Mesh
              </span>
            </div>
          </div>

          {/* Center/Right View Mode Switcher */}
          <div className="flex items-center bg-[#071329] p-1 rounded-xl border border-[#182f5b]/60 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => handleModeSelect('twin')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'twin'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_12px_rgba(0,210,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Render with realistic PBR glass & composite materials"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Realistic</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSelect('wireframe')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'wireframe'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_12px_rgba(0,210,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Inspect architectural wireframe grid"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Wireframe</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSelect('lidar')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'lidar'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_12px_rgba(0,210,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Display point-cloud data vertices & scan field"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>LiDAR</span>
            </button>
          </div>

        </div>

        {/* 3D WebGL Canvas Viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 w-full h-full min-h-[380px] sm:min-h-[440px] cursor-grab active:cursor-grabbing select-none"
        >
          {/* Subtle Corner Crosshairs */}
          <div className="absolute top-4 left-4 pointer-events-none z-10 opacity-40">
            <Crosshair className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="absolute top-4 right-4 pointer-events-none z-10 opacity-40">
            <Crosshair className="w-4 h-4 text-cyan-400" />
          </div>

          {/* Smooth Radial Vignette Mask — guarantees 0 hard edges anywhere */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(2, 10, 24, 0.4) 80%, rgba(2, 10, 24, 0.95) 100%)',
            }}
          />
        </div>

        {/* Bottom Interactive Toolbar & Telemetry Status */}
        <div className="relative z-20 px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between border-t border-[#0f2142]/60 bg-[#040c1d]/75 backdrop-blur-md">
          
          {/* Viewport Control Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAutoOrbit((prev) => !prev);
                controlsRef.current.toggleOrbit();
              }}
              className="p-1.5 rounded-lg bg-[#071329] hover:bg-[#0c1f40] border border-[#162a56] text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
              title={isAutoOrbit ? "Pause continuous auto-orbit" : "Resume auto-orbit"}
            >
              {isAutoOrbit ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-[#071329] hover:bg-[#0c1f40] border border-[#162a56] text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
              title="Reset to default isometric camera view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg bg-[#071329] hover:bg-[#0c1f40] border border-[#162a56] text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
              title="Zoom Camera In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg bg-[#071329] hover:bg-[#0c1f40] border border-[#162a56] text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
              title="Zoom Camera Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] text-slate-400 font-mono hidden md:inline ml-2">
              Drag to Orbit • Scroll to Zoom
            </span>
          </div>

          {/* Live Telemetry Readouts */}
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>AZ: <span className="text-cyan-300 font-semibold">{azimuthDeg}°</span></span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>RES: <span className="text-slate-200">1.2 cm/px</span></span>
            </div>
            <div className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold">
              99.4% ACCURACY
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
