"""
Quick standalone test of the new OpenCV SfM reconstruction pipeline.
Run from the AeroMesh root:
    python backend/scripts/test_reconstruction.py
"""
import os
import sys
import glob

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.reconstruction_service import reconstruction_service

INCIDENT_ID = "AM-2026-000003"
frames_dir = os.path.join("storage", "frames", INCIDENT_ID)
frame_paths = sorted(glob.glob(os.path.join(frames_dir, "frame_*.jpg")))

print(f"Found {len(frame_paths)} frames in {frames_dir}")

if len(frame_paths) < 2:
    print("ERROR: Not enough frames. Run an analysis first.")
    sys.exit(1)

frame_records = [
    {"abs_image_path": p, "frame_number": i + 1}
    for i, p in enumerate(frame_paths)
]

result = reconstruction_service.run_reconstruction(INCIDENT_ID, frame_records)

print("\n=== Reconstruction Result ===")
for key, val in result.items():
    if key not in ("cameras", "diagnostics"):
        print(f"  {key}: {val}")

diag = result.get("diagnostics", {})
print("\n=== Diagnostics ===")
for key, val in diag.items():
    print(f"  {key}: {val}")

print(f"\n=== Camera poses ({len(result['cameras'])} total) ===")
for cam in result["cameras"][:5]:
    print(f"  frame {cam['frame_number']}: tx={cam['tx']:.3f} ty={cam['ty']:.3f} tz={cam['tz']:.3f}")

glb_path = os.path.join("storage", "models", f"{INCIDENT_ID}.glb")
if os.path.exists(glb_path):
    size = os.path.getsize(glb_path)
    print(f"\nGLB written: {glb_path} ({size:,} bytes)")
else:
    print("\nWARNING: GLB file was not created!")
