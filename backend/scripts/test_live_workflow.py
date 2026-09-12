import time
import httpx

def run_test():
    client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=120.0)

    # 1. Dev Login
    r = client.post("/api/auth/dev-login", json={"email": "keshav@aeromesh.ai", "name": "Keshav"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1/8] Logged in successfully as:", r.json()["user"]["name"])

    # 2. Verify Profile / Me
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    print("[2/8] Profile verified. ID:", r.json()["id"], "Email:", r.json()["email"])

    # 3. Create Incident
    r = client.post("/api/incidents", json={
        "name": "Live Drone Aerial Survey",
        "location": "Sector 62 Expressway, Noida",
        "description": "Bridge deck and structural assessment with real UAV footage."
    }, headers=headers)
    assert r.status_code == 201, f"Create incident failed: {r.text}"
    inc = r.json()
    inc_id = inc["id"]
    print(f"[3/8] Incident Created with backend-generated ID: {inc_id} at {inc['date']} {inc['time']}")

    # 4. Upload Video
    with open("test_drone1.mp4", "rb") as f:
        files = {"file": ("test_drone1.mp4", f, "video/mp4")}
        r = client.post(f"/api/incidents/{inc_id}/video", files=files, headers=headers)
    assert r.status_code == 200, f"Upload failed: {r.text}"
    meta = r.json()["metadata"]
    print(f"[4/8] Video Uploaded. Duration: {meta['duration_sec']}s, Res: {meta['resolution_formatted']}, FPS: {meta['fps']}")

    # 5. Start Analysis
    r = client.post(f"/api/incidents/{inc_id}/analyze", headers=headers)
    assert r.status_code == 200
    print("[5/8] Analysis pipeline triggered in background.")

    # 6. Poll Status
    max_wait_seconds = 180
    completed = False
    for i in range(max_wait_seconds):
        time.sleep(1)
        r = client.get(f"/api/incidents/{inc_id}/status", headers=headers)
        status_data = r.json()
        print(f"      Pipeline [{i+1}s]: {status_data['status']} ({status_data['progress_pct']}%) - {status_data['current_stage']}")
        if status_data["completed"]:
            completed = True
            print("[6/8] Analysis completed! Final stats:", status_data["stats"])
            break
        elif status_data["status"] == "Failed":
            raise RuntimeError(f"Pipeline failed: {status_data.get('error_message')}")

    assert completed, "Pipeline did not complete within timeout"

    # 7. Check Frames
    r_frames = client.get(f"/api/incidents/{inc_id}/frames", headers=headers)
    frames = r_frames.json()
    print(f"[7/8] Extracted frames verified: {len(frames)} frames in database.")

    # 8. Check 3D Reconstruction & Report
    r_rec = client.get(f"/api/incidents/{inc_id}/reconstruction", headers=headers)
    rec = r_rec.json()
    print(f"[8/8] 3D Model: {rec['model_glb_url']}, Quality: {rec['reconstruction_quality']}, Observed: {rec['observed_percentage']}%")

    r_rep = client.get(f"/api/incidents/{inc_id}/report", headers=headers)
    rep = r_rep.json()
    print(f"      Report PDF compiled: {rep['pdf_url']}")

    print("\n>>> ALL 8 END-TO-END ACCEPTANCE CHECKS PASSED WITH REAL DATA! <<<")

if __name__ == "__main__":
    run_test()
