import os
import traceback
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import (
    Incident, AnalysisJob, Frame, Detection, Track,
    ReconstructionResult, ReconstructionCamera, ReconstructionAnnotation, Report,
    CustomMarking
)
from backend.services.storage import storage
from backend.services.video_service import video_service
from backend.services.ai_detector import ai_detector
from backend.services.reconstruction_service import reconstruction_service
from backend.services.spatial_mapper import spatial_mapper
from backend.services.pdf_generator import pdf_generator

def update_job_status(db: Session, incident_id: str, status_str: str, progress: int, stage_desc: str, error_msg: str = None):
    job = db.query(AnalysisJob).filter(AnalysisJob.incident_id == incident_id).first()
    if not job:
        job = AnalysisJob(incident_id=incident_id)
        db.add(job)
    job.status = status_str
    job.progress_pct = progress
    job.current_stage = stage_desc
    if error_msg:
        job.error_message = error_msg
    
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if inc:
        inc.status = status_str
        if status_str == "COMPLETED":
            inc.completed_at = datetime.now(timezone.utc)
            inc.status = "Analysis Completed"
        elif status_str == "FAILED":
            inc.status = "Failed"
    db.commit()

def run_incident_pipeline(incident_id: str):
    """
    Executes the complete real analysis pipeline in background.
    """
    db: Session = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident or not incident.video_path:
            update_job_status(db, incident_id, "FAILED", 0, "No video file found for incident", "Video path is missing")
            return

        video_abs_path = storage.get_absolute_path(incident.video_path)
        if not os.path.exists(video_abs_path):
            update_job_status(db, incident_id, "FAILED", 0, "Video file not found on disk", f"File does not exist: {video_abs_path}")
            return

        incident.processing_started_at = datetime.now(timezone.utc)
        db.commit()

        # ── 1. FRAME EXTRACTION ───────────────────────────────────────────────
        update_job_status(db, incident_id, "EXTRACTING_FRAMES", 15, "Extracting video keyframes via OpenCV")
        
        # Clear any prior frames/detections if re-analyzing
        db.query(Frame).filter(Frame.incident_id == incident_id).delete()
        db.query(Detection).filter(Detection.incident_id == incident_id).delete()
        db.query(Track).filter(Track.incident_id == incident_id).delete()
        db.query(ReconstructionResult).filter(ReconstructionResult.incident_id == incident_id).delete()
        db.query(ReconstructionAnnotation).filter(ReconstructionAnnotation.incident_id == incident_id).delete()
        db.query(CustomMarking).filter(
            CustomMarking.incident_id == incident_id,
            CustomMarking.is_system == True
        ).delete()
        db.query(Report).filter(Report.incident_id == incident_id).delete()
        db.commit()

        extracted_frames = video_service.extract_frames(video_abs_path, incident_id)
        if not extracted_frames:
            update_job_status(db, incident_id, "FAILED", 15, "Frame extraction failed", "Could not extract frames from video")
            return

        frame_db_map = {}
        for fr in extracted_frames:
            frame_obj = Frame(
                incident_id=incident_id,
                frame_number=fr["frame_number"],
                timestamp_sec=fr["timestamp_sec"],
                timestamp_formatted=fr["timestamp_formatted"],
                image_path=fr["image_path"],
                width=fr["width"],
                height=fr["height"]
            )
            db.add(frame_obj)
            db.flush()
            frame_db_map[fr["frame_number"]] = frame_obj.id

        # Update incident thumbnail
        thumb_rel_path = f"/storage/frames/{incident_id}/thumbnail.jpg"
        if os.path.exists(os.path.join(storage.get_incident_frames_dir(incident_id), "thumbnail.jpg")):
            incident.thumbnail_url = thumb_rel_path
        db.commit()

        # ── 2. DETECTING ENTITIES & TRACKING ──────────────────────────────────
        update_job_status(db, incident_id, "DETECTING_ENTITIES", 35, "Running YOLOv8 pretrained entity detection")
        
        ai_results = ai_detector.detect_and_track(extracted_frames)

        update_job_status(db, incident_id, "TRACKING", 50, "Calculating ByteTrack continuous multi-object trajectories")

        # Save detections to database
        for d in ai_results["detections"]:
            det_obj = Detection(
                incident_id=incident_id,
                frame_id=frame_db_map.get(d["frame_number"], 0),
                track_id=d.get("track_id"),
                entity_class=d["entity_class"],
                confidence=d["confidence"],
                bbox_x1=d["bbox"][0],
                bbox_y1=d["bbox"][1],
                bbox_x2=d["bbox"][2],
                bbox_y2=d["bbox"][3],
                model_name=d["model_name"]
            )
            db.add(det_obj)

        # Save tracks to database
        for tr in ai_results["tracks"]:
            track_obj = Track(
                incident_id=incident_id,
                track_id=tr["track_id"],
                entity_class=tr["entity_class"],
                first_seen_sec=tr["first_seen_sec"],
                last_seen_sec=tr["last_seen_sec"],
                frame_count=tr["frame_count"]
            )
            db.add(track_obj)
        db.commit()

        # ── 3. 3D RECONSTRUCTION (Structure-from-Motion) ──────────────────────
        update_job_status(db, incident_id, "RECONSTRUCTING_3D", 70, "Processing Structure-from-Motion photogrammetry")

        rec_res = reconstruction_service.run_reconstruction(incident_id, extracted_frames)

        rec_obj = ReconstructionResult(
            incident_id=incident_id,
            model_glb_path=rec_res.get("glb_url") or "",
            point_count=rec_res.get("point_count", 0),
            camera_count=rec_res.get("camera_count", 0),
            registered_image_count=rec_res.get("registered_image_count", 0),
            mesh_vertex_count=rec_res.get("mesh_vertex_count", 0),
            mesh_face_count=rec_res.get("mesh_face_count", 0),
            observed_percentage=rec_res.get("observed_pct", 0.0),
            reconstructed_percentage=rec_res.get("reconstructed_pct", 0.0),
            inferred_percentage=rec_res.get("inferred_pct", 0.0),
            reconstruction_quality=rec_res.get("quality", "UNKNOWN"),
            processing_time_sec=rec_res.get("processing_time_sec", 0.0),
            failure_reason=rec_res.get("failure_reason"),
            diagnostic_data=rec_res.get("diagnostics", {})
        )
        db.add(rec_obj)
        db.flush()

        for cam in rec_res.get("cameras", []):
            cam_obj = ReconstructionCamera(
                reconstruction_id=rec_obj.id,
                frame_number=cam["frame_number"],
                qw=cam["qw"],
                qx=cam["qx"],
                qy=cam["qy"],
                qz=cam["qz"],
                tx=cam["tx"],
                ty=cam["ty"],
                tz=cam["tz"]
            )
            db.add(cam_obj)
        db.commit()

        # ── 4. 3D SPATIAL ANNOTATION MAPPING ──────────────────────────────────
        update_job_status(db, incident_id, "MAPPING_3D_ANNOTATIONS", 85, "Projecting entity tracks into 3D scene coordinate space")

        annotations_3d = spatial_mapper.map_detections_to_3d(
            tracks=ai_results["tracks"],
            cameras=rec_res.get("cameras", []),
            reconstruction_quality=rec_res.get("quality", "UNKNOWN")
        )

        CATEGORY_STYLE = {
            "Peoples": {"type": "Custom", "color": "#3b82f6", "icon": "pin"},
            "Vehicles": {"type": "Custom", "color": "#8b5cf6", "icon": "pin"},
            "Fire": {"type": "Hazard", "color": "#ef4444", "icon": "fire"},
            "Smoke": {"type": "Hazard", "color": "#6b7280", "icon": "warning"},
            "Damage": {"type": "Damage", "color": "#f59e0b", "icon": "warning"},
            "Entry/Exit Points": {"type": "Entry Point", "color": "#10b981", "icon": "pin"},
            "3D Reconstruction": {"type": "Hazard", "color": "#06b6d4", "icon": "pin"},
        }

        for ann in annotations_3d:
            ann_obj = ReconstructionAnnotation(
                incident_id=incident_id,
                track_id=ann.get("track_id"),
                annotation_type=ann["annotation_type"],
                label=ann["label"],
                pos_x=ann["pos_x"],
                pos_y=ann["pos_y"],
                pos_z=ann["pos_z"],
                confidence=ann["confidence"],
                mapping_confidence=ann["mapping_confidence"],
                source_frame_numbers=ann.get("source_frame_numbers", [])
            )
            db.add(ann_obj)

            # Persist as default platform marking on the 3D model
            style = CATEGORY_STYLE.get(ann["annotation_type"], {"type": "Custom", "color": "#3b82f6", "icon": "pin"})
            track_id = ann.get("track_id", 0)
            mark_id = f"sys-det-{incident_id}-{track_id}"
            def_marking = CustomMarking(
                id=mark_id,
                incident_id=incident_id,
                user_id=incident.user_id,
                name=ann["label"],
                type=style["type"],
                color=style["color"],
                description=f"AI-detected {ann['annotation_type']} (Confidence: {int(ann['confidence'] * 100)}%)",
                pos_x=ann["pos_x"],
                pos_y=ann["pos_y"],
                pos_z=ann["pos_z"],
                icon_type=style["icon"],
                visible=True,
                is_system=True
            )
            db.add(def_marking)
        db.commit()

        # ── 5. REPORT GENERATION ──────────────────────────────────────────────
        update_job_status(db, incident_id, "GENERATING_REPORT", 95, "Compiling official Analysis Report PDF")

        # Determine overall condition from actual detections
        total_p = ai_results["stats"]["totalPeople"]
        total_v = ai_results["stats"]["totalVehicles"]
        
        if total_p > 0 or total_v > 0:
            incident.overall_condition_level = "MODERATE"
            incident.overall_condition_title = "MODERATE — Active Entities Monitored"
            incident.overall_condition_desc = f"Aerial reconnaissance isolated {total_p} persons and {total_v} vehicles in surveyed perimeter."
        else:
            incident.overall_condition_level = "SAFE"
            incident.overall_condition_title = "SAFE — Perimeter Clear"
            incident.overall_condition_desc = "No hazards, active fire, or unauthorized personnel identified in the footage."

        observations = []
        if total_p > 0:
            observations.append(f"{total_p} unique human presence tracks verified across keyframes.")
        else:
            observations.append("Zero human presence detected in surveyed perimeter.")

        if total_v > 0:
            observations.append(f"{total_v} vehicles mapped along approach routes.")
        else:
            observations.append("Zero vehicular obstacles identified in immediate sector.")

        observations.append(f"3D Photogrammetry sparse reconstruction quality: {rec_res.get('quality', 'N/A')}.")
        incident.key_observations = observations
        db.commit()

        # Build PDF report
        report_pdf_path = storage.get_report_path(incident_id)
        report_data = {
            "id": incident.id,
            "name": incident.name,
            "location": incident.location,
            "status": "Analysis Completed",
            "created_at": incident.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "overall_condition_level": incident.overall_condition_level,
            "video_filename": incident.video_filename or "N/A",
            "video_duration": f"{incident.video_duration_sec or 0:.1f}s",
            "video_resolution": f"{incident.video_width or 0}x{incident.video_height or 0}",
            "stats": ai_results["stats"],
            "reconstruction": rec_res,
            "key_observations": observations
        }

        try:
            pdf_generator.generate_report(report_data, report_pdf_path)
            existing_rep = db.query(Report).filter(Report.incident_id == incident_id).first()
            if existing_rep:
                existing_rep.pdf_path = f"/storage/reports/{incident_id}_report.pdf"
                existing_rep.summary_data = report_data
                existing_rep.generated_at = datetime.now(timezone.utc)
            else:
                report_rec = Report(
                    incident_id=incident_id,
                    pdf_path=f"/storage/reports/{incident_id}_report.pdf",
                    summary_data=report_data
                )
                db.add(report_rec)
            db.commit()
        except Exception as e:
            print(f"[AeroMesh Report Error] Could not generate PDF: {e}")

        # ── 6. COMPLETED ──────────────────────────────────────────────────────
        update_job_status(db, incident_id, "COMPLETED", 100, "Analysis completed successfully")

    except Exception as e:
        traceback.print_exc()
        update_job_status(db, incident_id, "FAILED", 0, "Analysis pipeline encountered an error", str(e))
    finally:
        db.close()
