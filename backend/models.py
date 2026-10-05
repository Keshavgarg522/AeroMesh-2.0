import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, BigInteger, Boolean, DateTime,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship, foreign
from backend.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(64), nullable=False, default="GENERAL_USER")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    google_id = Column(String(128), unique=True, index=True, nullable=True)
    profile_image = Column(String(1024), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)

    incidents = relationship("Incident", back_populates="user", cascade="all, delete-orphan", primaryjoin="foreign(Incident.user_id) == User.id")
    custom_markings = relationship("CustomMarking", back_populates="user", cascade="all, delete-orphan", primaryjoin="foreign(CustomMarking.user_id) == User.id")


class AuthorizedRescuer(Base):
    __tablename__ = "authorized_rescuers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rescuer_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=False)
    department = Column(String(255), nullable=False)
    designation = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(64), nullable=False, default="AUTHORIZED_RESCUER")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)


class Incident(Base):
    __tablename__ = "incidents"

    # Backend generated unique incident ID (e.g. AM-2026-000001)
    id = Column(String(32), primary_key=True, index=True)
    user_id = Column(String(36), index=True, nullable=False)
    
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    status = Column(String(64), nullable=False, default="QUEUED", index=True)
    
    # Immutable creation timestamp (UTC)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Video Metadata
    video_filename = Column(String(255), nullable=True)
    video_path = Column(String(1024), nullable=True)
    video_size_bytes = Column(BigInteger, nullable=True)
    video_duration_sec = Column(Float, nullable=True)
    video_width = Column(Integer, nullable=True)
    video_height = Column(Integer, nullable=True)
    video_fps = Column(Float, nullable=True)
    video_frame_count = Column(Integer, nullable=True)
    video_codec = Column(String(32), nullable=True)
    thumbnail_url = Column(String(1024), nullable=True)

    # Conditions & Summary
    overall_condition_level = Column(String(32), default="UNKNOWN")  # CRITICAL, WARNING, MODERATE, SAFE, UNKNOWN
    overall_condition_title = Column(String(255), default="Pending Assessment")
    overall_condition_desc = Column(Text, default="Awaiting analysis.")
    key_observations = Column(JSON, default=list)

    # Relationships
    user = relationship("User", back_populates="incidents", primaryjoin="foreign(Incident.user_id) == User.id")
    analysis_jobs = relationship("AnalysisJob", back_populates="incident", cascade="all, delete-orphan")
    frames = relationship("Frame", back_populates="incident", cascade="all, delete-orphan")
    detections = relationship("Detection", back_populates="incident", cascade="all, delete-orphan")
    tracks = relationship("Track", back_populates="incident", cascade="all, delete-orphan")
    reconstruction = relationship("ReconstructionResult", uselist=False, back_populates="incident", cascade="all, delete-orphan")
    reconstruction_annotations = relationship("ReconstructionAnnotation", back_populates="incident", cascade="all, delete-orphan")
    custom_markings = relationship("CustomMarking", back_populates="incident", cascade="all, delete-orphan")
    report = relationship("Report", uselist=False, back_populates="incident", cascade="all, delete-orphan")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    status = Column(String(64), nullable=False, default="QUEUED")
    progress_pct = Column(Integer, default=0)
    current_stage = Column(String(128), default="Job initialized")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    incident = relationship("Incident", back_populates="analysis_jobs")


class Frame(Base):
    __tablename__ = "frames"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    frame_number = Column(Integer, nullable=False)  # 1-based index
    timestamp_sec = Column(Float, nullable=False)
    timestamp_formatted = Column(String(16), nullable=False)  # "00:04"
    image_path = Column(String(1024), nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)

    incident = relationship("Incident", back_populates="frames")
    detections = relationship("Detection", back_populates="frame", cascade="all, delete-orphan")


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    frame_id = Column(Integer, ForeignKey("frames.id", ondelete="CASCADE"), index=True, nullable=False)
    track_id = Column(Integer, nullable=True, index=True)
    entity_class = Column(String(64), nullable=False)  # person, car, truck, bus, motorcycle, fire, smoke, damage
    confidence = Column(Float, nullable=False)
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)
    bbox_x2 = Column(Float, nullable=False)
    bbox_y2 = Column(Float, nullable=False)
    model_name = Column(String(64), nullable=False)

    incident = relationship("Incident", back_populates="detections")
    frame = relationship("Frame", back_populates="detections")


