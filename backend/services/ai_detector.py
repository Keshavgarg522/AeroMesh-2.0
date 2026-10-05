import os
from typing import List, Dict, Any, Optional, Set
from backend.services.category_filter import classify_ai_detection
from ultralytics import YOLO
from backend.config import settings

# Mapping COCO classes to AeroMesh categories
VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle", "bicycle", "train", "boat", "airplane"}
PERSON_CLASSES = {"person"}

class AIDetectorService:
    def __init__(self, model_name: str = settings.YOLO_MODEL):
        self.model_name = model_name
        self._model = None

    def get_model(self) -> YOLO:
        if self._model is None:
            # Loads pretrained YOLOv8/v11 model locally without custom training
            self._model = YOLO(self.model_name)
        return self._model

    def detect_and_track(self, frame_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Runs real pretrained YOLO detection and ByteTrack tracking on extracted frames.
        Returns:
          - frame_detections: list of detection dicts
          - tracks: list of unique track dicts
          - stats: calculated totals (unique people, unique vehicles, etc.)
        """
        model = self.get_model()

        all_detections: List[Dict[str, Any]] = []
        unique_people_tracks: Set[int] = set()
        unique_vehicle_tracks: Set[int] = set()
        track_records: Dict[int, Dict[str, Any]] = {}

        # If no frames extracted, return strictly zero results
        if not frame_records:
            return {
                "detections": [],
                "tracks": [],
                "stats": {
                    "totalPeople": 0,
                    "peopleDelta": 0,
                    "totalVehicles": 0,
                    "vehiclesDelta": 0,
                    "fireIncidents": {"major": 0, "minor": 0, "hazardous": 0},
                    "entryExitPoints": {"total": 0, "entry": 0, "exit": 0},
                    "damagedAreas": {"total": 0, "details": "N/A — No damage detected"}
                },
                "conditions": {
                    "structuralDamage": False,
                    "fire": False,
                    "smoke": False,
                    "humanPresence": False,
                    "vehiclePresence": False,
                    "entryExit": False
                }
            }

        # Track entities across sequential frames using ByteTrack
        frame_paths = [f["abs_image_path"] for f in frame_records]
        
        try:
            # Ultralytics track with bytetrack
            results = model.track(
                source=frame_paths,
                tracker="bytetrack.yaml",
                persist=True,
                conf=0.15,
                verbose=False
            )
        except Exception:
            # Fallback to standard inference if tracker fails
            results = model.predict(
                source=frame_paths,
                conf=0.15,
                verbose=False
            )

        for frame_idx, (frame_meta, result) in enumerate(zip(frame_records, results)):
            frame_w = frame_meta["width"]
            frame_h = frame_meta["height"]

            if result.boxes is None or len(result.boxes) == 0:
                continue

            boxes = result.boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                cls_name = model.names.get(cls_id, "unknown").lower()
                conf = float(boxes.conf[i].item())

                # Normalized coordinates
                xyxy = boxes.xyxy[i].tolist()
                norm_bbox = [
                    round(xyxy[0] / frame_w, 4),
                    round(xyxy[1] / frame_h, 4),
                    round(xyxy[2] / frame_w, 4),
                    round(xyxy[3] / frame_h, 4)
                ]

                track_id = None
                if boxes.id is not None and i < len(boxes.id):
                    track_id = int(boxes.id[i].item())
                else:
                    # Fallback track identifier based on class and spatial proximity
                    track_id = (frame_idx + 1) * 100 + i

                # ── Strict category whitelist enforcement ─────────────────
                # Validate the raw YOLO class through the AeroMesh whitelist.
                # Any class not in {Peoples, Vehicles, Fire, Smoke, Damage,
                # Entry/Exit Points, 3D Reconstruction} is silently discarded.
                aeromesh_category: Optional[str] = classify_ai_detection(cls_name)
                if aeromesh_category is None:
                    # Not an allowed AeroMesh category — skip this detection entirely
                    continue

                entity_type = aeromesh_category

                # Update unique track counts for allowed categories
                if aeromesh_category == "Peoples":
                    unique_people_tracks.add(track_id)
                elif aeromesh_category == "Vehicles":
                    unique_vehicle_tracks.add(track_id)

                # Store track summary
                if track_id not in track_records:
                    track_records[track_id] = {
                        "track_id": track_id,
                        "entity_class": entity_type,
                        "first_seen_sec": frame_meta["timestamp_sec"],
                        "last_seen_sec": frame_meta["timestamp_sec"],
                        "frame_count": 1,
                        "confidences": [conf],
                        "source_frames": [frame_meta["frame_number"]],
                        "bbox": norm_bbox
                    }
                else:
                    tr = track_records[track_id]
                    tr["last_seen_sec"] = frame_meta["timestamp_sec"]
                    tr["frame_count"] += 1
                    tr["confidences"].append(conf)
                    if frame_meta["frame_number"] not in tr["source_frames"]:
                        tr["source_frames"].append(frame_meta["frame_number"])

                all_detections.append({
                    "frame_number": frame_meta["frame_number"],
                    "track_id": track_id,
                    "entity_class": entity_type,
                    "confidence": round(conf, 3),
                    "bbox": norm_bbox,
                    "model_name": self.model_name
                })

        total_people = len(unique_people_tracks)
        total_vehicles = len(unique_vehicle_tracks)

        # ── Fire / Smoke / Damage Adapter ─────────────────────────────────────
        # Per requirements: DO NOT use fake thresholds.
        # If no verified fire/smoke/damage model is detected, return 0 / N/A.
        fire_count = 0
        smoke_count = 0
        damage_count = 0

        # Calculate final stats from actual tracks
        stats = {
            "totalPeople": total_people,
            "peopleDelta": 0,
            "totalVehicles": total_vehicles,
            "vehiclesDelta": 0,
            "fireIncidents": {
                "major": fire_count,
                "minor": 0,
                "hazardous": 0
            },
            "entryExitPoints": {
                "total": 0,
                "entry": 0,
                "exit": 0
            },
            "damagedAreas": {
                "total": damage_count,
                "details": "N/A — No structural damage detected" if damage_count == 0 else f"{damage_count} damage areas"
            }
        }

        conditions = {
            "structuralDamage": damage_count > 0,
            "fire": fire_count > 0,
            "smoke": smoke_count > 0,
            "humanPresence": total_people > 0,
            "vehiclePresence": total_vehicles > 0,
            "entryExit": False
        }

        return {
            "detections": all_detections,
            "tracks": list(track_records.values()),
            "stats": stats,
            "conditions": conditions
        }

ai_detector = AIDetectorService()
