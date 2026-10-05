"""
Test Real Authentication & RBAC System for AeroMesh
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.scripts.seed_rescuers import seed_default_rescuers

client = TestClient(app)

def setup_module():
    seed_default_rescuers()

def test_general_user_signup_and_login():
    email = f"testuser_{int(pytest.importorskip('time').time())}@example.com"
    password = "StrongPassword2026!"
    name = "Test Pilot"

    # 1. Signup
    res = client.post("/api/auth/register", json={
        "name": name,
        "email": email,
        "password": password
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "GENERAL_USER"
    assert data["user"]["user_type"] == "general"
    token = data["access_token"]

    # 2. Duplicate signup should fail
    dup = client.post("/api/auth/register", json={
        "name": name,
        "email": email,
        "password": password
    })
    assert dup.status_code in (400, 409)
    assert "already exists" in dup.json()["detail"]

    # 3. Login with wrong password
    wrong_pw = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword!"
    })
    assert wrong_pw.status_code == 401
    assert "Invalid email or password" in wrong_pw.json()["detail"]

    # 4. Login with correct password
    good_login = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert good_login.status_code == 200
    assert good_login.json()["user"]["role"] == "GENERAL_USER"

    # 5. Get current user (/me)
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

def test_authorized_rescuer_auth():
    # 1. Valid Rescuer Login
    res = client.post("/api/auth/rescuer/login", json={
        "rescuer_id": "FIRE-001",
        "password": "Rescuer@AeroMesh2026!"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["user"]["rescuer_id"] == "FIRE-001"
    assert data["user"]["role"] == "FIRE_RESCUER"
    assert data["user"]["user_type"] == "rescuer"
    assert data["user"]["organization"] == "Fire & Rescue Department"
    assert data["user"]["department"] == "Rapid Response Unit 4"
    assert data["user"]["designation"] == "Senior Incident Commander"
    rescuer_token = data["access_token"]

    # 2. Rescuer Wrong password
    wrong_res = client.post("/api/auth/rescuer/login", json={
        "rescuer_id": "FIRE-001",
        "password": "BadPassword123"
    })
    assert wrong_res.status_code == 401
    assert "Invalid rescuer ID or password" in wrong_res.json()["detail"]

    # 3. Inactive Rescuer
    inactive_res = client.post("/api/auth/rescuer/login", json={
        "rescuer_id": "INACTIVE-001",
        "password": "Rescuer@AeroMesh2026!"
    })
    assert inactive_res.status_code == 403
    assert "currently inactive" in inactive_res.json()["detail"]

    # 4. Rescuer /me
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {rescuer_token}"})
    assert me.status_code == 200
    assert me.json()["rescuer_id"] == "FIRE-001"

def test_rbac_and_data_isolation():
    # Create General User A
    user_a_email = f"usera_{int(pytest.importorskip('time').time())}@example.com"
    res_a = client.post("/api/auth/register", json={
        "name": "User Alpha",
        "email": user_a_email,
        "password": "Password123!"
    })
    token_a = res_a.json()["access_token"]

    # Create General User B
    user_b_email = f"userb_{int(pytest.importorskip('time').time())}@example.com"
    res_b = client.post("/api/auth/register", json={
        "name": "User Bravo",
        "email": user_b_email,
        "password": "Password123!"
    })
    token_b = res_b.json()["access_token"]

    # Rescuer token
    res_r = client.post("/api/auth/rescuer/login", json={
        "rescuer_id": "FIRE-001",
        "password": "Rescuer@AeroMesh2026!"
    })
    token_r = res_r.json()["access_token"]

    # User A creates an incident
    inc_a = client.post("/api/incidents", json={
        "name": "Warehouse Structural Hazard",
        "location": "Sector 7G, Harbor District",
        "description": "Roof collapse risk detected"
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert inc_a.status_code == 201, inc_a.text
    inc_id = inc_a.json()["id"]

    # User A can view own incident
    get_a = client.get(f"/api/incidents/{inc_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert get_a.status_code == 200

    # User B CANNOT view User A's incident (User isolation!)
    get_b = client.get(f"/api/incidents/{inc_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert get_b.status_code == 404

    # User B listing incidents does not see User A's incident
    list_b = client.get("/api/incidents", headers={"Authorization": f"Bearer {token_b}"})
    ids_b = [x["id"] for x in list_b.json()]
    assert inc_id not in ids_b

    # RBAC: General User A cannot call tactical dispatch (Rescuer only!)
    dispatch_forbidden = client.post(
        f"/api/incidents/{inc_id}/tactical-dispatch",
        json={"team_callsign": "Rescue-1", "priority": "CRITICAL"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert dispatch_forbidden.status_code == 403
    assert "Authorized Rescuer" in dispatch_forbidden.json()["detail"]

    # Rescuer CAN access and dispatch tactical team
    dispatch_ok = client.post(
        f"/api/incidents/{inc_id}/tactical-dispatch",
        json={"team_callsign": "Fire-Alpha", "priority": "CRITICAL"},
        headers={"Authorization": f"Bearer {token_r}"}
    )
    assert dispatch_ok.status_code == 200
    assert dispatch_ok.json()["status"] == "DISPATCHED"
    assert dispatch_ok.json()["rescuer_id"] == "FIRE-001"
    print("All tests passed successfully!")

if __name__ == "__main__":
    setup_module()
    print("Running test_general_user_signup_and_login...")
    test_general_user_signup_and_login()
    print("Running test_authorized_rescuer_auth...")
    test_authorized_rescuer_auth()
    print("Running test_rbac_and_data_isolation...")
    test_rbac_and_data_isolation()
    print("ALL TESTS PASSED!")
