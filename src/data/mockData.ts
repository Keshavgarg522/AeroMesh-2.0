import type { Incident, CustomMarking, FilterState, IncidentStats } from '../types';

export const initialIncident: Incident = {
  id: 'AM-20250908-001',
  name: 'Bridge Structural Assessment',
  location: 'Sector 62, Noida, Uttar Pradesh',
  description: 'Bridge superstructure assessment and damage analysis using aerial drone footage.',
  date: '2025-09-08',
  time: '10:24 AM',
  status: 'Analysis Completed',
  thumbnailUrl: '/assets/drone_bridge_aerial.jpg',
  videoName: 'drone_bridge_survey.mp4',
  videoSize: '2.1 MB',
  videoObjectUrl: '/assets/drone_sample.mp4',
  videoDuration: '00:15',
  videoResolution: '1920 × 1080',
  videoFps: 12,
  stats: {
    totalPeople: 48,
    peopleDelta: 3,
    totalVehicles: 24,
    vehiclesDelta: 2,
    fireIncidents: {
      major: 1,
      minor: 1,
      hazardous: 1,
    },
    entryExitPoints: {
      total: 4,
      entry: 2,
      exit: 2,
    },
    damagedAreas: {
      total: 2,
      details: 'Bridge Section + Road',
    },
  },
  detectedConditions: {
    structuralDamage: true,
    fire: true,
    smoke: true,
    humanPresence: true,
    vehiclePresence: true,
    entryExit: true,
  },
  overallCondition: {
    level: 'CRITICAL',
    title: 'CRITICAL - Immediate attention recommended',
    description: 'The analysed scene indicates significant structural damage with active fire activity and multiple detected entities. The affected area should be inspected and secured immediately.',
  },
  keyObservations: [
    'Structural damage detected on the bridge section.',
    'Active fire detected near the roadway.',
    'Multiple vehicles identified in the affected zone.',
    'Human presence detected within the incident area.',
    'Multiple entry and exit points identified.',
  ],
};

