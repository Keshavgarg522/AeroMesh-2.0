import os
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend.models import User, Incident

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    # Clean up can occur here if needed

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "AeroMesh" in data["service"]

def test_auth_and_user_isolation():
    # 1. Login User A
    res_a = client.post("/api/auth/dev-login", json={
        "email": "user_a@aeromesh.ai",
        "name": "Analyst Alice"
    })
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Login User B
    res_b = client.post("/api/auth/dev-login", json={
        "email": "user_b@aeromesh.ai",
        "name": "Analyst Bob"
    })
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. User A creates an incident
    inc_payload = {
        "name": "Alice Bridge Inspection",
        "location": "Sector 62, Noida",
        "description": "Aerial drone scan of western approach"
    }
    create_res = client.post("/api/incidents", json=inc_payload, headers=headers_a)
    assert create_res.status_code == 201
    incident_a = create_res.json()
    assert incident_a["id"].startswith("AM-")
    assert incident_a["name"] == "Alice Bridge Inspection"
    assert incident_a["date"] is not None
    assert incident_a["time"] is not None

    # 4. User A sees their incident in history
    list_res_a = client.get("/api/incidents", headers=headers_a)
    assert list_res_a.status_code == 200
    ids_a = [inc["id"] for inc in list_res_a.json()]
    assert incident_a["id"] in ids_a

    # 5. STRICT USER ISOLATION: User B MUST NOT see User A's incident in history
    list_res_b = client.get("/api/incidents", headers=headers_b)
    assert list_res_b.status_code == 200
    ids_b = [inc["id"] for inc in list_res_b.json()]
    assert incident_a["id"] not in ids_b

    # 6. STRICT USER ISOLATION: User B attempting to directly access User A's incident returns 404
    direct_res_b = client.get(f"/api/incidents/{incident_a['id']}", headers=headers_b)
    assert direct_res_b.status_code == 404

    # 7. Unauthenticated request returns 401
    unauth_res = client.get(f"/api/incidents/{incident_a['id']}")
    assert unauth_res.status_code == 401

def test_custom_markings_crud():
    # Login user
    res = client.post("/api/auth/dev-login", json={
        "email": "marking_tester@aeromesh.ai",
        "name": "Marking Tester"
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create incident
    inc_res = client.post("/api/incidents", json={
        "name": "Marking Test Incident",
        "location": "Test Site",
        "description": "Testing custom markings"
    }, headers=headers)
    inc_id = inc_res.json()["id"]

    # Add custom marking
    marking_payload = {
        "name": "Landing Zone Alpha",
        "type": "Custom",
        "color": "#00d2ff",
        "description": "Primary UAV recovery pad",
        "position": [1.5, 1.2, -0.5]
    }
    m_res = client.post(f"/api/incidents/{inc_id}/markings", json=marking_payload, headers=headers)
    assert m_res.status_code == 201
    mark_data = m_res.json()
    assert mark_data["name"] == "Landing Zone Alpha"
    assert mark_data["position"] == [1.5, 1.2, -0.5]
    assert mark_data["isSystem"] is False

    # List markings
    list_m = client.get(f"/api/incidents/{inc_id}/markings", headers=headers)
    assert list_m.status_code == 200
    assert len(list_m.json()) == 1

    # Update position
    up_res = client.put(f"/api/incidents/markings/{mark_data['id']}/position", json={
        "position": [2.0, 1.2, 0.0]
    }, headers=headers)
    assert up_res.status_code == 200
    assert up_res.json()["position"] == [2.0, 1.2, 0.0]

    # Delete marking
    del_res = client.delete(f"/api/incidents/markings/{mark_data['id']}", headers=headers)
    assert del_res.status_code == 204
