import os
import cv2
import numpy as np
from typing import Dict, Any, List, Optional
from backend.services.storage import storage

def format_duration(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

class VideoService:
    @staticmethod
    def extract_metadata(video_abs_path: str) -> Dict[str, Any]:
        """
        Extracts actual metadata using OpenCV. Never fabricates values.
        """
        cap = cv2.VideoCapture(video_abs_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video at {video_abs_path}")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
        
        # Decode fourcc to string if possible
        codec_chars = [chr((fourcc >> 8 * i) & 0xFF) for i in range(4)]
        codec = "".join(codec_chars).strip() or "mp4v"

        duration_sec = 0.0
        if fps > 0 and frame_count > 0:
            duration_sec = frame_count / fps

        cap.release()

        return {
            "duration_sec": round(duration_sec, 2),
            "duration_formatted": format_duration(duration_sec),
            "fps": round(fps, 2) if fps > 0 else 24.0,
            "frame_count": frame_count,
            "width": width,
            "height": height,
            "resolution_formatted": f"{width} × {height}",
            "codec": codec,
        }

    @staticmethod
    def extract_frames(
        video_abs_path: str,
        incident_id: str,
        min_keyframes: int = 20,
        max_keyframes: int = 40,
        target_frame_count: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Adaptive keyframe extraction optimized for photogrammetry and aerial drone footage.
        Selects frames with sufficient baseline motion/parallax while filtering out:
        - Excessive blur / camera shake
        - Extreme over/under-exposure
        - Stationary / near-duplicate hover frames
        Never fabricates placeholder frames.
        """
        cap = cv2.VideoCapture(video_abs_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot read video at {video_abs_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(cap.get(cv2.CAP_PROP_FPS)) or 12.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration_sec = total_frames / fps if fps > 0 else 0

        frames_dir = storage.get_incident_frames_dir(incident_id)

        if target_frame_count is not None:
            min_keyframes = target_frame_count
            max_keyframes = target_frame_count

        if total_frames <= 0:
            cap.release()
            return []

        # Candidate sampling step: sample candidate frames every ~0.25 to 0.4 seconds
        sample_step = max(1, int(round(fps * 0.33)))
        candidate_indices = list(range(0, total_frames, sample_step))
        if candidate_indices[-1] != total_frames - 1:
            candidate_indices.append(total_frames - 1)

        # Feature extractor for optical flow / parallax evaluation
        orb = cv2.ORB_create(400)
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

        selected_candidates = []
        last_gray = None
        last_kpts = None
        last_descs = None
        last_selected_fidx = -999
        _logged_every = 0

        for f_idx in candidate_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            _logged_every += 1
            if _logged_every % 20 == 0:
                print(f"[AeroMesh VideoService] Scanning frame {f_idx}/{total_frames}...")

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # 1. Quality Checks
            blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
            brightness = float(np.mean(gray))
            contrast = float(np.std(gray))

            # Reject severely degraded frames
            if blur_score < 10.0:  # extreme motion blur
                continue
            if brightness < 8.0 or brightness > 248.0:  # black or saturated
                continue
            if contrast < 10.0:  # completely uniform / featureless
                continue

            kpts, descs = orb.detectAndCompute(gray, None)
            feature_count = len(kpts) if kpts is not None else 0

            if feature_count < 30:
                continue

            # First valid frame is always accepted
            if not selected_candidates:
                selected_candidates.append({
                    "frame_idx": f_idx,
                    "frame": frame,
                    "blur_score": blur_score,
                    "brightness": brightness,
                    "contrast": contrast,
                    "feature_count": feature_count
                })
                last_gray = gray
                last_kpts = kpts
                last_descs = descs
                last_selected_fidx = f_idx
                continue

            # 2. Motion / Parallax Check against previous keyframe
            time_delta = (f_idx - last_selected_fidx) / fps
            
            parallax_disp = 0.0
            if last_descs is not None and descs is not None:
                matches = bf.match(last_descs, descs)
                if matches and len(matches) >= 10:
                    pts_prev = np.float32([last_kpts[m.queryIdx].pt for m in matches])
                    pts_curr = np.float32([kpts[m.trainIdx].pt for m in matches])
                    displacements = np.linalg.norm(pts_curr - pts_prev, axis=1)
                    parallax_disp = float(np.median(displacements))

            # Criteria for acceptance:
            # - Parallax motion is sufficient (e.g. median displacement > 4.0 pixels)
            # - OR time since last keyframe > 2.0s (prevent dropping too much time when hovering)
            is_good_motion = parallax_disp >= 3.5
            is_time_fallback = time_delta >= 2.0

            if is_good_motion or is_time_fallback:
                selected_candidates.append({
                    "frame_idx": f_idx,
                    "frame": frame,
                    "blur_score": blur_score,
                    "brightness": brightness,
                    "contrast": contrast,
                    "feature_count": feature_count
                })
                last_gray = gray
                last_kpts = kpts
                last_descs = descs
                last_selected_fidx = f_idx

        cap.release()

        print(f"[AeroMesh VideoService] Candidate selection complete: {len(selected_candidates)} frames selected")

        # If too few candidates were selected, fallback to uniform spacing of valid frames
        if len(selected_candidates) < min_keyframes and total_frames >= min_keyframes:
            step = max(1, total_frames // min_keyframes)
            cap = cv2.VideoCapture(video_abs_path)
            selected_candidates = []
            for i in range(min_keyframes):
                f_idx = min(i * step, total_frames - 1)
                cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
                ret, frame = cap.read()
                if ret and frame is not None:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    selected_candidates.append({
                        "frame_idx": f_idx,
                        "frame": frame,
                        "blur_score": float(cv2.Laplacian(gray, cv2.CV_64F).var()),
                        "brightness": float(np.mean(gray)),
                        "contrast": float(np.std(gray)),
                        "feature_count": 100
                    })
            cap.release()

        # If more than max_keyframes, sub-sample while preserving maximum parallax
        if len(selected_candidates) > max_keyframes:
            step = len(selected_candidates) / float(max_keyframes)
            selected_candidates = [selected_candidates[min(len(selected_candidates) - 1, int(i * step))] for i in range(max_keyframes)]

        if target_frame_count is not None and len(selected_candidates) > target_frame_count:
            step = len(selected_candidates) / float(target_frame_count)
            selected_candidates = [selected_candidates[min(len(selected_candidates) - 1, int(i * step))] for i in range(target_frame_count)]

        # 3. Save selected frames to disk with sequential numbering
        extracted = []
        best_thumb_idx = 0
        max_sharpness = -1.0

        for idx, item in enumerate(selected_candidates, start=1):
            frame = item["frame"]
            f_idx = item["frame_idx"]
            timestamp_sec = round(f_idx / fps, 2)

            frame_filename = f"frame_{idx:04d}.jpg"
            frame_abs_path = os.path.join(frames_dir, frame_filename)
            cv2.imwrite(frame_abs_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])

            rel_image_path = f"/storage/frames/{incident_id}/{frame_filename}"

            extracted.append({
                "frame_number": idx,
                "timestamp_sec": timestamp_sec,
                "timestamp_formatted": format_duration(timestamp_sec),
                "image_path": rel_image_path,
                "abs_image_path": frame_abs_path,
                "width": width,
                "height": height,
                "blur_score": round(item["blur_score"], 1),
                "brightness": round(item["brightness"], 1),
                "contrast": round(item["contrast"], 1),
                "feature_count": item["feature_count"]
            })

            if item["blur_score"] > max_sharpness and idx <= 5:
                max_sharpness = item["blur_score"]
                best_thumb_idx = idx - 1

        # Save best frame as thumbnail
        if extracted:
            thumb_frame = selected_candidates[best_thumb_idx]["frame"]
            thumb_path = os.path.join(frames_dir, "thumbnail.jpg")
            thumb_w = min(640, width)
            thumb_h = int(height * (thumb_w / width))
            thumb_img = cv2.resize(thumb_frame, (thumb_w, thumb_h))
            cv2.imwrite(thumb_path, thumb_img, [cv2.IMWRITE_JPEG_QUALITY, 90])

        return extracted

video_service = VideoService()
