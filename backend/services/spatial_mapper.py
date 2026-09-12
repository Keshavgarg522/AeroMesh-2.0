import math
import numpy as np
from typing import List, Dict, Any


class SpatialMapper:
    @staticmethod
    def map_detections_to_3d(
        tracks: List[Dict[str, Any]],
        cameras: List[Dict[str, Any]],
        reconstruction_quality: str
    ) -> List[Dict[str, Any]]:
        """
        Projects 2D tracked entities into estimated 3D world coordinates
        using recovered camera poses from SfM (OpenCV or COLMAP).

        Rules:
        - Requires at least 2 camera poses. Uses zero-fake-data policy:
          if cameras are unavailable, returns empty list.
        - Projects each entity's bounding-box centre along its observed
          camera ray to an estimated depth consistent with the scene scale.
        """
        # User requested complete removal of system detection marking feature.
        # Entity detections remain on 2D video frames, but 3D overlay markings are omitted.
        return []

        # Build frame → camera-pose lookup
        cam_by_frame = {c["frame_number"]: c for c in cameras}

        # Estimate scene scale from camera trajectory spread
        tx_vals = [c["tx"] for c in cameras]
        ty_vals = [c["ty"] for c in cameras]
        tz_vals = [c["tz"] for c in cameras]
        traj_spread = math.sqrt(
            max(1e-6, np.var(tx_vals) + np.var(ty_vals) + np.var(tz_vals))
        )
        # Depth scale: proportional to trajectory spread but bounded
        depth_scale = max(1.5, min(12.0, traj_spread * 0.8))

        annotations_3d = []

        for tr in tracks:
            source_frames = tr.get("source_frames", [])
            valid_cams = [cam_by_frame[f] for f in source_frames if f in cam_by_frame]

            if not valid_cams:
                continue

            # Average camera centre for all viewpoints of this track
            avg_tx = sum(c["tx"] for c in valid_cams) / len(valid_cams)
            avg_ty = sum(c["ty"] for c in valid_cams) / len(valid_cams)
            avg_tz = sum(c["tz"] for c in valid_cams) / len(valid_cams)

            # Back-project bounding-box centre from NDC to world ray
            bbox = tr.get("bbox", [0.25, 0.25, 0.75, 0.75])
            cx = (bbox[0] + bbox[2]) / 2.0 - 0.5   # -0.5 … +0.5
            cy = (bbox[1] + bbox[3]) / 2.0 - 0.5

            pos_x = round(avg_tx + cx * depth_scale, 2)
            pos_y = round(avg_ty - cy * depth_scale, 2)
            pos_z = round(avg_tz - depth_scale, 2)

            entity_class = tr.get("entity_class", "unknown")
            if entity_class == "person":
                ann_type = "Humans"
                label = f"Person #{tr['track_id']}"
            elif entity_class in {"car", "truck", "bus", "motorcycle", "vehicle"}:
                ann_type = "Vehicles"
                label = f"{entity_class.title()} #{tr['track_id']}"
            elif entity_class == "fire":
                ann_type = "Fire & Smoke"
                label = f"Fire Signature #{tr['track_id']}"
            elif entity_class == "smoke":
                ann_type = "Fire & Smoke"
                label = f"Smoke Plume #{tr['track_id']}"
            elif entity_class == "damage":
                ann_type = "Damage"
                label = f"Structural Damage #{tr['track_id']}"
            else:
                ann_type = "Custom"
                label = f"{entity_class.title()} #{tr['track_id']}"

            confs = tr.get("confidences", [0.8])
            conf_avg = sum(confs) / max(1, len(confs))
            mapping_conf = round(min(1.0, 0.4 + 0.1 * len(valid_cams)), 2)

            annotations_3d.append({
                "track_id": tr["track_id"],
                "annotation_type": ann_type,
                "label": label,
                "pos_x": pos_x,
                "pos_y": pos_y,
                "pos_z": pos_z,
                "confidence": round(conf_avg, 3),
                "mapping_confidence": mapping_conf,
                "source_frame_numbers": source_frames
            })

        return annotations_3d


spatial_mapper = SpatialMapper()
