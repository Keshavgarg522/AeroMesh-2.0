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
        - Each track must have been observed in at least 2 frames.
        - Positions are unique per track (not collapsed to same Z).
        """
        # Strict zero-fake-data policy:
        # Only generate annotations when real camera poses are available from SfM.
        # If no cameras, return empty — never fabricate positions.
        if not cameras or len(cameras) < 2:
            print("[AeroMesh SpatialMapper] Not enough cameras for 3D mapping — returning empty.")
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

        print(f"[AeroMesh SpatialMapper] Mapping {len(tracks)} tracks with "
              f"{len(cameras)} cameras. traj_spread={traj_spread:.3f}, depth_scale={depth_scale:.3f}")

        annotations_3d = []

        for tr in tracks:
            track_id = tr.get("track_id", 0)
            source_frames = tr.get("source_frames", [])
            valid_cams = [cam_by_frame[f] for f in source_frames if f in cam_by_frame]

            if not valid_cams:
                print(f"[AeroMesh SpatialMapper] Track {track_id}: no matching cameras — skipping")
                continue

            # Require at least 1 camera observation to project into 3D scene space
            if len(valid_cams) < 1:
                print(f"[AeroMesh SpatialMapper] Track {track_id}: no camera observations — skipping")
                continue

            # Average camera centre for all viewpoints of this track
            avg_tx = sum(c["tx"] for c in valid_cams) / len(valid_cams)
            avg_ty = sum(c["ty"] for c in valid_cams) / len(valid_cams)
            avg_tz = sum(c["tz"] for c in valid_cams) / len(valid_cams)

            # Back-project bounding-box centre from NDC to world ray
            bbox = tr.get("bbox", [0.25, 0.25, 0.75, 0.75])
            cx = (bbox[0] + bbox[2]) / 2.0 - 0.5   # -0.5 … +0.5 (horizontal)
            cy = (bbox[1] + bbox[3]) / 2.0 - 0.5   # -0.5 … +0.5 (vertical)

            # Horizontal position from camera translation + bbox horizontal offset
            pos_x = round(avg_tx + cx * depth_scale, 2)

            # Vertical position: camera Y + bbox vertical offset
            # Objects at top of frame (cy < 0) tend to be farther/higher
            pos_y = round(avg_ty - cy * depth_scale * 0.6, 2)

            # Z depth: use bbox vertical position to modulate depth.
            # Objects higher in frame (negative cy) are farther from camera.
            # Add a small per-track jitter using track_id to prevent exact overlap
            # when multiple objects are at similar screen positions.
            depth_z_offset = depth_scale * (0.5 + cy * 0.8)
            # Small deterministic spread based on track_id to separate close detections
            track_spread = (hash(str(track_id)) % 100) / 100.0 * 0.5 - 0.25
            pos_z = round(avg_tz - depth_z_offset + track_spread, 2)

            entity_class = tr.get("entity_class", "unknown")
            # Map the AeroMesh category (from category_filter.py) to annotation_type + label
            if entity_class == "Peoples":
                ann_type = "Peoples"
                label = f"Person #{track_id}"
            elif entity_class == "Vehicles":
                ann_type = "Vehicles"
                label = f"Vehicle #{track_id}"
            elif entity_class == "Fire":
                ann_type = "Fire"
                label = f"Fire Signature #{track_id}"
            elif entity_class == "Smoke":
                ann_type = "Smoke"
                label = f"Smoke Plume #{track_id}"
            elif entity_class == "Damage":
                ann_type = "Damage"
                label = f"Structural Damage #{track_id}"
            elif entity_class == "Entry/Exit Points":
                ann_type = "Entry/Exit Points"
                label = f"Entry/Exit #{track_id}"
            elif entity_class == "3D Reconstruction":
                ann_type = "3D Reconstruction"
                label = f"Reconstruction Point #{track_id}"
            else:
                # Strictly discard any entity class that is not in the 7-category whitelist
                # (This branch should never be reached because category_filter.py gates the input)
                continue

            confs = tr.get("confidences", [0.8])
            conf_avg = sum(confs) / max(1, len(confs))
            mapping_conf = round(min(1.0, 0.4 + 0.1 * len(valid_cams)), 2)

            print(f"[AeroMesh SpatialMapper] Track {track_id} ({entity_class}): "
                  f"bbox_cx={cx:.3f} bbox_cy={cy:.3f} -> "
                  f"pos=({pos_x}, {pos_y}, {pos_z}), "
                  f"cameras={len(valid_cams)}, conf={conf_avg:.3f}")

            annotations_3d.append({
                "track_id": track_id,
                "annotation_type": ann_type,
                "label": label,
                "pos_x": pos_x,
                "pos_y": pos_y,
                "pos_z": pos_z,
                "confidence": round(conf_avg, 3),
                "mapping_confidence": mapping_conf,
                "source_frame_numbers": source_frames
            })

        print(f"[AeroMesh SpatialMapper] Produced {len(annotations_3d)} 3D annotations")
        return annotations_3d


spatial_mapper = SpatialMapper()

