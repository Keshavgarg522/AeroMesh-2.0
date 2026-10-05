"""
AeroMesh Strict Category Whitelist and Validation Pipeline

ONLY THESE 7 DEFAULT MARKING CATEGORIES ARE ALLOWED:
1. 3D Reconstruction
2. Entry/Exit Points
3. Peoples
4. Vehicles
5. Fire
6. Smoke
7. Damage

Any other object detection (e.g. roads, trees, normal buildings, walls, debris, random objects)
must be ignored completely and never become a default marking.
"""
from typing import Optional, Set

ALLOWED_DEFAULT_CATEGORIES: Set[str] = {
    "3D Reconstruction",
    "Entry/Exit Points",
    "Peoples",
    "Vehicles",
    "Fire",
    "Smoke",
    "Damage",
}

# Synonyms and mapping for raw AI detection labels
PEOPLES_SYNONYMS = {"person", "people", "peoples", "human", "victim", "pedestrian", "personnel"}
VEHICLE_SYNONYMS = {
    "car", "truck", "bus", "bike", "motorcycle", "bicycle", "vehicle", "vehicles",
    "automobile", "van", "boat", "ship", "train", "vessel", "watercraft", "airplane", "aircraft"
}
FIRE_SYNONYMS = {"fire", "flame", "flames", "blaze", "hazard"}
SMOKE_SYNONYMS = {"smoke", "smoke cloud", "smoke plume", "plume"}
DAMAGE_SYNONYMS = {"damage", "structural damage", "collapse", "structural collapse", "destruction"}
ENTRY_EXIT_SYNONYMS = {"entry/exit", "entry/exit points", "entry point", "exit point", "entrance", "exit", "entry"}
RECONSTRUCTION_SYNONYMS = {"3d reconstruction", "reconstruction", "reconstruction3d"}


def classify_ai_detection(raw_class: Optional[str]) -> Optional[str]:
    """
    Validates and classifies raw AI detection classes into one of the 7 allowed categories.
    If the detection does not clearly belong to one of the 7 categories, returns None (discarded).
    """
    if not raw_class:
        return None

    c = str(raw_class).lower().strip()

    if c in PEOPLES_SYNONYMS:
        return "Peoples"

    if c in VEHICLE_SYNONYMS:
        return "Vehicles"

    if c in FIRE_SYNONYMS:
        return "Fire"

    if c in SMOKE_SYNONYMS:
        return "Smoke"

    if c in DAMAGE_SYNONYMS:
        return "Damage"

    if c in ENTRY_EXIT_SYNONYMS:
        return "Entry/Exit Points"

    if c in RECONSTRUCTION_SYNONYMS:
        return "3D Reconstruction"

    # All other classes (roads, trees, normal buildings, walls, debris, etc.) are strictly rejected
    return None
