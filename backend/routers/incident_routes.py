import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from backend.database import get_db
from backend.models import (
    User, Incident, AnalysisJob, Frame, Detection, Track,
    ReconstructionResult, ReconstructionAnnotation, CustomMarking, Report
)
from backend.schemas import (
    IncidentCreate, IncidentResponse, IncidentStats, DetectedConditions,
    OverallCondition, FireIncidents, EntryExitPoints, DamagedAreas,
    VideoFrameResponse, CustomMarkingCreate, CustomMarkingUpdatePosition,
    CustomMarkingUpdateVisibility,
    CustomMarkingResponse, ReconstructionResponse, ReconstructionAnnotationResponse,
    JobStatusResponse, DetectionResponse
)
from backend.auth import get_current_user, require_rescuer
from backend.services.storage import storage
from backend.services.video_service import video_service
from backend.services.pipeline_runner import run_incident_pipeline

router = APIRouter(prefix="/api/incidents", tags=["Incidents"])

def generate_incident_id(db: Session) -> str:
    """
    Generates a unique, collision-safe incident ID format: AM-YYYY-NNNNNN
    """
    year = datetime.now(timezone.utc).year
    # Count incidents created this year
    count = db.query(Incident).filter(Incident.id.like(f"AM-{year}-%")).count() + 1
    new_id = f"AM-{year}-{count:06d}"
    
    # Ensure collision safety
    while db.query(Incident).filter(Incident.id == new_id).first():
        count += 1
        new_id = f"AM-{year}-{count:06d}"
    return new_id

