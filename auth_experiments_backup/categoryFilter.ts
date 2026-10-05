/**
 * AeroMesh Strict Category Whitelist & Filter Pipeline
 * 
 * ONLY these 7 categories are allowed for default platform markings:
 * 1. 3D Reconstruction
 * 2. Entry/Exit Points
 * 3. Peoples
 * 4. Vehicles
 * 5. Fire
 * 6. Smoke
 * 7. Damage
 * 
 * Raw AI detections -> Validate/Classify -> Allowed Category Filter -> AeroMesh Marking Data -> Frontend Renderer
 */

export const ALLOWED_DEFAULT_CATEGORIES = [
  '3D Reconstruction',
  'Entry/Exit Points',
  'Peoples',
  'Vehicles',
  'Fire',
  'Smoke',
  'Damage',
] as const;

export type AllowedCategory = (typeof ALLOWED_DEFAULT_CATEGORIES)[number];

export function isAllowedCategory(category: string): category is AllowedCategory {
  return (ALLOWED_DEFAULT_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Validates and maps raw AI detections/labels to one of the 7 allowed categories.
 * Returns null if the detection does NOT clearly belong to an allowed category.
 * 
 * Strict rules:
 * - Roads, trees, normal buildings, walls, debris, random objects -> ignored (returns null).
 * - Normal buildings or structures must NOT be classified as Damage.
 * - Only verified structural damage/collapse maps to 'Damage'.
 */
export function mapAiDetectionToCategory(rawClassOrLabel: string): AllowedCategory | null {
  if (!rawClassOrLabel) return null;
  const label = rawClassOrLabel.toLowerCase().trim();

  // Explicitly ignore irrelevant/environmental objects
  const ignoredObjects = [
    'building', 'wall', 'road', 'street', 'tree', 'vegetation',
    'plant', 'sky', 'ground', 'debris', 'rubble', 'pavement',
    'mountain', 'boat', 'water', 'river', 'lake', 'sea',
    'chair', 'table', 'bench', 'traffic light', 'pole', 'sign',
    'fence', 'barrier', 'window', 'door', 'roof'
  ];
  
  // If it's a normal building/wall without damage, ignore it
  if (ignoredObjects.includes(label)) {
    return null;
  }

  // 1. Peoples: Person / human / victim
  if (
    label === 'person' ||
    label === 'peoples' ||
    label === 'people' ||
    label === 'human' ||
    label === 'victim' ||
    label === 'pedestrian' ||
    label === 'responder'
  ) {
    return 'Peoples';
  }

  // 2. Vehicles: Car / truck / bus / bike / other valid vehicle
  if (
    label === 'vehicle' ||
    label === 'vehicles' ||
    label === 'car' ||
    label === 'truck' ||
    label === 'bus' ||
    label === 'motorcycle' ||
    label === 'motorbike' ||
    label === 'bicycle' ||
    label === 'van' ||
    label === 'pickup'
  ) {
    return 'Vehicles';
  }

  // 3. Fire: Fire / flame
  if (
    label === 'fire' ||
    label === 'flame' ||
    label === 'blaze' ||
    label === 'fire incident' ||
    label === 'active fire'
  ) {
    return 'Fire';
  }

  // 4. Smoke: Smoke / smoke cloud / plume
  if (
    label === 'smoke' ||
    label === 'smoke cloud' ||
    label === 'smoke plume' ||
    label === 'heavy smoke'
  ) {
    return 'Smoke';
  }

  // 5. Damage: Actual structural damage / collapse
  if (
    label === 'damage' ||
    label === 'structural damage' ||
    label === 'collapse' ||
    label === 'collapsed structure' ||
    label === 'destroyed structure'
  ) {
    return 'Damage';
  }

  // 6. Entry/Exit Points: Valid entrance or exit detection
  if (
    label === 'entry' ||
    label === 'exit' ||
    label === 'entry point' ||
    label === 'exit point' ||
    label === 'entry/exit' ||
    label === 'entry/exit points' ||
    label === 'entry/exit point'
  ) {
    return 'Entry/Exit Points';
  }

  // 7. 3D Reconstruction: Generated 3D model only
  if (
    label === '3d reconstruction' ||
    label === 'reconstruction' ||
    label === '3d model'
  ) {
    return '3D Reconstruction';
  }

  return null;
}

/**
 * Filter an array of default markings to ONLY those belonging to the 7 allowed categories.
 * User-created custom markings (isSystem !== true) are preserved as-is.
 */
export function filterAllowedMarkings<T extends { type: string; isSystem?: boolean }>(
  markings: T[]
): T[] {
  return markings.filter((m) => {
    // User-created markings are preserved separately
    if (!m.isSystem) return true;

    // Default system markings must belong to one of the 7 allowed categories
    return isAllowedCategory(m.type);
  });
}