export const historyIncidents: Incident[] = [
  initialIncident,
  {
    id: 'AM-20250905-002',
    name: 'Urban Building Inspection',
    location: 'Sector 18, Noida',
    description: 'Multi-angle drone thermography and facade structural crack detection.',
    date: '2025-09-05',
    time: '02:45 PM',
    status: 'Processing',
    thumbnailUrl: '/assets/building_exact_clean.png',
    videoName: 'urban_tower_scan.mp4',
    videoSize: '4.8 MB',
    videoObjectUrl: '/assets/drone_sample.mp4',
    videoDuration: '00:24',
    videoResolution: '1920 × 1080',
    videoFps: 24,
    stats: {
      totalPeople: 18,
      peopleDelta: 0,
      totalVehicles: 8,
      vehiclesDelta: 1,
      fireIncidents: { major: 0, minor: 0, hazardous: 0 },
      entryExitPoints: { total: 2, entry: 1, exit: 1 },
      damagedAreas: { total: 1, details: 'South Facade Column' },
    },
    detectedConditions: {
      structuralDamage: true,
      fire: false,
      smoke: false,
      humanPresence: true,
      vehiclePresence: true,
      entryExit: true,
    },
    overallCondition: {
      level: 'MODERATE',
      title: 'PROCESSING - Active Point Cloud Reconstruction',
      description: 'Neural photogrammetry pipeline currently processing 142 drone keyframes. Preliminary facade cracks isolated on upper levels.',
    },
    keyObservations: [
      'Processing 142 high-resolution drone keyframes.',
      'South facade elevation shows micro-fissure patterns.',
      'Zero active heat signatures or combustion detected.',
      'Controlled safety perimeter maintained at street level.',
    ],
  },
  {
    id: 'AM-20250901-003',
    name: 'Highway Damage Survey',
    location: 'NH-48, Haryana',
    description: 'Asphalt pavement integrity scan and vehicle collision reconstruction.',
    date: '2025-09-01',
    time: '11:18 AM',
    status: 'Failed',
    thumbnailUrl: '/assets/night_aerial_city.jpg',
    videoName: 'nh48_flyover.mp4',
    videoSize: '1.2 MB',
    videoObjectUrl: '/assets/drone_sample.mp4',
    videoDuration: '00:10',
    videoResolution: '1280 × 720',
    videoFps: 15,
    stats: {
      totalPeople: 0,
      peopleDelta: 0,
      totalVehicles: 15,
      vehiclesDelta: 0,
      fireIncidents: { major: 0, minor: 0, hazardous: 0 },
      entryExitPoints: { total: 0, entry: 0, exit: 0 },
      damagedAreas: { total: 3, details: 'Median Barrier + Lane 2' },
    },
    detectedConditions: {
      structuralDamage: true,
      fire: false,
      smoke: false,
      humanPresence: false,
      vehiclePresence: true,
      entryExit: false,
    },
    overallCondition: {
      level: 'UNKNOWN',
      title: 'FAILED - Telemetry Stream Packet Loss',
      description: 'Severe adverse weather conditions caused drone sensor link degradation during RTK GPS pass. Incomplete photogrammetry capture.',
    },
    keyObservations: [
      'GPS RTK lock lost during 4th survey pass.',
      'Pavement scan incomplete between km 42 and km 44.',
      'Partial vehicle obstacle mapping preserved in cache.',
    ],
  },
  {
    id: 'AM-20250827-004',
    name: 'Industrial Site Analysis',
    location: 'Greater Noida, Uttar Pradesh',
    description: 'Refinery perimeter thermal survey and chemical storage tank inspection.',
    date: '2025-08-27',
    time: '09:32 AM',
    status: 'Analysis Completed',
    thumbnailUrl: '/assets/drone_tech.jpg',
    videoName: 'industrial_complex.mp4',
    videoSize: '3.6 MB',
    videoObjectUrl: '/assets/drone_sample.mp4',
    videoDuration: '00:18',
    videoResolution: '1920 × 1080',
    videoFps: 30,
    stats: {
      totalPeople: 32,
      peopleDelta: 1,
      totalVehicles: 19,
      vehiclesDelta: 3,
      fireIncidents: { major: 0, minor: 1, hazardous: 0 },
      entryExitPoints: { total: 5, entry: 3, exit: 2 },
      damagedAreas: { total: 1, details: 'Cooling Tower Pipeline' },
    },
    detectedConditions: {
      structuralDamage: true,
      fire: true,
      smoke: true,
      humanPresence: true,
      vehiclePresence: true,
      entryExit: true,
    },
    overallCondition: {
      level: 'WARNING',
      title: 'WARNING - Minor Thermal Leak Contained',
      description: 'Secondary exhaust manifold valve exhibiting elevated temperature. Perimeter secure with active personnel clearance verified.',
    },
    keyObservations: [
      'Exhaust manifold thermal anomaly identified at Unit 4.',
      'Perimeter security corridor fully clear.',
      'Personnel evacuation protocol tested successfully.',
      'Cooling infrastructure integrity within operational parameters.',
    ],
  },
];

/**
 * Default custom user markings (isSystem: false).
 * Rescuer/operator annotations for landmarks and temporary facilities.
 */
export const defaultMarkings: CustomMarking[] = [
  {
    id: 'mk-mountain',
    name: 'Mountain',
    type: 'Custom',
    color: '#22c55e',
    description: 'Mountain terrain zone',
    visible: true,
    position: [-12, 2.5, -14],
    iconType: 'mountain',
    isSystem: false,
  },
  {
    id: 'mk-shelter',
    name: 'Shelter Area',
    type: 'Temporary shelter',
    color: '#a855f7',
    description: 'Emergency shelter zone',
    visible: true,
    position: [2.5, 1.6, 1.8],
    iconType: 'shelter',
    isSystem: false,
  },
  {
    id: 'mk-boat',
    name: 'Boat',
    type: 'Custom',
    color: '#06b6d4',
    description: 'Boat / water vessel position',
    visible: true,
    position: [-1.5, -2.5, 4.0],
    iconType: 'boat',
    isSystem: false,
  },
  {
    id: 'mk-water',
    name: 'Water',
    type: 'Custom',
    color: '#3b82f6',
    description: 'Water channel zone',
    visible: true,
    position: [-5.0, -2.5, 4.5],
    iconType: 'water',
    isSystem: false,
  },
];

