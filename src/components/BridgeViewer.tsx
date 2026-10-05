import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FilterState, CustomMarking } from '../types';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Crosshair,
  Plus,
  Minus,
  Compass,
  Maximize2,
  Flame,
  AlertTriangle,
  Home,
  MapPin,
  Anchor,
  Mountain as MountainIcon,
  Droplets,
  ArrowRight,
  Users,
  MousePointerClick,
  X,
  Loader2,
} from 'lucide-react';

interface BridgeViewerProps {
  filters: FilterState;
  customMarkingsMaster?: boolean;
  markings: CustomMarking[];
  /** Platform (AI-detected) markings from backend annotations — controlled by platform layer toggles */
  platformMarkings?: CustomMarking[];
  onRecenter?: () => void;
  /** When true, the viewer enters placement mode — waiting for a click to place a marker */
  placementMode?: boolean;
  /** Color of the ghost marker shown during placement */
  pendingColor?: string;
  /** Called with the 3D world position when the user clicks during placement */
  onPlacementConfirm?: (position: [number, number, number]) => void;
  /** Called when the user cancels placement (ESC or cancel button) */
  onCancelPlacement?: () => void;
  /** Incident ID */
  incidentId?: string;
  /** Direct model URL to the real GLB 3D reconstruction */
  modelUrl?: string | null;
}

interface ProjectedBox {
  id: string;
  name: string;
  type: string;
  color: string;
  visible: boolean;
  pointsSvg: string; // "x1,y1 x2,y2 x3,y3 x4,y4"
  badgeX: number;
  badgeY: number;
  anchorX: number;
  anchorY: number;
  iconType?: string;
  zDist: number;
}

