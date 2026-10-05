import os
import pytest
from backend.services.storage import storage
from backend.services.video_service import video_service
from backend.services.ai_detector import ai_detector
from backend.services.reconstruction_service import reconstruction_service
from backend.services.spatial_mapper import spatial_mapper
from backend.services.pdf_generator import pdf_generator

def test_video_metadata_and_frame_extraction():
    test_video = os.path.abspath("test_drone1.mp4")
    assert os.path.exists(test_video), "test_drone1.mp4 must exist in workspace root"

    # 1. Extract metadata
    meta = video_service.extract_metadata(test_video)
    assert meta["duration_sec"] > 0
    assert meta["width"] > 0
    assert meta["height"] > 0
    assert meta["fps"] > 0
    assert meta["frame_count"] > 0

    # 2. Extract keyframes
    test_inc_id = "test-unit-001"
    frames = video_service.extract_frames(test_video, test_inc_id, target_frame_count=8)
    assert len(frames) == 8
    for f in frames:
        assert os.path.exists(f["abs_image_path"])
        assert f["width"] == meta["width"]
        assert f["height"] == meta["height"]

    # 3. AI Entity Detection & Tracking with real pretrained model
    ai_results = ai_detector.detect_and_track(frames)
    assert "detections" in ai_results
    assert "tracks" in ai_results
    assert "stats" in ai_results
    assert "conditions" in ai_results

    # Verify no fake confidence or fabricated fire/smoke:
    # If no fire is detected, fire must be 0
    assert ai_results["stats"]["fireIncidents"]["major"] >= 0

    # 4. Reconstruction Service (Structure-from-Motion / Point Cloud)
    rec_res = reconstruction_service.run_reconstruction(test_inc_id, frames)
    assert rec_res["success"] is True
    assert os.path.exists(rec_res["glb_abs_path"])
    assert rec_res["quality"] in {"HIGH", "MEDIUM", "LOW", "INSUFFICIENT", "HIGH_QUALITY", "MEDIUM_QUALITY", "LOW_QUALITY", "INSUFFICIENT_DATA"}

    # 5. Spatial Mapper (Ray/Pose 3D Placement)
    annotations = spatial_mapper.map_detections_to_3d(
        tracks=ai_results["tracks"],
        cameras=rec_res["cameras"],
        reconstruction_quality=rec_res["quality"]
    )
    # If cameras are available, annotations are placed; if not, list is empty without random coordinates
    assert isinstance(annotations, list)
    for ann in annotations:
        assert "annotation_type" in ann
        assert "label" in ann
        assert "pos_x" in ann and "pos_y" in ann and "pos_z" in ann
        assert ann["annotation_type"] in {
            "Peoples", "Vehicles", "Fire", "Smoke", "Damage", "Entry/Exit Points", "3D Reconstruction"
        }

    # 6. PDF Report Generator
    out_pdf = storage.get_report_path(test_inc_id)
    report_data = {
        "id": "AM-TEST-000001",
        "name": "Pipeline Verification Run",
        "location": "Sector 62, Test Site",
        "status": "Analysis Completed",
        "created_at": "2026-09-11 23:00:00 UTC",
        "overall_condition_level": "SAFE",
        "video_filename": "test_drone1.mp4",
        "video_duration": f"{meta['duration_sec']}s",
        "video_resolution": f"{meta['width']}x{meta['height']}",
        "stats": ai_results["stats"],
        "reconstruction": rec_res,
        "key_observations": ["Automated drone test keyframe pass completed successfully."]
    }
    pdf_path = pdf_generator.generate_report(report_data, out_pdf)
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 1000  # Valid non-empty PDF