/**
 * Default system analysis markings (isSystem: true).
 * Pre-analyzed detection overlays for the demo bridge assessment across required categories:
 * - Entry Point / Exit Point
 * - Fire / Smoke
 * - Structural Damage
 * - Person (Humans)
 * - Vehicle (Vehicles)
 */
export const DEFAULT_PLATFORM_MARKINGS: CustomMarking[] = [
  {
    id: 'sys-entry-1',
    name: 'Docheck Point 1',
    type: 'Entry Point',
    color: '#10b981',
    description: 'Primary checkpoint location',
    visible: true,
    position: [-4.2, 1.8, -1.8],
    iconType: 'pin',
    isSystem: true,
    category: 'entryExit',
    annotationType: 'Entry/Exit Points',
  },
  {
    id: 'sys-entry-exit',
    name: 'Entry / Exit',
    type: 'Entry Point',
    color: '#10b981',
    description: 'Entry and exit control point',
    visible: true,
    position: [6.0, 1.6, 3.2],
    iconType: 'pin',
    isSystem: true,
    category: 'entryExit',
    annotationType: 'Entry/Exit Points',
  },
  {
    id: 'sys-fire-major',
    name: 'Fire Major',
    type: 'Hazard',
    color: '#ef4444',
    description: 'Major fire incident zone',
    visible: true,
    position: [-2.0, 2.2, 0.2],
    iconType: 'fire',
    isSystem: true,
    category: 'fireSmoke',
    annotationType: 'Fire',
  },
  {
    id: 'sys-rubble',
    name: 'Rubble Zone',
    type: 'Damage',
    color: '#f97316',
    description: 'Structural rubble and debris area',
    visible: true,
    position: [1.0, 1.8, 1.2],
    iconType: 'warning',
    isSystem: true,
    category: 'damage',
    annotationType: 'Damage',
  },
  {
    id: 'sys-person-1',
    name: 'Response Personnel',
    type: 'Custom',
    color: '#3b82f6',
    description: 'Identified responder on deck',
    visible: true,
    position: [0.5, 1.8, -1.0],
    iconType: 'pin',
    isSystem: true,
    category: 'humans',
    annotationType: 'Peoples',
  },
  {
    id: 'sys-vehicle-1',
    name: 'Vehicle Detection #1',
    type: 'Custom',
    color: '#8b5cf6',
    description: 'Detected vehicle on bridge span',
    visible: true,
    position: [-0.8, 1.8, -0.6],
    iconType: 'pin',
    isSystem: true,
    category: 'vehicles',
    annotationType: 'Vehicles',
  },
];

export const PLATFORM_DETECTION_MARKINGS: CustomMarking[] = DEFAULT_PLATFORM_MARKINGS;

export const defaultFilterState: FilterState = {
  reconstruction3D: true,
  entryExit: true,
  humans: true,
  vehicles: true,
  fireSmoke: true,
  damage: true,
  labels: true,
  customMarkings: {
    'Mountain': true,
    'Shelter Area': true,
    'Boat': true,
    'Water': true,
  },
  platformMarkingToggles: {},
};

/**
 * Zero-state stats used for new/offline incidents that have not been analyzed.
 * NEVER use non-zero hardcoded values here — they are fake.
 */
export const defaultIncidentStats: IncidentStats = {
  totalPeople: 0,
  peopleDelta: 0,
  totalVehicles: 0,
  vehiclesDelta: 0,
  fireIncidents: {
    major: 0,
    minor: 0,
    hazardous: 0
  },
  entryExitPoints: {
    total: 0,
    entry: 0,
    exit: 0
  },
  damagedAreas: {
    total: 0,
    details: 'N/A — No analysis run yet'
  }
};