class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    track_id = Column(Integer, nullable=False)
    entity_class = Column(String(64), nullable=False)
    first_seen_sec = Column(Float, nullable=False)
    last_seen_sec = Column(Float, nullable=False)
    frame_count = Column(Integer, default=1)
    estimated_x = Column(Float, nullable=True)
    estimated_y = Column(Float, nullable=True)
    estimated_z = Column(Float, nullable=True)

    incident = relationship("Incident", back_populates="tracks")


class ReconstructionResult(Base):
    __tablename__ = "reconstruction_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    model_glb_path = Column(String(1024), nullable=False)
    point_count = Column(Integer, default=0)
    camera_count = Column(Integer, default=0)
    registered_image_count = Column(Integer, default=0)
    mesh_vertex_count = Column(Integer, default=0)
    mesh_face_count = Column(Integer, default=0)
    observed_percentage = Column(Float, default=0.0)
    reconstructed_percentage = Column(Float, default=0.0)
    inferred_percentage = Column(Float, default=0.0)
    reconstruction_quality = Column(String(32), default="UNKNOWN")  # GOOD, ACCEPTABLE, LOW_QUALITY, INSUFFICIENT
    processing_time_sec = Column(Float, default=0.0)
    failure_reason = Column(String(512), nullable=True)
    diagnostic_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    incident = relationship("Incident", back_populates="reconstruction")
    cameras = relationship("ReconstructionCamera", back_populates="reconstruction", cascade="all, delete-orphan")


class ReconstructionCamera(Base):
    __tablename__ = "reconstruction_cameras"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reconstruction_id = Column(Integer, ForeignKey("reconstruction_results.id", ondelete="CASCADE"), index=True, nullable=False)
    frame_number = Column(Integer, nullable=False)
    # Quaternion orientation
    qw = Column(Float, nullable=False)
    qx = Column(Float, nullable=False)
    qy = Column(Float, nullable=False)
    qz = Column(Float, nullable=False)
    # Translation
    tx = Column(Float, nullable=False)
    ty = Column(Float, nullable=False)
    tz = Column(Float, nullable=False)
    # Camera intrinsics
    focal_length = Column(Float, nullable=True)
    cx = Column(Float, nullable=True)
    cy = Column(Float, nullable=True)

    reconstruction = relationship("ReconstructionResult", back_populates="cameras")


class ReconstructionAnnotation(Base):
    __tablename__ = "reconstruction_annotations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    track_id = Column(Integer, nullable=True)
    annotation_type = Column(String(64), nullable=False)  # Humans, Vehicles, Fire & Smoke, Damage, Entry/Exit
    label = Column(String(255), nullable=False)
    pos_x = Column(Float, nullable=False)
    pos_y = Column(Float, nullable=False)
    pos_z = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    mapping_confidence = Column(Float, default=1.0)
    source_frame_numbers = Column(JSON, default=list)

    incident = relationship("Incident", back_populates="reconstruction_annotations")


class CustomMarking(Base):
    __tablename__ = "custom_markings"

    id = Column(String(64), primary_key=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(64), nullable=False)
    color = Column(String(32), nullable=False)
    description = Column(Text, nullable=True)
    pos_x = Column(Float, nullable=False)
    pos_y = Column(Float, nullable=False)
    pos_z = Column(Float, nullable=False)
    icon_type = Column(String(32), default="pin")
    visible = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    incident = relationship("Incident", back_populates="custom_markings")
    user = relationship("User", back_populates="custom_markings", primaryjoin="foreign(CustomMarking.user_id) == User.id")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    pdf_path = Column(String(1024), nullable=False)
    summary_data = Column(JSON, nullable=False)
    generated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    incident = relationship("Incident", back_populates="report")
