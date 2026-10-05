from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# ─── Auth Schemas ─────────────────────────────────────────────────────────────
class GeneralRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6)

class GeneralLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1)

class RescuerLoginRequest(BaseModel):
    rescuer_id: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=1)

class GoogleAuthRequest(BaseModel):
    id_token: str

class DevLoginRequest(BaseModel):
    email: str = "analyst@aeromesh.ai"
    name: str = "Keshav"
    profile_image: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    rescuer_id: Optional[str] = None
    name: str
    role: str = "GENERAL_USER"
    user_type: str = "general"
    organization: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    is_active: bool = True
    profile_image: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ─── Marking Schemas ──────────────────────────────────────────────────────────
class CustomMarkingCreate(BaseModel):
    name: str
    type: str
    color: str
    description: Optional[str] = ""
    position: List[float] = Field(..., min_items=3, max_items=3)
    icon_type: Optional[str] = "pin"
    visible: Optional[bool] = True

class CustomMarkingUpdatePosition(BaseModel):
    position: List[float] = Field(..., min_items=3, max_items=3)

class CustomMarkingUpdateVisibility(BaseModel):
    visible: bool

class CustomMarkingResponse(BaseModel):
    id: str
    incident_id: str
    name: str
    type: str
    color: str
    description: Optional[str] = None
    position: List[float]
    iconType: Optional[str] = None
    visible: bool
    isSystem: bool

# ─── Detection & Frame Schemas ────────────────────────────────────────────────
class DetectionResponse(BaseModel):
    id: int
    frame_id: int
    track_id: Optional[int] = None
    entity_class: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]
    model_name: str

class VideoFrameResponse(BaseModel):
    id: int
    frameNumber: int
    totalFrames: int
    timestamp: str
    timestampSeconds: float
    imageUrl: str
    detections: Optional[Dict[str, Optional[int]]] = None

# ─── Reconstruction Schemas ───────────────────────────────────────────────────
class ReconstructionResponse(BaseModel):
    id: int
    incident_id: str
    model_glb_url: str
    point_count: int
    camera_count: int
    registered_image_count: int = 0
    mesh_vertex_count: int = 0
    mesh_face_count: int = 0
    observed_percentage: float
    reconstructed_percentage: float
    inferred_percentage: float
    reconstruction_quality: str
    processing_time_sec: Optional[float] = 0.0
    failure_reason: Optional[str] = None

class ReconstructionDiagnosticsResponse(BaseModel):
    incident_id: str
    input_frames: int
    usable_frames: int
    rejected_frames: int
    features_extracted: int
    avg_features_per_frame: float
    matching_pairs_attempted: int
    verified_geometric_pairs: int
    registered_cameras: int
    sparse_points: int
    mesh_vertices: int
    mesh_faces: int
    observed_percentage: float
    reconstructed_percentage: float
    inferred_percentage: float
    reconstruction_quality: str
    failure_reason: Optional[str] = None
    processing_time_sec: float
    glb_file_size_bytes: int

class ReconstructionAnnotationResponse(BaseModel):
    id: int
    track_id: Optional[int] = None
    annotation_type: str
    label: str
    position: List[float]
    confidence: float
    mapping_confidence: float
    source_frame_numbers: List[int]

# ─── Incident Stats & Overview ───────────────────────────────────────────────
class FireIncidents(BaseModel):
    major: int = 0
    minor: int = 0
    hazardous: int = 0

class EntryExitPoints(BaseModel):
    total: int = 0
    entry: int = 0
    exit: int = 0

class DamagedAreas(BaseModel):
    total: int = 0
    details: str = "N/A"

class IncidentStats(BaseModel):
    totalPeople: int = 0
    peopleDelta: int = 0
    totalVehicles: int = 0
    vehiclesDelta: int = 0
    fireIncidents: FireIncidents = Field(default_factory=FireIncidents)
    entryExitPoints: EntryExitPoints = Field(default_factory=EntryExitPoints)
    damagedAreas: DamagedAreas = Field(default_factory=DamagedAreas)

class DetectedConditions(BaseModel):
    structuralDamage: bool = False
    fire: bool = False
    smoke: bool = False
    humanPresence: bool = False
    vehiclePresence: bool = False
    entryExit: bool = False

class OverallCondition(BaseModel):
    level: str = "UNKNOWN"
    title: str = "Pending Analysis"
    description: str = "Scene assessment underway."

# ─── Incident CRUD ────────────────────────────────────────────────────────────
class IncidentCreate(BaseModel):
    name: str
    location: str
    description: str

class IncidentResponse(BaseModel):
    id: str
    name: str
    location: str
    description: str
    date: str
    time: str
    status: str
    thumbnailUrl: Optional[str] = None
    videoName: Optional[str] = None
    videoSize: Optional[str] = None
    videoObjectUrl: Optional[str] = None
    videoDuration: Optional[str] = None
    videoResolution: Optional[str] = None
    videoFps: Optional[float] = None
    stats: IncidentStats
    detectedConditions: DetectedConditions
    overallCondition: OverallCondition
    keyObservations: List[str]
    reconstruction_glb_url: Optional[str] = None

class JobStatusResponse(BaseModel):
    incident_id: str
    status: str
    progress_pct: int
    current_stage: str
    error_message: Optional[str] = None
    stats: Optional[IncidentStats] = None
    completed: bool = False