def map_incident_to_response(inc: Incident, db: Session) -> IncidentResponse:
    # Build actual stats from tracks/detections in DB
    tracks = db.query(Track).filter(Track.incident_id == inc.id).all()
    # Use the new whitelist category names set by category_filter.py
    people_tracks  = [t for t in tracks if t.entity_class == "Peoples"]
    vehicle_tracks = [t for t in tracks if t.entity_class == "Vehicles"]
    fire_tracks    = [t for t in tracks if t.entity_class == "Fire"]
    smoke_tracks   = [t for t in tracks if t.entity_class == "Smoke"]
    damage_tracks  = [t for t in tracks if t.entity_class == "Damage"]

    stats = IncidentStats(
        totalPeople=len(people_tracks),
        peopleDelta=0,
        totalVehicles=len(vehicle_tracks),
        vehiclesDelta=0,
        fireIncidents=FireIncidents(
            major=len(fire_tracks),
            minor=0,
            hazardous=len(smoke_tracks)
        ),
        entryExitPoints=EntryExitPoints(total=0, entry=0, exit=0),
        damagedAreas=DamagedAreas(
            total=len(damage_tracks),
            details=f"{len(damage_tracks)} damage area(s) detected" if damage_tracks else "N/A \u2014 No damage detected"
        )
    )

    detected = DetectedConditions(
        structuralDamage=len(damage_tracks) > 0,
        fire=len(fire_tracks) > 0,
        smoke=len(smoke_tracks) > 0,
        humanPresence=len(people_tracks) > 0,
        vehiclePresence=len(vehicle_tracks) > 0,
        entryExit=False
    )

    overall = OverallCondition(
        level=inc.overall_condition_level or "UNKNOWN",
        title=inc.overall_condition_title or "Pending Analysis",
        description=inc.overall_condition_desc or "Scene assessment underway."
    )

    rec = db.query(ReconstructionResult).filter(ReconstructionResult.incident_id == inc.id).first()
    glb_url = rec.model_glb_path if rec else None

    # Format local date and time strings for display from immutable UTC timestamp
    created_dt = inc.created_at
    date_str = created_dt.strftime("%Y-%m-%d")
    time_str = created_dt.strftime("%I:%M %p")

    video_duration_str = None
    if inc.video_duration_sec:
        m = int(inc.video_duration_sec // 60)
        s = int(inc.video_duration_sec % 60)
        video_duration_str = f"{m:02d}:{s:02d}"

    video_res_str = None
    if inc.video_width and inc.video_height:
        video_res_str = f"{inc.video_width} × {inc.video_height}"

    video_size_str = None
    if inc.video_size_bytes:
        video_size_str = f"{inc.video_size_bytes / (1024 * 1024):.1f} MB"

    return IncidentResponse(
        id=inc.id,
        name=inc.name,
        location=inc.location,
        description=inc.description,
        date=date_str,
        time=time_str,
        status=inc.status,
        thumbnailUrl=inc.thumbnail_url or "/assets/drone_bridge_aerial.jpg",
        videoName=inc.video_filename,
        videoSize=video_size_str,
        videoObjectUrl=f"/storage/{inc.video_path}" if inc.video_path else None,
        videoDuration=video_duration_str,
        videoResolution=video_res_str,
        videoFps=inc.video_fps,
        stats=stats,
        detectedConditions=detected,
        overallCondition=overall,
        keyObservations=inc.key_observations or [],
        reconstruction_glb_url=glb_url
    )

# ─── Incidents CRUD ───────────────────────────────────────────────────────────

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new incident for the authenticated user.
    Backend automatically generates:
    - Collision-safe unique incident ID
    - Immutable UTC creation timestamp
    """
    new_id = generate_incident_id(db)
    now_utc = datetime.now(timezone.utc)

    incident = Incident(
        id=new_id,
        user_id=current_user.id,
        name=payload.name,
        location=payload.location,
        description=payload.description,
        status="Pending",
        created_at=now_utc
    )
    db.add(incident)
    
    # Initialize analysis job record
    job = AnalysisJob(
        incident_id=new_id,
        status="Pending",
        progress_pct=0,
        current_stage="Incident registered"
    )
    db.add(job)
    db.commit()
    db.refresh(incident)

    return map_incident_to_response(incident, db)

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Strict User Data Isolation:
    Returns ONLY incidents belonging to the authenticated user.
    Supports filtering by actual database timestamp.
    """
    query = db.query(Incident).filter(Incident.user_id == current_user.id)

    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            query = query.filter(Incident.created_at >= sd)
        except ValueError:
            pass

    if end_date:
        try:
            ed = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            query = query.filter(Incident.created_at <= ed)
        except ValueError:
            pass

    incidents = query.order_by(desc(Incident.created_at)).all()
    return [map_incident_to_response(inc, db) for inc in incidents]

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves a single incident, enforcing user ownership.
    """
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")
    return map_incident_to_response(inc, db)

@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes an incident belonging to the authenticated user.
    """
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")
    db.delete(inc)
    db.commit()
    return None

# ─── Video Upload & Analysis ──────────────────────────────────────────────────

@router.post("/{incident_id}/video")
async def upload_video(
    incident_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Uploads a real drone video:
    - Validates file, MIME, size
    - Extracts actual OpenCV video metadata
    - Associates with the incident
    """
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    rel_path, size_bytes = await storage.save_video(incident_id, file)
    abs_path = storage.get_absolute_path(rel_path)

    try:
        meta = video_service.extract_metadata(abs_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read video metadata: {str(e)}")

    inc.video_filename = file.filename
    inc.video_path = rel_path
    inc.video_size_bytes = size_bytes
    inc.video_duration_sec = meta["duration_sec"]
    inc.video_width = meta["width"]
    inc.video_height = meta["height"]
    inc.video_fps = meta["fps"]
    inc.video_frame_count = meta["frame_count"]
    inc.video_codec = meta["codec"]
    inc.status = "Pending"
    db.commit()

    return {
        "message": "Video uploaded and inspected successfully",
        "metadata": meta,
        "videoUrl": f"/storage/{rel_path}"
    }

@router.post("/{incident_id}/analyze")
def start_analysis(
    incident_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers the asynchronous analysis pipeline.
    """
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    if not inc.video_path:
        raise HTTPException(status_code=400, detail="Please upload a drone video before initiating analysis")

    inc.status = "EXTRACTING_FRAMES"
    db.commit()

    # Launch async pipeline
    background_tasks.add_task(run_incident_pipeline, incident_id)

    return {"message": "Analysis started", "incident_id": incident_id, "status": "QUEUED"}

@router.get("/{incident_id}/status", response_model=JobStatusResponse)
def get_analysis_status(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    job = db.query(AnalysisJob).filter(AnalysisJob.incident_id == incident_id).first()
    status_val = job.status if job else inc.status
    progress_val = job.progress_pct if job else (100 if "Completed" in inc.status else 0)
    stage_val = job.current_stage if job else inc.status

    # Get updated stats if completed
    resp = map_incident_to_response(inc, db)

    return JobStatusResponse(
        incident_id=incident_id,
        status=status_val,
        progress_pct=progress_val,
        current_stage=stage_val,
        error_message=job.error_message if job else None,
        stats=resp.stats,
        completed=("Completed" in inc.status or status_val == "COMPLETED")
    )

# ─── Frames & Detections ──────────────────────────────────────────────────────

@router.get("/{incident_id}/frames", response_model=List[VideoFrameResponse])
def get_incident_frames(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    frames = db.query(Frame).filter(Frame.incident_id == incident_id).order_by(Frame.frame_number).all()
    total_frames = len(frames)

    res = []
    for fr in frames:
        # Check detections count for this frame
        # NOTE: entity_class uses AeroMesh category names (set by category_filter.py):
        #   "Peoples" for persons, "Vehicles" for all vehicle types
        dets = db.query(Detection).filter(Detection.frame_id == fr.id).all()
        peeps = len([d for d in dets if d.entity_class == "Peoples"])
        vehs = len([d for d in dets if d.entity_class == "Vehicles"])

        res.append(VideoFrameResponse(
            id=fr.id,
            frameNumber=fr.frame_number,
            totalFrames=total_frames,
            timestamp=fr.timestamp_formatted,
            timestampSeconds=fr.timestamp_sec,
            imageUrl=fr.image_path,
            detections={
                "human": peeps if peeps > 0 else None,
                "vehicle": vehs if vehs > 0 else None,
                "fire": None,
                "smoke": None,
                "damage": None,
                "entryExit": None
            }
        ))
    return res

@router.get("/{incident_id}/detections", response_model=List[DetectionResponse])
def get_incident_detections(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    dets = db.query(Detection).filter(Detection.incident_id == incident_id).all()
    return [
        DetectionResponse(
            id=d.id,
            frame_id=d.frame_id,
            track_id=d.track_id,
            entity_class=d.entity_class,
            confidence=d.confidence,
            bbox=[d.bbox_x1, d.bbox_y1, d.bbox_x2, d.bbox_y2],
            model_name=d.model_name
        )
        for d in dets
    ]

# ─── 3D Reconstruction & Annotations ──────────────────────────────────────────

@router.get("/{incident_id}/reconstruction", response_model=ReconstructionResponse)
def get_reconstruction(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    rec = db.query(ReconstructionResult).filter(ReconstructionResult.incident_id == incident_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="3D reconstruction not yet generated")

    return ReconstructionResponse(
        id=rec.id,
        incident_id=rec.incident_id,
        model_glb_url=rec.model_glb_path,
        point_count=rec.point_count,
        camera_count=rec.camera_count,
        observed_percentage=rec.observed_percentage,
        reconstructed_percentage=rec.reconstructed_percentage,
        inferred_percentage=rec.inferred_percentage,
        reconstruction_quality=rec.reconstruction_quality
    )

@router.get("/{incident_id}/annotations", response_model=List[ReconstructionAnnotationResponse])
def get_reconstruction_annotations(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    anns = db.query(ReconstructionAnnotation).filter(ReconstructionAnnotation.incident_id == incident_id).all()
    return [
        ReconstructionAnnotationResponse(
            id=a.id,
            track_id=a.track_id,
            annotation_type=a.annotation_type,
            label=a.label,
            position=[a.pos_x, a.pos_y, a.pos_z],
            confidence=a.confidence,
            mapping_confidence=a.mapping_confidence,
            source_frame_numbers=a.source_frame_numbers or []
        )
        for a in anns
    ]

# ─── Custom Markings ──────────────────────────────────────────────────────────

@router.get("/{incident_id}/markings", response_model=List[CustomMarkingResponse])
def get_custom_markings(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    marks = db.query(CustomMarking).filter(
        CustomMarking.incident_id == incident_id,
        or_(CustomMarking.user_id == current_user.id, CustomMarking.is_system == True)
    ).all()

    return [
        CustomMarkingResponse(
            id=m.id,
            incident_id=m.incident_id,
            name=m.name,
            type=m.type,
            color=m.color,
            description=m.description,
            position=[m.pos_x, m.pos_y, m.pos_z],
            iconType=m.icon_type,
            visible=m.visible,
            isSystem=m.is_system
        )
        for m in marks
    ]

@router.post("/{incident_id}/markings", response_model=CustomMarkingResponse, status_code=status.HTTP_201_CREATED)
def create_custom_marking(
    incident_id: str,
    payload: CustomMarkingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    mark_id = f"user-mark-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    new_mark = CustomMarking(
        id=mark_id,
        incident_id=incident_id,
        user_id=current_user.id,
        name=payload.name,
        type=payload.type,
        color=payload.color,
        description=payload.description,
        pos_x=payload.position[0],
        pos_y=payload.position[1],
        pos_z=payload.position[2],
        icon_type=payload.icon_type or "pin",
        visible=payload.visible if payload.visible is not None else True,
        is_system=False
    )
    db.add(new_mark)
    db.commit()
    db.refresh(new_mark)

    return CustomMarkingResponse(
        id=new_mark.id,
        incident_id=new_mark.incident_id,
        name=new_mark.name,
        type=new_mark.type,
        color=new_mark.color,
        description=new_mark.description,
        position=[new_mark.pos_x, new_mark.pos_y, new_mark.pos_z],
        iconType=new_mark.icon_type,
        visible=new_mark.visible,
        isSystem=new_mark.is_system
    )

@router.delete("/markings/{marking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_marking(
    marking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mark = db.query(CustomMarking).filter(
        CustomMarking.id == marking_id,
        CustomMarking.user_id == current_user.id
    ).first()
    if not mark:
        raise HTTPException(status_code=404, detail="Marking not found or access denied")
    if mark.is_system:
        raise HTTPException(status_code=400, detail="System-generated markings cannot be deleted")
    db.delete(mark)
    db.commit()
    return None

@router.put("/markings/{marking_id}/position", response_model=CustomMarkingResponse)
def update_marking_position(
    marking_id: str,
    payload: CustomMarkingUpdatePosition,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mark = db.query(CustomMarking).filter(
        CustomMarking.id == marking_id,
        CustomMarking.user_id == current_user.id
    ).first()
    if not mark:
        raise HTTPException(status_code=404, detail="Marking not found or access denied")
    if mark.is_system:
        raise HTTPException(status_code=400, detail="System-generated markings cannot be moved")
    
    mark.pos_x = payload.position[0]
    mark.pos_y = payload.position[1]
    mark.pos_z = payload.position[2]
    db.commit()
    db.refresh(mark)

    return CustomMarkingResponse(
        id=mark.id,
        incident_id=mark.incident_id,
        name=mark.name,
        type=mark.type,
        color=mark.color,
        description=mark.description,
        position=[mark.pos_x, mark.pos_y, mark.pos_z],
        iconType=mark.icon_type,
        visible=mark.visible,
        isSystem=mark.is_system
    )

@router.put("/markings/{marking_id}/visibility", response_model=CustomMarkingResponse)
def update_marking_visibility(
    marking_id: str,
    payload: CustomMarkingUpdateVisibility,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mark = db.query(CustomMarking).filter(
        CustomMarking.id == marking_id,
        CustomMarking.user_id == current_user.id
    ).first()
    if not mark:
        raise HTTPException(status_code=404, detail="Marking not found or access denied")
    
    mark.visible = payload.visible
    db.commit()
    db.refresh(mark)

    return CustomMarkingResponse(
        id=mark.id,
        incident_id=mark.incident_id,
        name=mark.name,
        type=mark.type,
        color=mark.color,
        description=mark.description,
        position=[mark.pos_x, mark.pos_y, mark.pos_z],
        iconType=mark.icon_type,
        visible=mark.visible,
        isSystem=mark.is_system
    )

# ─── Reports ──────────────────────────────────────────────────────────────────

@router.get("/{incident_id}/report")
def get_report_metadata(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    report = db.query(Report).filter(Report.incident_id == incident_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not yet compiled")

    return {
        "incident_id": incident_id,
        "pdf_url": report.pdf_path,
        "generated_at": report.generated_at,
        "summary": report.summary_data
    }

@router.get("/{incident_id}/report/download")
def download_report_pdf(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or access denied")

    report_pdf_path = storage.get_report_path(incident_id)
    if not os.path.exists(report_pdf_path):
        raise HTTPException(status_code=404, detail="PDF report file does not exist")

    return FileResponse(
        report_pdf_path,
        media_type="application/pdf",
        filename=f"AeroMesh_{incident_id}_Report.pdf"
    )

@router.post("/{incident_id}/tactical-dispatch")
def tactical_dispatch(
    incident_id: str,
    payload: Dict[str, Any],
    current_user: Any = Depends(require_rescuer),
    db: Session = Depends(get_db)
):
    """
    Tactical team dispatch endpoint restricted strictly to Authorized Rescuers (RBAC).
    """
    return {
        "status": "DISPATCHED",
        "incident_id": incident_id,
        "team_callsign": payload.get("team_callsign"),
        "priority": payload.get("priority", "NORMAL"),
        "rescuer_id": getattr(current_user, "rescuer_id", "FIRE-001")
    }