export const BridgeViewer: React.FC<BridgeViewerProps> = ({
  filters,
  customMarkingsMaster = true,
  markings,
  platformMarkings = [],
  placementMode = false,
  pendingColor = '#f59e0b',
  onPlacementConfirm,
  onCancelPlacement,
  incidentId,
  modelUrl,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [compassAngle, setCompassAngle] = useState<number>(0);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Root model group ref (procedural bridge scene)
  const rootModelGroupRef = useRef<THREE.Group | null>(null);
  // Real 3D Photogrammetry GLB model group ref
  const realModelGroupRef = useRef<THREE.Group | null>(null);
  const isRealModelLoadedRef = useRef<boolean>(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'loaded' | 'empty'>('idle');
  const incidentIdRef = useRef<string | undefined>(incidentId);

  // Shared scene ref — lets the markers effect add 3D pins without rebuilding the scene
  const sceneRef = useRef<THREE.Scene | null>(null);
  // Dedicated group for all 3D entity-marker pins (platform + custom)
  const markersGroupRef = useRef<THREE.Group | null>(null);

  // ── Live refs so the animate loop always sees the latest props without scene rebuild ──
  const filtersRef = useRef<FilterState>(filters);
  const customMarkingsMasterRef = useRef<boolean>(customMarkingsMaster);
  const markingsRef = useRef<CustomMarking[]>(markings);
  const platformMarkingsRef = useRef<CustomMarking[]>(platformMarkings);
  const placementModeRef = useRef<boolean>(placementMode);
  const pendingColorRef = useRef<string>(pendingColor);
  const onPlacementConfirmRef = useRef(onPlacementConfirm);
  const onCancelPlacementRef = useRef(onCancelPlacement);

  // Ghost marker refs (set inside useEffect, used for color updates)
  const ghostMarkerRef = useRef<THREE.Mesh | null>(null);
  const ghostRingRef = useRef<THREE.Mesh | null>(null);
  const ghostStemRef = useRef<THREE.Mesh | null>(null);

  // Keep refs in sync with latest props on every render
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { customMarkingsMasterRef.current = customMarkingsMaster; }, [customMarkingsMaster]);
  useEffect(() => { markingsRef.current = markings; }, [markings]);
  useEffect(() => { platformMarkingsRef.current = platformMarkings; }, [platformMarkings]);
  useEffect(() => { placementModeRef.current = placementMode; }, [placementMode]);
  useEffect(() => { pendingColorRef.current = pendingColor; }, [pendingColor]);
  useEffect(() => { onPlacementConfirmRef.current = onPlacementConfirm; }, [onPlacementConfirm]);
  useEffect(() => { onCancelPlacementRef.current = onCancelPlacement; }, [onCancelPlacement]);
  useEffect(() => { incidentIdRef.current = incidentId; }, [incidentId]);

  // Update ghost marker color when pendingColor changes
  useEffect(() => {
    const color = new THREE.Color(pendingColor);
    if (ghostMarkerRef.current) {
      (ghostMarkerRef.current.material as THREE.MeshBasicMaterial).color.copy(color);
    }
    if (ghostRingRef.current) {
      (ghostRingRef.current.material as THREE.MeshBasicMaterial).color.copy(color);
    }
    if (ghostStemRef.current) {
      (ghostStemRef.current.material as THREE.MeshBasicMaterial).color.copy(color);
    }
  }, [pendingColor]);

  // Projected 2D screen bounding boxes & callout positions
  const [projectedBoxes, setProjectedBoxes] = useState<ProjectedBox[]>([]);

  // Ghost marker 2D projected position for the screen label
  const [ghostScreenPos, setGhostScreenPos] = useState<{ x: number; y: number } | null>(null);

  // ESC key handler
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && placementModeRef.current) {
      onCancelPlacementRef.current?.();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleEsc]);

  // ── Three.js scene is built ONCE (empty dependency array) ─────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;

    // --- 1. SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020713);
    scene.fog = new THREE.FogExp2(0x020713, 0.014);
    sceneRef.current = scene;

    // --- 2. CAMERA SETUP ---
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 400);
    const defaultCamPos = new THREE.Vector3(17.5, 14.5, 21.0);
    const defaultTarget = new THREE.Vector3(0.5, 0.8, 0.5);
    camera.position.copy(defaultCamPos);
    camera.lookAt(defaultTarget);
    cameraRef.current = camera;

    // --- 3. RENDERER SETUP ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- 4. ORBIT CONTROLS ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defaultTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = false;
    controls.minDistance = 7;
    controls.maxDistance = 65;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minPolarAngle = 0.12;
    controls.update();
    controlsRef.current = controls;

    // --- 5. LIGHTING SYSTEM ---
    const ambientLight = new THREE.AmbientLight(0x0a224a, 2.8);
    scene.add(ambientLight);

    const mainMoonLight = new THREE.DirectionalLight(0x7dd3fc, 3.4);
    mainMoonLight.position.set(24, 36, 18);
    mainMoonLight.castShadow = true;
    mainMoonLight.shadow.mapSize.width = 2048;
    mainMoonLight.shadow.mapSize.height = 2048;
    mainMoonLight.shadow.bias = -0.0005;
    scene.add(mainMoonLight);

    const cyanRimLight = new THREE.DirectionalLight(0x00e5ff, 2.6);
    cyanRimLight.position.set(-22, 20, -22);
    scene.add(cyanRimLight);

    const waterUnderBounce = new THREE.DirectionalLight(0x0284c7, 1.5);
    waterUnderBounce.position.set(0, -12, 0);
    scene.add(waterUnderBounce);

    // Point lights for active incident zones
    const firePointLight = new THREE.PointLight(0xff3b00, 6.0, 10);
    firePointLight.position.set(-2.0, 2.2, 0.2);
    scene.add(firePointLight);

    const docheckPointLight = new THREE.PointLight(0xf59e0b, 3.5, 7);
    docheckPointLight.position.set(-4.2, 1.8, -1.8);
    scene.add(docheckPointLight);

    const shelterPointLight = new THREE.PointLight(0xa855f7, 3.5, 7);
    shelterPointLight.position.set(2.5, 1.6, 1.8);
    scene.add(shelterPointLight);

    // --- 6. ROOT MODEL GROUP (procedural bridge for initial demo) ---
    const rootModelGroup = new THREE.Group();
    scene.add(rootModelGroup);
    rootModelGroupRef.current = rootModelGroup;

    // --- 6b. REAL 3D RECONSTRUCTION MODEL GROUP (from real SfM GLB export) ---
    const realModelGroup = new THREE.Group();
    scene.add(realModelGroup);
    realModelGroupRef.current = realModelGroup;

    // --- 6c. ENTITY MARKERS GROUP — 3D pins for detected + custom entities ---
    // This group lives at the top of the scene so markers always render above terrain.
    // The reactive useEffect below populates it whenever markings / filters change.
    const markersGroup = new THREE.Group();
    markersGroup.renderOrder = 10; // draw on top
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;


    // Common Materials
    const cyanWireMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.85 });
    const blueWireMat = new THREE.LineBasicMaterial({ color: 0x0088dd, transparent: true, opacity: 0.5 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x091730, roughness: 0.55, metalness: 0.45 });
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x060f22, roughness: 0.85, metalness: 0.2 });
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x0c1f42, roughness: 0.4, metalness: 0.6 });

    // Helper: Add Mesh with Crisp Glowing Wireframe Edges
    const addMeshWithGlowEdges = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      pos: [number, number, number],
      parent: THREE.Object3D,
      rot?: [number, number, number],
      edgeMat: THREE.LineBasicMaterial = cyanWireMat
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      edges.position.copy(mesh.position);
      if (rot) edges.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(edges);

      return mesh;
    };

    // =========================================================================
    // 7. WATER CHANNEL & RIVER BED
    // =========================================================================
    const waterY = -3.8;
    const waterGeo = new THREE.PlaneGeometry(120, 120, 48, 48);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x041b38,
      metalness: 0.3,
      roughness: 0.12,
      transmission: 0.65,
      transparent: true,
      opacity: 0.88,
      reflectivity: 0.9,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = waterY;
    waterMesh.receiveShadow = true;
    rootModelGroup.add(waterMesh);

    // River cybernetic grid ripples
    const waterGrid = new THREE.GridHelper(90, 45, 0x0088cc, 0x003366);
    waterGrid.position.y = waterY + 0.02;
    rootModelGroup.add(waterGrid);

    // =========================================================================
    // 8. WIREFRAME MOUNTAINS & TERRAIN
    // =========================================================================
    const terrainGroup = new THREE.Group();
    rootModelGroup.add(terrainGroup);

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x040d1f,
      roughness: 0.85,
      metalness: 0.3,
      flatShading: true,
    });

    const createMountainRidge = (
      centerX: number,
      centerZ: number,
      radius: number,
      height: number,
      segments: number = 24
    ) => {
      const geo = new THREE.ConeGeometry(radius, height, segments, 4);
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const noise = Math.sin(vx * 0.4) * Math.cos(vz * 0.4) * 0.8;
        posAttr.setY(i, vy + (vy > 0 ? noise : 0));
        posAttr.setX(i, vx + Math.sin(vy * 0.5) * 0.5);
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, terrainMat);
      mesh.position.set(centerX, waterY + height / 2, centerZ);
      terrainGroup.add(mesh);

      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x0099ee, transparent: true, opacity: 0.42 })
      );
      wire.position.copy(mesh.position);
      terrainGroup.add(wire);
    };

    createMountainRidge(-18, -20, 16, 14, 28);
    createMountainRidge(-5, -22, 14, 12, 24);
    createMountainRidge(12, -24, 18, 15, 28);
    createMountainRidge(26, -18, 15, 13, 24);
    createMountainRidge(-26, 4, 12, 8, 20);
    createMountainRidge(-22, 18, 14, 9, 22);
    createMountainRidge(24, 8, 14, 8, 20);
    createMountainRidge(28, 22, 16, 10, 22);

    // =========================================================================
    // 9. HIGHWAY VIADUCT BRIDGE
    // =========================================================================
    const bridgeGroup = new THREE.Group();
    rootModelGroup.add(bridgeGroup);

    const bridgeAngleY = Math.atan2(8.4 - -7.8, 16 - -16);
    const bridgeLength = 40.0;
    const bridgeWidth = 4.2;
    const bridgeCenterY = 1.1;

    const deckGeo = new THREE.BoxGeometry(bridgeWidth, 0.28, bridgeLength);
    const deckMesh = new THREE.Mesh(deckGeo, asphaltMat);
    deckMesh.position.set(0, bridgeCenterY, 0);
    deckMesh.rotation.y = -bridgeAngleY + Math.PI / 2;
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    bridgeGroup.add(deckMesh);

    const deckEdges = new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo), cyanWireMat);
    deckEdges.position.copy(deckMesh.position);
    deckEdges.rotation.copy(deckMesh.rotation);
    bridgeGroup.add(deckEdges);

    const railHeight = 0.38;
    const railThick = 0.14;
    [-bridgeWidth / 2 + railThick / 2, bridgeWidth / 2 - railThick / 2].forEach((offsetSide) => {
      const railGeo = new THREE.BoxGeometry(railThick, railHeight, bridgeLength);
      const railMesh = new THREE.Mesh(railGeo, barrierMat);
      const cosA = Math.cos(-bridgeAngleY + Math.PI / 2);
      const sinA = Math.sin(-bridgeAngleY + Math.PI / 2);
      railMesh.position.set(offsetSide * cosA, bridgeCenterY + railHeight / 2 + 0.14, -offsetSide * sinA);
      railMesh.rotation.copy(deckMesh.rotation);
      bridgeGroup.add(railMesh);

      const railEdges = new THREE.LineSegments(new THREE.EdgesGeometry(railGeo), cyanWireMat);
      railEdges.position.copy(railMesh.position);
      railEdges.rotation.copy(railMesh.rotation);
      bridgeGroup.add(railEdges);
    });

    const markingMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.85 });
    const yellowDividerMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 });

    const dividerGeo = new THREE.BoxGeometry(0.06, 0.01, bridgeLength - 0.4);
    [-0.05, 0.05].forEach((dy) => {
      const dividerMesh = new THREE.Mesh(dividerGeo, yellowDividerMat);
      const cosA = Math.cos(-bridgeAngleY + Math.PI / 2);
      const sinA = Math.sin(-bridgeAngleY + Math.PI / 2);
      dividerMesh.position.set(dy * cosA, bridgeCenterY + 0.145, -dy * sinA);
      dividerMesh.rotation.copy(deckMesh.rotation);
      bridgeGroup.add(dividerMesh);
    });

    const dashLength = 0.7;
    const dashStep = 1.4;
    [-1.05, 1.05].forEach((laneOffset) => {
      for (let z = -bridgeLength / 2 + 1; z <= bridgeLength / 2 - 1; z += dashStep) {
        const dashGeo = new THREE.BoxGeometry(0.05, 0.01, dashLength);
        const dashMesh = new THREE.Mesh(dashGeo, markingMat);
        const cosA = Math.cos(-bridgeAngleY + Math.PI / 2);
        const sinA = Math.sin(-bridgeAngleY + Math.PI / 2);
        const wx = laneOffset * cosA + z * sinA;
        const wz = -laneOffset * sinA + z * cosA;
        dashMesh.position.set(wx, bridgeCenterY + 0.145, wz);
        dashMesh.rotation.copy(deckMesh.rotation);
        bridgeGroup.add(dashMesh);
      }
    });

    const pierPositions = [-14, -7, 0, 7, 14];
    pierPositions.forEach((pierZ, idx) => {
      const cosA = Math.cos(-bridgeAngleY + Math.PI / 2);
      const sinA = Math.sin(-bridgeAngleY + Math.PI / 2);
      const pierX = pierZ * sinA;
      const pierActualZ = pierZ * cosA;
      const pierHeight = bridgeCenterY - waterY;

      const capGeo = new THREE.BoxGeometry(bridgeWidth + 0.3, 0.4, 1.2);
      addMeshWithGlowEdges(
        capGeo,
        concreteMat,
        [pierX, bridgeCenterY - 0.28, pierActualZ],
        bridgeGroup,
        [0, -bridgeAngleY + Math.PI / 2, 0],
        blueWireMat
      );

      [-1.3, 1.3].forEach((colOffset) => {
        const colGeo = new THREE.BoxGeometry(0.8, pierHeight, 0.8);
        const colX = pierX + colOffset * cosA;
        const colZ = pierActualZ - colOffset * sinA;
        addMeshWithGlowEdges(
          colGeo,
          concreteMat,
          [colX, waterY + pierHeight / 2, colZ],
          bridgeGroup,
          [0, -bridgeAngleY + Math.PI / 2, 0],
          blueWireMat
        );
      });

      if (idx === 1 || idx === 2) {
        const archGeo = new THREE.BoxGeometry(0.35, 0.35, 7.0);
        const archMesh = new THREE.Mesh(archGeo, concreteMat);
        archMesh.position.set(
          (pierPositions[idx] + 3.5) * sinA,
          bridgeCenterY - 1.2,
          (pierPositions[idx] + 3.5) * cosA
        );
        archMesh.rotation.set(0.1, -bridgeAngleY + Math.PI / 2, 0);
        bridgeGroup.add(archMesh);
      }
    });

    // =========================================================================
    // 10. VEHICLES ON THE HIGHWAY
    // =========================================================================
    const vehicleGroup = new THREE.Group();
    bridgeGroup.add(vehicleGroup);

    const carPaintBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.25 });
    const carPaintSilver = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
    const carPaintDark = new THREE.MeshStandardMaterial({ color: 0x030712, metalness: 0.7, roughness: 0.3 });
    const carPaintWhite = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5, roughness: 0.3 });
    const carTireMat = new THREE.MeshStandardMaterial({ color: 0x05070e, roughness: 0.9 });

    const createCarOnBridge = (
      deckLocalX: number,
      deckLocalZ: number,
      paintMat: THREE.Material,
      scale: number = 1.0,
      reverse: boolean = false
    ) => {
      const car = new THREE.Group();
      const chassisGeo = new THREE.BoxGeometry(0.7 * scale, 0.25 * scale, 1.4 * scale);
      const chassis = new THREE.Mesh(chassisGeo, paintMat);
      chassis.position.y = 0.16 * scale;
      car.add(chassis);

      const cabinGeo = new THREE.BoxGeometry(0.58 * scale, 0.22 * scale, 0.8 * scale);
      const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshPhysicalMaterial({ color: 0x0284c7, transmission: 0.8, transparent: true }));
      cabin.position.set(0, 0.35 * scale, -0.05 * scale);
      car.add(cabin);

      const wGeo = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 0.06 * scale, 8);
      [
        [-0.34 * scale, 0.1 * scale, 0.45 * scale],
        [0.34 * scale, 0.1 * scale, 0.45 * scale],
        [-0.34 * scale, 0.1 * scale, -0.45 * scale],
        [0.34 * scale, 0.1 * scale, -0.45 * scale]
      ].forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(wGeo, carTireMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, wy, wz);
        car.add(wheel);
      });

      const cosA = Math.cos(-bridgeAngleY + Math.PI / 2);
      const sinA = Math.sin(-bridgeAngleY + Math.PI / 2);
      const wx = deckLocalX * cosA + deckLocalZ * sinA;
      const wz = -deckLocalX * sinA + deckLocalZ * cosA;
      car.position.set(wx, bridgeCenterY + 0.14, wz);
      car.rotation.y = -bridgeAngleY + Math.PI / 2 + (reverse ? Math.PI : 0);
      vehicleGroup.add(car);
      return car;
    };

    const createSemiTruck = (deckLocalX: number, deckLocalZ: number) => {
      const truck = new THREE.Group();

      const cabGeo = new THREE.BoxGeometry(0.9, 0.6, 1.2);
      const cab = new THREE.Mesh(cabGeo, carPaintBlue);
      cab.position.set(0, 0.35, -1.2);
      truck.add(cab);

      const trailerGeo = new THREE.BoxGeometry(0.95, 0.8, 3.2);
      const trailer = new THREE.Mesh(trailerGeo, carPaintWhite);
      trailer.position.set(0, 0.5, 0.9);
      truck.add(trailer);

      const cosA = Math.cos(-bridgeAngleY + Math.PI / 2);
      const sinA = Math.sin(-bridgeAngleY + Math.PI / 2);
      const wx = deckLocalX * cosA + deckLocalZ * sinA;
      const wz = -deckLocalX * sinA + deckLocalZ * cosA;
      truck.position.set(wx, bridgeCenterY + 0.14, wz);
      truck.rotation.y = -bridgeAngleY + Math.PI / 2;
      vehicleGroup.add(truck);
    };

    createSemiTruck(1.0, 5.2);
    createCarOnBridge(-1.0, -11.0, carPaintSilver, 1.0, false);
    createCarOnBridge(1.0, -8.5, carPaintDark, 1.0, true);
    createCarOnBridge(-1.0, -4.5, carPaintBlue, 1.0, false);
    createCarOnBridge(-1.0, 1.2, carPaintSilver, 1.0, false);
    createCarOnBridge(1.0, 9.5, carPaintDark, 1.0, true);
    createCarOnBridge(-1.0, 12.0, carPaintBlue, 1.0, false);

    // =========================================================================
    // 11. ACTIVE INCIDENT ZONES
    // =========================================================================
    const rubbleMeshGroup = new THREE.Group();
    bridgeGroup.add(rubbleMeshGroup);

    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const rubbleChunks = [
      [0.0, 0.12, 0.2, 0.6, 0.2, 0.5, 0.2],
      [-0.4, 0.1, 0.5, 0.5, 0.25, 0.4, -0.3],
      [0.3, 0.15, -0.2, 0.7, 0.3, 0.6, 0.5],
      [-0.2, 0.08, -0.6, 0.4, 0.18, 0.4, 0.1],
    ];
    rubbleChunks.forEach(([rx, ry, rz, sx, sy, sz, rot]) => {
      const chunkGeo = new THREE.BoxGeometry(sx, sy, sz);
      const chunk = new THREE.Mesh(chunkGeo, rubbleMat);
      chunk.position.set(0.2 + rx, bridgeCenterY + 0.14 + ry, 1.1 + rz);
      chunk.rotation.set(rot, rot * 2, rot);
      rubbleMeshGroup.add(chunk);
    });

    const fireMeshGroup = new THREE.Group();
    bridgeGroup.add(fireMeshGroup);

    const burnDecal = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 16),
      new THREE.MeshBasicMaterial({ color: 0x110500, transparent: true, opacity: 0.85 })
    );
    burnDecal.rotation.x = -Math.PI / 2;
    burnDecal.position.set(-2.0, bridgeCenterY + 0.145, 0.2);
    fireMeshGroup.add(burnDecal);

    const flameGeo = new THREE.ConeGeometry(0.35, 1.1, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff3b00, transparent: true, opacity: 0.9 });
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.set(-2.0, bridgeCenterY + 0.65, 0.2);
    fireMeshGroup.add(flameMesh);

    const innerFlameGeo = new THREE.ConeGeometry(0.2, 0.7, 8);
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.95 });
    const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    innerFlame.position.set(-2.0, bridgeCenterY + 0.5, 0.2);
    fireMeshGroup.add(innerFlame);

    // =========================================================================
    // 12. RESCUE PATROL BOAT
    // =========================================================================
    const boatGroup = new THREE.Group();
    boatGroup.position.set(-1.4, waterY + 0.15, 5.4);
    boatGroup.rotation.y = Math.PI / 4;
    rootModelGroup.add(boatGroup);

    const hullGeo = new THREE.BoxGeometry(0.75, 0.28, 1.6);
    const hullMesh = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ color: 0x0e2a4a, roughness: 0.4 }));
    boatGroup.add(hullMesh);

    const boatCabinGeo = new THREE.BoxGeometry(0.6, 0.35, 0.65);
    const boatCabin = new THREE.Mesh(boatCabinGeo, new THREE.MeshStandardMaterial({ color: 0x1e3a6a, roughness: 0.3 }));
    boatCabin.position.set(0, 0.28, -0.15);
    boatGroup.add(boatCabin);

    const mastGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
    const boatMast = new THREE.Mesh(mastGeo, new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
    boatMast.position.set(0, 0.7, -0.15);
    boatGroup.add(boatMast);

    const wakeGeo = new THREE.RingGeometry(0.8, 1.2, 16);
    const wakeMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
    wakeMesh.rotation.x = -Math.PI / 2;
    wakeMesh.position.y = -0.05;
    boatGroup.add(wakeMesh);

    // =========================================================================
    // 13. PLACEMENT MODE: RAYCASTER + GHOST MARKER
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();
    // Invisible horizontal plane at bridge-deck height for raycasting clicks
    const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
    const intersectPoint = new THREE.Vector3();

    // Ghost marker group — a glowing sphere + pulsing ring + vertical stem
    const ghostGroup = new THREE.Group();
    ghostGroup.visible = false;
    scene.add(ghostGroup);

    const ghostColor = new THREE.Color(pendingColor);

    // Sphere
    const ghostSphereGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const ghostSphereMat = new THREE.MeshBasicMaterial({
      color: ghostColor,
      transparent: true,
      opacity: 0.85,
    });
    const ghostSphere = new THREE.Mesh(ghostSphereGeo, ghostSphereMat);
    ghostSphere.position.y = 1.6;
    ghostGroup.add(ghostSphere);
    ghostMarkerRef.current = ghostSphere;

    // Vertical stem from ground to sphere
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8);
    const stemMat = new THREE.MeshBasicMaterial({
      color: ghostColor,
      transparent: true,
      opacity: 0.6,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.y = 0.8;
    ghostGroup.add(stemMesh);
    ghostStemRef.current = stemMesh;

    // Pulsing ground ring
    const ringGeo = new THREE.RingGeometry(0.6, 0.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ghostColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    ghostGroup.add(ringMesh);
    ghostRingRef.current = ringMesh;

    // ── Mouse event handlers for placement mode ──
    const handleMouseMove = (e: MouseEvent) => {
      if (!placementModeRef.current) {
        ghostGroup.visible = false;
        setGhostScreenPos(null);
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseNDC, camera);
      let hit = false;
      if (isRealModelLoadedRef.current && realModelGroupRef.current && realModelGroupRef.current.children.length > 0) {
        const intersects = raycaster.intersectObjects(realModelGroupRef.current.children, true);
        if (intersects.length > 0) {
          intersectPoint.copy(intersects[0].point);
          hit = true;
        }
      }
      if (!hit) {
        hit = !!raycaster.ray.intersectPlane(placementPlane, intersectPoint);
      }

      if (hit) {
        ghostGroup.position.set(intersectPoint.x, intersectPoint.y, intersectPoint.z);
        ghostGroup.visible = true;
      } else {
        ghostGroup.visible = false;
        setGhostScreenPos(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!placementModeRef.current) return;

      // Ignore clicks on UI buttons (they have pointer-events: auto)
      const target = e.target as HTMLElement;
      if (target !== renderer.domElement) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseNDC, camera);
      let hit = false;
      if (isRealModelLoadedRef.current && realModelGroupRef.current && realModelGroupRef.current.children.length > 0) {
        const intersects = raycaster.intersectObjects(realModelGroupRef.current.children, true);
        if (intersects.length > 0) {
          intersectPoint.copy(intersects[0].point);
          hit = true;
        }
      }
      if (!hit) {
        hit = !!raycaster.ray.intersectPlane(placementPlane, intersectPoint);
      }

      if (hit) {
        const pos: [number, number, number] = [intersectPoint.x, Math.max(0.5, intersectPoint.y + 0.2), intersectPoint.z];
        onPlacementConfirmRef.current?.(pos);
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // =========================================================================
    // 14. BOUNDING BOX COMPUTATION & ANIMATION LOOP
    //     Reads from refs (filtersRef, markingsRef) so NO scene rebuild needed
    //     when filters or markings change.
    // =========================================================================
    let animId: number;
    const tempVec = new THREE.Vector3();

    const getFootprintCorners = (marking: CustomMarking): THREE.Vector3[] => {
      const [cx, cy, cz] = marking.position;
      let w = 2.4;
      let l = 2.8;

      if (marking.name.includes('Rubble')) { w = 2.6; l = 3.6; }
      else if (marking.name.includes('Shelter')) { w = 2.8; l = 4.2; }
      else if (marking.name.includes('Fire')) { w = 2.4; l = 2.8; }
      else if (marking.name.includes('Boat')) { w = 1.4; l = 2.2; }
      else if (marking.name.includes('Mountain')) { w = 3.2; l = 3.2; }
      else if (marking.name.includes('Water')) { w = 2.0; l = 2.0; }

      const angle = marking.name.includes('Boat') ? Math.PI / 4 : -bridgeAngleY + Math.PI / 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const halfW = w / 2;
      const halfL = l / 2;

      const localCorners = [
        [-halfW, -halfL],
        [halfW, -halfL],
        [halfW, halfL],
        [-halfW, halfL],
      ];

      return localCorners.map(([lx, lz]) => {
        const wx = cx + (lx * cosA + lz * sinA);
        const wz = cz + (-lx * sinA + lz * cosA);
        return new THREE.Vector3(wx, cy, wz);
      });
    };

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = performance.now() * 0.001;

      controls.update();

      // Read latest filter & marking state from refs (no closure stale-state)
      const f = filtersRef.current;
      const m = markingsRef.current;

      // Synchronize Compass Needle
      const camAzimuth = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      setCompassAngle(THREE.MathUtils.radToDeg(camAzimuth));

      // Animated flame flickering
      flameMesh.scale.y = 1.0 + Math.sin(time * 12.0) * 0.25;
      innerFlame.scale.y = 1.0 + Math.cos(time * 15.0) * 0.2;
      firePointLight.intensity = 5.0 + Math.sin(time * 14.0) * 2.0;

      // ── Ghost marker pulse animation ──────────────────────────────────
      if (placementModeRef.current && ghostGroup.visible) {
        const pulse = 0.8 + Math.sin(time * 4.0) * 0.2;
        ringMesh.scale.set(pulse, pulse, pulse);
        (ringMat as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(time * 3.0) * 0.25;
        ghostSphere.position.y = 1.6 + Math.sin(time * 2.5) * 0.08;

        // Project ghost sphere to 2D screen for label
        const gWorld = new THREE.Vector3();
        ghostSphere.getWorldPosition(gWorld);
        const projected2D = gWorld.clone().project(camera);
        if (projected2D.z < 1) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          setGhostScreenPos({
            x: ((projected2D.x + 1) * cw) / 2,
            y: ((-projected2D.y + 1) * ch) / 2,
          });
        }
      } else {
        setGhostScreenPos(null);
      }

      // ── LAYER 1 — RECONSTRUCTED 3D MODEL ────────────────────────────────
      // Includes bridge, road, terrain, reconstructed vehicles, rubble, fire, and boat.
      // Reconstructed 3D geometry is controlled EXCLUSIVELY by f.reconstruction3D.
      // Detection-category filter buttons (humans, vehicles, fireSmoke, damage, entryExit)
      // must NEVER modify or hide Layer 1 geometry!
      if (isRealModelLoadedRef.current && realModelGroupRef.current) {
        realModelGroupRef.current.visible = f.reconstruction3D;
        rootModelGroup.visible = false;
        vehicleGroup.visible = false;
        rubbleMeshGroup.visible = false;
        fireMeshGroup.visible = false;
        boatGroup.visible = false;
      } else {
        rootModelGroup.visible = f.reconstruction3D;
        vehicleGroup.visible = f.reconstruction3D;
        rubbleMeshGroup.visible = f.reconstruction3D;
        fireMeshGroup.visible = f.reconstruction3D;
        boatGroup.visible = f.reconstruction3D;
      }

      // ── 3D MARKER PIN ANIMATION ──────────────────────────────────────────
      // Animate sphere bob + ring pulse for all pins in the markersGroup.
      if (markersGroupRef.current) {
        markersGroupRef.current.children.forEach((pinGroup, i) => {
          // Each pinGroup has: stem[0], sphere[1], ring[2], glowRing[3], (optional ptLight[4])
          const sphere   = pinGroup.children[1] as THREE.Mesh | undefined;
          const ring     = pinGroup.children[2] as THREE.Mesh | undefined;
          const glowRing = pinGroup.children[3] as THREE.Mesh | undefined;

          const phase = i * 0.7; // stagger each pin
          const bob   = Math.sin(time * 1.8 + phase) * 0.08;
          const pulse = 1.0 + Math.sin(time * 2.2 + phase) * 0.15;

          if (sphere)   sphere.position.y = sphere.position.y + bob * 0.02; // subtle
          if (ring)     ring.scale.set(pulse, pulse, 1);
          if (glowRing) glowRing.scale.set(pulse * 1.1, pulse * 1.1, 1);
        });
      }

      // ── LAYER 2 — ANALYSIS OVERLAYS ─────────────────────────────────────
      // Category filters control ONLY Layer 2 overlays (markers and labels).

      const currentWidth = container.clientWidth;
      const currentHeight = container.clientHeight;

      const projectMarking = (mk: CustomMarking, isVis: boolean): ProjectedBox => {
        const corners3D = getFootprintCorners(mk);
        const screenCorners: { x: number; y: number }[] = [];

        corners3D.forEach((pt) => {
          tempVec.copy(pt);
          tempVec.project(camera);
          screenCorners.push({
            x: ((tempVec.x + 1) * currentWidth) / 2,
            y: ((-tempVec.y + 1) * currentHeight) / 2,
          });
        });

        // Center Anchor Point — only this determines if marker is in front of camera
        tempVec.set(mk.position[0], mk.position[1], mk.position[2]);
        tempVec.project(camera);
        const centerInFront = tempVec.z < 1.0; // z >= 1 means behind camera or at far clip
        const anchorX = ((tempVec.x + 1) * currentWidth) / 2;
        const anchorY = ((-tempVec.y + 1) * currentHeight) / 2;

        // Badge Point (Raised stem above marker)
        tempVec.set(mk.position[0], mk.position[1] + 2.2, mk.position[2]);
        tempVec.project(camera);
        const badgeX = ((tempVec.x + 1) * currentWidth) / 2;
        const badgeY = ((-tempVec.y + 1) * currentHeight) / 2;

        const pointsSvg = screenCorners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

        return {
          id: mk.id,
          name: mk.name,
          type: mk.type,
          color: mk.color,
          visible: isVis && centerInFront,
          pointsSvg,
          badgeX,
          badgeY,
          anchorX,
          anchorY,
          iconType: mk.iconType,
          zDist: tempVec.z,
        };
      };


      // 1. System Analysis Markings (isSystem === true)
      // Sourced from backend AI annotations or default system assessment markings.
      const allSystemMarkings: CustomMarking[] = [
        ...platformMarkingsRef.current,
        ...m.filter((mk) => mk.isSystem),
      ];
      const systemMap = new Map<string, CustomMarking>();
      allSystemMarkings.forEach((sm) => systemMap.set(sm.id, sm));
      const systemMarkings = Array.from(systemMap.values());

      const platformProjected: ProjectedBox[] = systemMarkings.map((mk) => {
        // Build all identifier signals — use every available field for maximum match coverage
        const annType = (mk.annotationType || '').toLowerCase();
        const cat     = (mk.category     || '').toLowerCase();
        const mkType  = (mk.type         || '').toLowerCase();
        const name    = (mk.name         || '').toLowerCase();

        const isHuman = annType.includes('people') || annType.includes('person') || annType.includes('human') ||
          cat === 'humans' || mkType.includes('human') ||
          name.includes('person') || name.includes('personnel') || name.includes('human') || name.includes('people');

        const isVehicle = annType.includes('vehicle') || annType.includes('car') || annType.includes('truck') ||
          cat === 'vehicles' || mkType.includes('vehicle') ||
          name.includes('vehicle') || name.includes('car') || name.includes('truck');

        const isFire = annType.includes('fire') || annType.includes('smoke') || annType.includes('hazard') ||
          cat === 'firesmoke' || mkType === 'hazard' ||
          name.includes('fire') || name.includes('smoke') || name.includes('flame') || name.includes('hazard');

        const isDamage = annType.includes('damage') || annType.includes('rubble') ||
          cat === 'damage' || mkType === 'damage' ||
          name.includes('damage') || name.includes('rubble') || name.includes('collapse') || name.includes('crack');

        const isEntry = annType.includes('entry') || annType.includes('exit') || annType.includes('checkpoint') ||
          cat === 'entryexit' || mkType === 'entry point' ||
          name.includes('entry') || name.includes('exit') || name.includes('docheck') || name.includes('checkpoint');

        let isVis: boolean;
        if (isHuman)        isVis = f.humans;
        else if (isVehicle) isVis = f.vehicles;
        else if (isFire)    isVis = f.fireSmoke;
        else if (isDamage)  isVis = f.damage;
        else if (isEntry)   isVis = f.entryExit;
        else                isVis = true; // unclassified system markings always visible

        // Per-entity override: individual toggle can hide within an ON category
        if (isVis && f.platformMarkingToggles && mk.id in f.platformMarkingToggles) {
          isVis = f.platformMarkingToggles[mk.id] !== false;
        }

        return projectMarking(mk, isVis);
      });

      // 2. User-Created Custom Markings (isSystem === false)
      // Controlled exclusively by customMarkingsMaster and individual custom toggles.
      const isCustomMasterOn = customMarkingsMasterRef.current !== false;
      const customMarkings: CustomMarking[] = m.filter((mk) => !mk.isSystem);

      const userProjected: ProjectedBox[] = customMarkings.map((mk) => {
        const isIndividuallyVis = mk.visible !== false && f.customMarkings[mk.name] !== false;
        const isVis = isCustomMasterOn && isIndividuallyVis;
        return projectMarking(mk, isVis);
      });

      setProjectedBoxes([...platformProjected, ...userProjected]);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      ghostMarkerRef.current = null;
      ghostRingRef.current = null;
      ghostStemRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← EMPTY DEPS: scene is built once; filters & markings are read via refs

  // ── Load Real GLB 3D Reconstruction Model from Backend ────────────────────
  useEffect(() => {
    const realGroup = realModelGroupRef.current;
    const rootGroup = rootModelGroupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!realGroup || !camera || !controls) return;

    // Clear previous real model when incident changes
    while (realGroup.children.length > 0) {
      realGroup.remove(realGroup.children[0]);
    }
    isRealModelLoadedRef.current = false;

    let active = true;

    // Determine target model URL: explicit prop or standard backend path
    const resolvedUrl = modelUrl || (incidentId ? `http://localhost:8000/storage/models/${incidentId}.glb` : null);

    if (!resolvedUrl) {
      // No GLB available — always keep the procedural bridge visualization visible.
      // Never blank the viewer just because no real reconstruction exists yet.
      if (rootGroup) rootGroup.visible = true;
      setModelStatus('loaded');
      return;
    }

    setModelStatus('loading');

    const loader = new GLTFLoader();
    loader.load(
      resolvedUrl,
      (gltf) => {
        if (!active) return;
        // Hide demo bridge now that real model is loaded
        if (rootGroup) rootGroup.visible = false;

        const model = gltf.scene;
        realGroup.add(model);
        isRealModelLoadedRef.current = true;

        // Enhance materials & ensure point clouds / meshes are sharp and visible
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            if (m.material) {
              if (Array.isArray(m.material)) {
                m.material.forEach((mat) => { mat.side = THREE.DoubleSide; });
              } else {
                m.material.side = THREE.DoubleSide;
              }
            }
          } else if ((child as THREE.Points).isPoints) {
            const pts = child as THREE.Points;
            if (pts.material && (pts.material as THREE.PointsMaterial).size < 0.05) {
              (pts.material as THREE.PointsMaterial).size = 0.15;
            }
          }
        });

        // Center model at origin & auto-fit camera based on bounding box
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z, 5);
        const fov = camera.fov * (Math.PI / 180);
        const cameraDist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;

        camera.position.set(cameraDist * 0.7, cameraDist * 0.5, cameraDist * 0.8);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.maxDistance = Math.max(65, cameraDist * 4);
        controls.update();

        setModelStatus('loaded');
      },
      undefined,
      () => {
        if (!active) return;
        // GLB failed to load — always fall back to the procedural bridge visualization.
        // Never blank the viewer just because the backend model is unavailable.
        if (rootGroup) rootGroup.visible = true;
        setModelStatus('loaded');
      }
    );

    return () => {
      active = false;
    };
  }, [modelUrl, incidentId]);


  // ── 3D ENTITY MARKER PINS — rebuild whenever data or filters change ─────────
  // These are physical Three.js objects placed at each detection's 3D position.
  // They move/rotate with the camera as you orbit, giving true spatial context.
  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return;

    // Clear all previous pins
    while (group.children.length > 0) {
      const child = group.children[0];
      // Dispose geometries + materials to avoid GPU leaks
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach(mt => mt.dispose());
          else if (m.material) (m.material as THREE.Material).dispose();
        }
      });
      group.remove(child);
    }

    // Helper: determine if a system/platform marking is visible under current filters
    const isPlatformVisible = (mk: CustomMarking): boolean => {
      const f = filters;
      const annType = (mk.annotationType || mk.type || '').toLowerCase();
      const cat  = (mk.category || '').toLowerCase();
      const name = (mk.name || '').toLowerCase();

      // Per-entity override check first
      if (f.platformMarkingToggles && mk.id in f.platformMarkingToggles) {
        if (f.platformMarkingToggles[mk.id] === false) return false;
      }

      if (annType === 'peoples' || annType === 'person' || annType === 'human' ||
          cat === 'humans' || cat === 'peoples' ||
          name.includes('person') || name.includes('personnel') || name.includes('human'))
        return f.humans;

      if (annType === 'vehicles' || annType === 'vehicle' || annType === 'car' || annType === 'truck' ||
          cat === 'vehicles' || name.includes('vehicle') || name.includes('car') || name.includes('truck'))
        return f.vehicles;

      if (annType === 'fire' || annType === 'smoke' || annType === 'hazard' ||
          cat === 'firesmoke' || cat === 'fire' || cat === 'smoke' ||
          name.includes('fire') || name.includes('smoke'))
        return f.fireSmoke;

      if (annType === 'damage' || cat === 'damage' ||
          name.includes('damage') || name.includes('rubble') || name.includes('collapse'))
        return f.damage;

      if (annType === 'entry/exit points' || annType === 'entry point' || annType === 'exit point' ||
          cat === 'entryexit' || cat === 'entry' || cat === 'exit' ||
          name.includes('entry') || name.includes('exit') || name.includes('docheck') || name.includes('checkpoint'))
        return f.entryExit;

      return true; // fallback: show if not categorised
    };

    // Helper: build one 3D pin marker at the given world position
    const buildPin = (
      pos: [number, number, number],
      hexColor: string,
      isSystem: boolean,
      isFire: boolean,
    ) => {
      const color = new THREE.Color(hexColor);
      const pinGroup = new THREE.Group();
      pinGroup.position.set(pos[0], pos[1], pos[2]);

      const STEM_HEIGHT = isSystem ? 1.8 : 1.4;
      const SPHERE_R    = isSystem ? 0.22 : 0.18;

      // ── Vertical stem ──────────────────────────────────────────────────────
      const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, STEM_HEIGHT, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = STEM_HEIGHT / 2;
      pinGroup.add(stem);

      // ── Sphere head ────────────────────────────────────────────────────────
      const sphereGeo = new THREE.SphereGeometry(SPHERE_R, 14, 14);
      const sphereMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: isFire ? 1.4 : 0.6,
        roughness: 0.2,
        metalness: 0.5,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.y = STEM_HEIGHT + SPHERE_R;
      pinGroup.add(sphere);

      // ── Ground ring ────────────────────────────────────────────────────────
      const ringGeo = new THREE.RingGeometry(0.3, 0.55, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      pinGroup.add(ring);

      // ── Outer glow ring (larger, more transparent) ─────────────────────────
      const glowRingGeo = new THREE.RingGeometry(0.55, 0.85, 24);
      const glowRingMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      });
      const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = 0.01;
      pinGroup.add(glowRing);

      // ── Fire entities get an extra point-light glow ────────────────────────
      if (isFire) {
        const ptLight = new THREE.PointLight(color, 3.0, 5);
        ptLight.position.y = STEM_HEIGHT + SPHERE_R;
        pinGroup.add(ptLight);
      }

      group.add(pinGroup);
    };

    // ── 1. Platform / system markings ─────────────────────────────────────────
    const allPlatform = [...platformMarkings, ...markings.filter(m => m.isSystem)];
    // Deduplicate by id
    const platformMap = new Map<string, CustomMarking>();
    allPlatform.forEach(m => platformMap.set(m.id, m));

    platformMap.forEach((mk) => {
      if (!isPlatformVisible(mk)) return;
      const isFire = (mk.category === 'fireSmoke') ||
        (mk.annotationType || '').toLowerCase().includes('fire') ||
        (mk.name || '').toLowerCase().includes('fire');
      buildPin(mk.position, mk.color, true, isFire);
    });

    // ── 2. User custom markings ────────────────────────────────────────────────
    if (customMarkingsMaster) {
      markings.filter(m => !m.isSystem).forEach((mk) => {
        const indivOn = filters.customMarkings[mk.name] !== false && mk.visible !== false;
        if (!indivOn) return;
        buildPin(mk.position, mk.color, false, false);
      });
    }

  }, [platformMarkings, markings, filters, customMarkingsMaster]);


  const getMarkerIcon = (type?: string, name?: string) => {
    const t = (type || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (t === 'fire' || n.includes('fire')) return <Flame className="w-3.5 h-3.5 text-white" />;
    if (t === 'smoke' || n.includes('smoke')) return <Flame className="w-3.5 h-3.5 text-white" />;
    if (t === 'damage' || n.includes('damage') || n.includes('rubble') || n.includes('collapse')) return <AlertTriangle className="w-3.5 h-3.5 text-white" />;
    if (t === 'shelter' || n.includes('shelter')) return <Home className="w-3.5 h-3.5 text-white" />;
    if (t === 'mountain' || n.includes('mountain')) return <MountainIcon className="w-3.5 h-3.5 text-white" />;
    if (t === 'water' || n.includes('water')) return <Droplets className="w-3.5 h-3.5 text-white" />;
    if (t === 'boat' || n.includes('boat')) return <Anchor className="w-3.5 h-3.5 text-white" />;
    if (t === 'entry/exit points' || t === 'entry point' || n.includes('entry') || n.includes('exit')) return <ArrowRight className="w-3.5 h-3.5 text-white" />;
    if (t === 'peoples' || t === 'humans' || n.includes('person') || n.includes('personnel') || n.includes('people')) return <Users className="w-3.5 h-3.5 text-white" />;
    if (t === 'vehicles' || n.includes('vehicle') || n.includes('car') || n.includes('truck')) return <MapPin className="w-3.5 h-3.5 text-white" />;
    return <MapPin className="w-3.5 h-3.5 text-white" />;
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative select-none overflow-hidden rounded-xl border shadow-[0_0_40px_rgba(0,180,255,0.08)] bg-[#020713] ${
        placementMode
          ? 'border-amber-400/70 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
          : 'border-[#0e2247]/80'
      }`}
    >
      {/* Three.js Canvas Mount */}
      <div
        ref={mountRef}
        className={`w-full h-full ${
          placementMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
        title={placementMode ? 'Click to place marking' : 'Click & Drag to Rotate 360° | Scroll to Zoom'}
      />

      {/* ── Placement Mode Overlay Banner ────────────────────────────────── */}
      {placementMode && (
        <>
          {/* Top banner */}
          <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="mt-3 px-4 py-2 rounded-xl bg-amber-500/15 backdrop-blur-md border border-amber-400/50 shadow-[0_4px_24px_rgba(245,158,11,0.25)] flex items-center gap-3 pointer-events-auto animate-pulse">
              <MousePointerClick className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 tracking-wide">
                Click on the 3D scene to place your marking
              </span>
              <button
                type="button"
                onClick={() => onCancelPlacement?.()}
                className="ml-2 p-1 rounded-md hover:bg-amber-400/20 text-amber-400 hover:text-white transition-colors"
                title="Cancel placement (ESC)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Ghost screen label */}
          {ghostScreenPos && (
            <div
              className="absolute z-30 pointer-events-none transform -translate-x-1/2"
              style={{ left: `${ghostScreenPos.x}px`, top: `${ghostScreenPos.y - 40}px` }}
            >
              <div
                className="px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap shadow-lg border"
                style={{
                  backgroundColor: 'rgba(5, 12, 28, 0.92)',
                  borderColor: pendingColor,
                  color: pendingColor,
                  boxShadow: `0 0 12px ${pendingColor}44`,
                }}
              >
                Click to place here
              </div>
            </div>
          )}

          {/* Dim overlay edges for focus effect */}
          <div className="absolute inset-0 pointer-events-none z-[5] rounded-xl"
            style={{
              boxShadow: 'inset 0 0 80px 30px rgba(0,0,0,0.35)',
            }}
          />
        </>
      )}

      {/* SVG Layer: Dotted-Line Bounding Boxes & Connection Stems */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
        <defs>
          <filter id="glow-box" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {projectedBoxes.map((box) => {
          if (!box.visible) return null;
          return (
            <g key={box.id}>
              {/* Perspective Dotted Bounding Box on Ground / Bridge Deck */}
              <polygon
                points={box.pointsSvg}
                fill={box.color}
                fillOpacity="0.2"
                stroke={box.color}
                strokeWidth="2.0"
                strokeDasharray="6,4"
                filter="url(#glow-box)"
              />

              {/* Vertical Anchor Stem rising from box center to badge */}
              <line
                x1={box.anchorX}
                y1={box.anchorY}
                x2={box.badgeX}
                y2={box.badgeY}
                stroke={box.color}
                strokeWidth="1.8"
                strokeOpacity="0.9"
              />

              {/* Glowing anchor dot at base of stem */}
              <circle
                cx={box.anchorX}
                cy={box.anchorY}
                r="3"
                fill={box.color}
                stroke="#020713"
                strokeWidth="1.5"
              />
            </g>
          );
        })}
      </svg>

      {/* HTML Layer: Floating 3D Spatial Callout Badges */}
      {filters.labels && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {projectedBoxes.map((box) => {
            if (!box.visible) return null;
            return (
              <div
                key={box.id}
                className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-auto transition-transform duration-75"
                style={{ left: `${box.badgeX}px`, top: `${box.badgeY}px` }}
              >
                {/* Callout Pill Badge */}
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md border animate-float"
                  style={{
                    backgroundColor: 'rgba(5, 12, 28, 0.94)',
                    borderColor: box.color,
                    boxShadow: `0 0 16px -2px ${box.color}55`,
                  }}
                >
                  {/* Colored Icon Square Badge */}
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: box.color }}
                  >
                    {getMarkerIcon(box.iconType, box.name)}
                  </div>
                  <span className="whitespace-nowrap tracking-wide text-white text-[11px] sm:text-xs">
                    {box.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Status HUD: Real Reconstruction Loading or Empty State ────── */}
      {modelStatus === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050811]/60 backdrop-blur-sm pointer-events-none z-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
          <p className="text-xs font-semibold text-cyan-300 tracking-wide">Loading 3D Photogrammetry Model…</p>
        </div>
      )}

      {/* Small non-blocking status badge when real GLB is loading */}

      {/* Camera-Coupled Compass Rose (Top-Right) */}
      <div className="absolute top-3 right-3 pointer-events-none select-none z-30">
        <div className="relative w-14 h-14 rounded-full bg-[#050e24]/95 border border-cyan-500/50 shadow-[0_0_20px_rgba(0,210,255,0.3)] flex items-center justify-center backdrop-blur-md">
          <span className="absolute top-1 text-[9px] font-extrabold text-cyan-400">N</span>
          <span className="absolute bottom-1 text-[9px] font-extrabold text-slate-400">S</span>
          <span className="absolute right-1 text-[9px] font-extrabold text-slate-400">E</span>
          <span className="absolute left-1 text-[9px] font-extrabold text-slate-400">W</span>

          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75"
            style={{ transform: `rotate(${-compassAngle}deg)` }}
          >
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[15px] border-b-rose-500 absolute top-2" />
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[15px] border-t-slate-300 absolute bottom-2" />
            <div className="w-2 h-2 rounded-full bg-cyan-400 border border-white z-10 shadow-[0_0_6px_#00d2ff]" />
          </div>
        </div>
      </div>

      {/* Viewport Overlay Controls (Left Toolbar) */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30">
        {/* Recenter */}
        <button
          type="button"
          onClick={() => {
            if (controlsRef.current && cameraRef.current) {
              controlsRef.current.target.set(0.5, 0.8, 0.5);
              cameraRef.current.position.set(17.5, 14.5, 21.0);
              controlsRef.current.update();
            }
          }}
          className="w-8 h-8 rounded-lg bg-[#071126]/90 hover:bg-[#0c1e42] border border-[#142954] hover:border-cyan-400 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-all shadow-lg cursor-pointer"
          title="Recenter View"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => {
            if (controlsRef.current && cameraRef.current) {
              const cam = cameraRef.current;
              const dir = new THREE.Vector3().subVectors(cam.position, controlsRef.current.target).multiplyScalar(0.82);
              cam.position.copy(controlsRef.current.target).add(dir);
              controlsRef.current.update();
            }
          }}
          className="w-8 h-8 rounded-lg bg-[#071126]/90 hover:bg-[#0c1e42] border border-[#142954] hover:border-cyan-400 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-all shadow-lg cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => {
            if (controlsRef.current && cameraRef.current) {
              const cam = cameraRef.current;
              const dir = new THREE.Vector3().subVectors(cam.position, controlsRef.current.target).multiplyScalar(1.22);
              cam.position.copy(controlsRef.current.target).add(dir);
              controlsRef.current.update();
            }
          }}
          className="w-8 h-8 rounded-lg bg-[#071126]/90 hover:bg-[#0c1e42] border border-[#142954] hover:border-cyan-400 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-all shadow-lg cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Compass / Orientation Reset */}
        <button
          type="button"
          onClick={() => {
            if (controlsRef.current && cameraRef.current) {
              controlsRef.current.target.set(0.5, 0.8, 0.5);
              cameraRef.current.position.set(0, 16, 26);
              controlsRef.current.update();
            }
          }}
          className="w-8 h-8 rounded-lg bg-[#071126]/90 hover:bg-[#0c1e42] border border-[#142954] hover:border-cyan-400 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-all shadow-lg cursor-pointer"
          title="North Orientation View"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Toggle Fullscreen */}
        <button
          type="button"
          onClick={() => {
            if (containerRef.current) {
              if (!document.fullscreenElement) {
                containerRef.current.requestFullscreen?.();
              } else {
                document.exitFullscreen?.();
              }
            }
          }}
          className="w-8 h-8 rounded-lg bg-[#071126]/90 hover:bg-[#0c1e42] border border-[#142954] hover:border-cyan-400 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-all shadow-lg cursor-pointer"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
