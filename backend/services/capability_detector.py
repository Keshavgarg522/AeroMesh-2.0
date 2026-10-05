import os
import shutil
from typing import Dict, Any, List
from backend.config import settings

class CapabilityDetector:
    _cached_capabilities: Dict[str, Any] = {}

    @classmethod
    def get_capabilities(cls, force_refresh: bool = False) -> Dict[str, Any]:
        if cls._cached_capabilities and not force_refresh:
            return cls._cached_capabilities

        # 1. Hardware & Compute
        cuda_available = False
        device_name = "CPU"
        torch_version = None
        try:
            import torch
            torch_version = torch.__version__
            cuda_available = bool(torch.cuda.is_available())
            if cuda_available:
                device_name = torch.cuda.get_device_name(0)
        except Exception:
            pass

        # 2. Vision & YOLO Models
        yolo_installed = False
        yolo_classes: List[str] = []
        yolo_model_path = os.path.abspath(settings.YOLO_MODEL)
        yolo_model_exists = os.path.exists(yolo_model_path)
        
        try:
            from ultralytics import YOLO
            yolo_installed = True
            if yolo_model_exists:
                model = YOLO(yolo_model_path)
                yolo_classes = list(model.names.values()) if hasattr(model, 'names') else []
        except Exception as e:
            print(f"[CapabilityDetector] YOLO check notice: {e}")

        # Class capability checks
        coco_lower = {c.lower() for c in yolo_classes}
        has_people_class = bool("person" in coco_lower)
        has_vehicle_class = bool({"car", "truck", "bus", "motorcycle"}.intersection(coco_lower))
        has_fire_model = bool({"fire", "flame"}.intersection(coco_lower))
        has_smoke_model = bool("smoke" in coco_lower)
        has_damage_model = bool({"damage", "crack", "collapse"}.intersection(coco_lower))
        has_entry_exit_model = bool({"door", "gate", "entry", "exit"}.intersection(coco_lower))

        # 3. Tracking dependencies
        has_bytetrack = False
        try:
            import lap
            has_bytetrack = True
        except ImportError:
            try:
                import lapx
                has_bytetrack = True
            except ImportError:
                pass

        # 4. Reconstruction & Photogrammetry
        has_cv2 = False
        cv2_version = None
        try:
            import cv2
            has_cv2 = True
            cv2_version = cv2.__version__
        except ImportError:
            pass

        has_pycolmap = False
        pycolmap_version = None
        pycolmap_has_cuda = False
        try:
            import pycolmap
            has_pycolmap = True
            pycolmap_version = getattr(pycolmap, "__version__", "unknown")
            pycolmap_has_cuda = getattr(pycolmap, "has_cuda", False)
        except ImportError:
            pass

        colmap_cli_path = shutil.which("colmap")
        ffmpeg_cli_path = shutil.which("ffmpeg")

        has_trimesh = False
        try:
            import trimesh
            has_trimesh = True
        except ImportError:
            pass

        # 5. Reporting
        has_reportlab = False
        try:
            import reportlab
            has_reportlab = True
        except ImportError:
            pass

        caps = {
            "environment": {
                "os": os.name,
                "cuda_available": cuda_available,
                "device": "cuda" if cuda_available else "cpu",
                "device_name": device_name,
                "torch_version": torch_version,
            },
            "detection": {
                "yolo_installed": yolo_installed,
                "yolo_model_name": settings.YOLO_MODEL,
                "yolo_model_exists": yolo_model_exists,
                "total_classes": len(yolo_classes),
                "people_detection": "AVAILABLE" if has_people_class else "MODEL_UNAVAILABLE",
                "vehicle_detection": "AVAILABLE" if has_vehicle_class else "MODEL_UNAVAILABLE",
                "fire_detection": "AVAILABLE" if has_fire_model else "MODEL_UNAVAILABLE",
                "smoke_detection": "AVAILABLE" if has_smoke_model else "MODEL_UNAVAILABLE",
                "damage_detection": "AVAILABLE" if has_damage_model else "MODEL_UNAVAILABLE",
                "entry_exit_detection": "AVAILABLE" if has_entry_exit_model else "NOT_ANALYZED",
                "bytetrack_tracking": "AVAILABLE" if has_bytetrack else "FALLBACK_IOU",
            },
            "reconstruction": {
                "opencv_sfm": "AVAILABLE" if has_cv2 else "UNAVAILABLE",
                "opencv_version": cv2_version,
                "pycolmap_sfm": "AVAILABLE" if has_pycolmap else "UNAVAILABLE",
                "pycolmap_version": pycolmap_version,
                "pycolmap_cuda": pycolmap_has_cuda,
                "colmap_cli": colmap_cli_path if colmap_cli_path else "NOT_IN_PATH",
                "trimesh_glb_export": "AVAILABLE" if has_trimesh else "UNAVAILABLE",
            },
            "media": {
                "opencv_video_decode": "AVAILABLE" if has_cv2 else "UNAVAILABLE",
                "ffmpeg_cli": ffmpeg_cli_path if ffmpeg_cli_path else "NOT_IN_PATH",
                "reportlab_pdf": "AVAILABLE" if has_reportlab else "UNAVAILABLE",
            }
        }

        cls._cached_capabilities = caps
        return caps

capability_detector = CapabilityDetector()
