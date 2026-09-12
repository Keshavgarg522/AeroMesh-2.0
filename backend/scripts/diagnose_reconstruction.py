import os
import sys
import shutil
import sqlite3
import tempfile
import cv2
import numpy as np
import pycolmap

def diagnose(video_path="test_drone1.mp4", max_frames=30):
    print("=== AEROMESH RECONSTRUCTION DIAGNOSTIC ===", flush=True)
    print(f"Video: {video_path}", flush=True)
    
    if not os.path.exists(video_path):
        print(f"ERROR: Video {video_path} not found.", flush=True)
        return

    # 1. Video Inspection
    cap = cv2.VideoCapture(video_path)
    total_source_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = float(cap.get(cv2.CAP_PROP_FPS)) or 12.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_sec = total_source_frames / fps if fps > 0 else 0
    cap.release()

    print(f"Duration: {duration_sec:.2f}s", flush=True)
    print(f"Resolution: {width}x{height}", flush=True)
    print(f"FPS: {fps}", flush=True)
    print(f"Source frames: {total_source_frames}", flush=True)

    temp_dir = tempfile.mkdtemp(prefix="aeromesh_diag_")
    images_dir = os.path.join(temp_dir, "images")
    database_path = os.path.join(temp_dir, "database.db")
    output_dir = os.path.join(temp_dir, "sparse")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    try:
        # 2. Extract frames
        cap = cv2.VideoCapture(video_path)
        step = max(1, total_source_frames // max_frames)
        frame_indices = [min(i * step, total_source_frames - 1) for i in range(max_frames)]
        
        extracted_paths = []
        blur_scores = []
        
        for idx, f_idx in enumerate(frame_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue
            
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            blur = cv2.Laplacian(gray, cv2.CV_64F).var()
            blur_scores.append(blur)
            
            img_name = f"image_{idx:04d}.jpg"
            img_path = os.path.join(images_dir, img_name)
            cv2.imwrite(img_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            extracted_paths.append((img_name, img_path, f_idx / fps, blur))
            
        cap.release()
        
        print(f"\nExtracted frames: {len(extracted_paths)}", flush=True)
        usable_frames = [p for p in extracted_paths if p[3] > 10.0]
        print(f"Usable frames: {len(usable_frames)}", flush=True)
        print(f"Rejected frames: {len(extracted_paths) - len(usable_frames)}", flush=True)
        print(f"Average blur score (sharpness): {np.mean(blur_scores):.1f}", flush=True)

        # 3. pycolmap Feature Extraction
        print("\n--- Running Feature Extraction ---", flush=True)
        reader_opts = pycolmap.ImageReaderOptions()
        reader_opts.camera_model = "SIMPLE_RADIAL"
        
        pycolmap.extract_features(
            database_path=database_path,
            image_path=images_dir,
            camera_mode=pycolmap.CameraMode.SINGLE,
            reader_options=reader_opts
        )

        # Inspect database
        conn = sqlite3.connect(database_path)
        cur = conn.cursor()
        
        cur.execute("SELECT image_id, name, rows FROM keypoints JOIN images USING(image_id)")
        kp_rows = cur.fetchall()
        feat_counts = [r[2] for r in kp_rows]
        print(f"Features extracted across {len(feat_counts)} images:", flush=True)
        if feat_counts:
            print(f"  Average features/frame: {np.mean(feat_counts):.1f}", flush=True)
            print(f"  Min features: {np.min(feat_counts)}, Max features: {np.max(feat_counts)}", flush=True)
        else:
            print("  NO FEATURES EXTRACTED!", flush=True)

        # 4. Feature Matching
        print("\n--- Running Feature Matching ---", flush=True)
        pairing_opt = pycolmap.SequentialPairingOptions()
        pairing_opt.overlap = 10
        pairing_opt.loop_detection = False
        
        pycolmap.match_sequential(
            database_path=database_path,
            pairing_options=pairing_opt
        )

        cur.execute("SELECT pair_id, rows FROM matches")
        matches_rows = cur.fetchall()
        print(f"Total raw matched image pairs: {len(matches_rows)}", flush=True)

        cur.execute("SELECT pair_id, rows FROM two_view_geometries WHERE rows > 0")
        geom_rows = cur.fetchall()
        geom_counts = [r[1] for r in geom_rows]
        print(f"Verified two-view geometric pairs: {len(geom_rows)}", flush=True)
        if geom_counts:
            print(f"  Average inlier matches per verified pair: {np.mean(geom_counts):.1f}", flush=True)
            print(f"  Max inliers: {np.max(geom_counts)}, Min inliers: {np.min(geom_counts)}", flush=True)
        else:
            print("  WARNING: 0 verified two-view geometric pairs found with sequential matcher!", flush=True)

        # Also try exhaustive if geometric pairs are low
        if len(geom_rows) < 10:
            print("Running exhaustive matching to maximize multi-view connections...", flush=True)
            exh_pairing = pycolmap.ExhaustivePairingOptions()
            pycolmap.match_exhaustive(
                database_path=database_path,
                pairing_options=exh_pairing
            )
            cur.execute("SELECT pair_id, rows FROM two_view_geometries WHERE rows > 0")
            geom_rows = cur.fetchall()
            geom_counts = [r[1] for r in geom_rows]
            print(f"After exhaustive matching - Verified geometric pairs: {len(geom_rows)}", flush=True)
            if geom_counts:
                print(f"  Average inliers: {np.mean(geom_counts):.1f}, Max: {np.max(geom_counts)}", flush=True)

        conn.close()

        # 5. Incremental Mapping
        print("\n--- Running Incremental Mapping ---", flush=True)
        mapper_options = pycolmap.IncrementalPipelineOptions()
        mapper_options.min_num_matches = 15
        
        # Aerial / drone specific tuning:
        mapper_options.mapper.init_min_tri_angle = 3.0       # Standard for UAV/drone video (was 16.0!)
        mapper_options.mapper.init_min_num_inliers = 30      # Drone keyframes have ~40-80 inliers (was 100!)
        mapper_options.mapper.abs_pose_min_num_inliers = 15  # For incremental registration (was 30!)
        mapper_options.mapper.filter_min_tri_angle = 1.0     # Preserve real 3D points
        mapper_options.triangulation.min_angle = 1.0
        mapper_options.mapper.init_max_forward_motion = 0.98 # Support drone forward flight
        
        reconstructions = pycolmap.incremental_mapping(
            database_path=database_path,
            image_path=images_dir,
            output_path=output_dir,
            options=mapper_options
        )

        print(f"Reconstructions returned type: {type(reconstructions)}, count: {len(reconstructions) if reconstructions else 0}", flush=True)
        if reconstructions:
            for k, rec in reconstructions.items():
                print(f"\n[Reconstruction key={k}]", flush=True)
                print(f"  Registered images: {rec.num_reg_images()} / {len(extracted_paths)}", flush=True)
                print(f"  3D points: {rec.num_points3D()}", flush=True)
                if rec.num_points3D() > 0:
                    mean_track_len = np.mean([len(p.track.elements) for p in rec.points3D.values()])
                    print(f"  Mean track length: {mean_track_len:.2f}", flush=True)
        else:
            print("No reconstruction converged with current settings.", flush=True)

    except Exception as e:
        print(f"\nEXCEPTION DURING DIAGNOSIS: {e}", flush=True)
        import traceback
        traceback.print_exc()

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    video = sys.argv[1] if len(sys.argv) > 1 else "test_drone1.mp4"
    diagnose(video)
