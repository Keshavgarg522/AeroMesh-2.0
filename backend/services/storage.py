import os
import re
import aiofiles
from fastapi import UploadFile, HTTPException, status
from backend.config import settings

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
ALLOWED_MIME_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
    "application/octet-stream"
}
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB

class StorageManager:
    def __init__(self, base_dir: str = settings.STORAGE_PATH):
        self.base_dir = os.path.abspath(base_dir)
        self.videos_dir = os.path.join(self.base_dir, "videos")
        self.frames_dir = os.path.join(self.base_dir, "frames")
        self.models_dir = os.path.join(self.base_dir, "models")
        self.reports_dir = os.path.join(self.base_dir, "reports")

        for d in [self.videos_dir, self.frames_dir, self.models_dir, self.reports_dir]:
            os.makedirs(d, exist_ok=True)

    def sanitize_filename(self, filename: str) -> str:
        # Keep only alphanumeric, dot, underscore, hyphen
        base = os.path.basename(filename)
        cleaned = re.sub(r'[^a-zA-Z0-9._-]', '_', base)
        return cleaned or "video.mp4"

    async def save_video(self, incident_id: str, file: UploadFile) -> tuple[str, int]:
        """
        Validates and saves the uploaded video.
        Returns (relative_file_path, file_size_bytes).
        """
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported video format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
            # Some browsers pass video/mp4 as application/octet-stream; checked above
            pass

        safe_name = f"{incident_id}_{self.sanitize_filename(file.filename or 'video.mp4')}"
        dest_path = os.path.join(self.videos_dir, safe_name)

        size = 0
        async with aiofiles.open(dest_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                size += len(chunk)
                if size > MAX_VIDEO_SIZE:
                    try:
                        os.remove(dest_path)
                    except OSError:
                        pass
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Uploaded video exceeds maximum allowed size (500 MB)"
                    )
                await out_file.write(chunk)

        if size == 0:
            try:
                os.remove(dest_path)
            except OSError:
                pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded video is empty (0 bytes)"
            )

        rel_path = os.path.relpath(dest_path, self.base_dir).replace("\\", "/")
        return rel_path, size

    def get_incident_frames_dir(self, incident_id: str) -> str:
        d = os.path.join(self.frames_dir, incident_id)
        os.makedirs(d, exist_ok=True)
        return d

    def get_model_path(self, incident_id: str) -> str:
        return os.path.join(self.models_dir, f"{incident_id}.glb")

    def get_report_path(self, incident_id: str) -> str:
        return os.path.join(self.reports_dir, f"{incident_id}_report.pdf")

    def get_absolute_path(self, rel_path: str) -> str:
        return os.path.abspath(os.path.join(self.base_dir, rel_path))

storage = StorageManager()
