"""
AeroMesh Authorized Rescuer Provisioning & Seed Script
======================================================
Authorized Rescuers must be administratively pre-provisioned.
Public registration is strictly disabled for rescuers.

Usage:
    # Seed default development & testing accounts
    python backend/scripts/seed_rescuers.py

    # Provision a custom authorized rescuer
    python backend/scripts/seed_rescuers.py --rescuer-id FIRE-002 \
        --name "Captain John Doe" \
        --password "SecurePass2026!" \
        --org "Fire & Rescue Department" \
        --dept "Engine Company 12" \
        --designation "Battalion Chief" \
        --role FIRE_RESCUER
"""

import os
import sys
import argparse
from datetime import datetime, timezone

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, init_db
from backend.models import AuthorizedRescuer
from backend.security import hash_password

DEFAULT_DEV_PASSWORD = os.getenv("TEST_RESCUER_PASSWORD", "Rescuer@AeroMesh2026!")

DEFAULT_TEST_RESCUERS = [
    {
        "rescuer_id": "FIRE-001",
        "name": "Captain Marcus Vance",
        "organization": "Fire & Rescue Department",
        "department": "Rapid Response Unit 4",
        "designation": "Senior Incident Commander",
        "role": "FIRE_RESCUER",
        "is_active": True,
    },
    {
        "rescuer_id": "POLICE-001",
        "name": "Lieutenant Sarah Jenkins",
        "organization": "Metropolitan Police Tactical Unit",
        "department": "Aerial Surveillance Division",
        "designation": "Tactical Drone Recon Lead",
        "role": "POLICE_RESCUER",
        "is_active": True,
    },
    {
        "rescuer_id": "SAR-001",
        "name": "Officer David Chen",
        "organization": "National Search & Rescue Force",
        "department": "Mountain & Wilderness Disaster Ops",
        "designation": "SAR Extraction Team Lead",
        "role": "SEARCH_RESCUE",
        "is_active": True,
    },
    {
        "rescuer_id": "DISASTER-001",
        "name": "Director Elena Rostova",
        "organization": "Emergency Disaster Management Agency",
        "department": "Crisis Coordination Directorate",
        "designation": "Emergency Operations Director",
        "role": "DISASTER_RESPONSE",
        "is_active": True,
    },
    {
        "rescuer_id": "INACTIVE-001",
        "name": "Officer Thomas Ray",
        "organization": "Fire & Rescue Department",
        "department": "Suspended Auxiliary Unit",
        "designation": "Inactive Officer",
        "role": "FIRE_RESCUER",
        "is_active": False,
    }
]

def seed_default_rescuers(password: str = DEFAULT_DEV_PASSWORD):
    init_db()
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    created_count = 0
    updated_count = 0

    try:
        for r_data in DEFAULT_TEST_RESCUERS:
            existing = db.query(AuthorizedRescuer).filter(
                AuthorizedRescuer.rescuer_id == r_data["rescuer_id"]
            ).first()

            if not existing:
                rescuer = AuthorizedRescuer(
                    rescuer_id=r_data["rescuer_id"],
                    name=r_data["name"],
                    organization=r_data["organization"],
                    department=r_data["department"],
                    designation=r_data["designation"],
                    password_hash=hash_password(password),
                    role=r_data["role"],
                    is_active=r_data["is_active"],
                    created_at=now,
                    updated_at=now
                )
                db.add(rescuer)
                created_count += 1
                print(f"[+] Provisioned rescuer: {r_data['rescuer_id']} - {r_data['name']} ({r_data['role']})")
            else:
                existing.password_hash = hash_password(password)
                existing.name = r_data["name"]
                existing.organization = r_data["organization"]
                existing.department = r_data["department"]
                existing.designation = r_data["designation"]
                existing.role = r_data["role"]
                existing.is_active = r_data["is_active"]
                existing.updated_at = now
                updated_count += 1
                print(f"[*] Updated existing rescuer: {r_data['rescuer_id']}")

        db.commit()
        print(f"\nRescuer Provisioning Complete: {created_count} created, {updated_count} updated.")
        print(f"Default Development Password used: {password}")
    finally:
        db.close()

def provision_custom_rescuer(
    rescuer_id: str,
    name: str,
    password: str,
    org: str,
    dept: str,
    designation: str,
    role: str,
    is_active: bool = True
):
    init_db()
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    try:
        clean_id = rescuer_id.strip()
        existing = db.query(AuthorizedRescuer).filter(
            AuthorizedRescuer.rescuer_id == clean_id
        ).first()

        if existing:
            existing.name = name
            existing.password_hash = hash_password(password)
            existing.organization = org
            existing.department = dept
            existing.designation = designation
            existing.role = role
            existing.is_active = is_active
            existing.updated_at = now
            print(f"[*] Updated rescuer {clean_id}")
        else:
            new_r = AuthorizedRescuer(
                rescuer_id=clean_id,
                name=name,
                organization=org,
                department=dept,
                designation=designation,
                password_hash=hash_password(password),
                role=role,
                is_active=is_active,
                created_at=now,
                updated_at=now
            )
            db.add(new_r)
            print(f"[+] Successfully provisioned new rescuer: {clean_id} ({name})")

        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AeroMesh Authorized Rescuer Provisioning")
    parser.add_argument("--rescuer-id", type=str, help="Unique Rescuer ID (e.g. FIRE-002)")
    parser.add_argument("--name", type=str, help="Full name of responder")
    parser.add_argument("--password", type=str, help="Secure password")
    parser.add_argument("--org", type=str, default="Fire & Rescue Department", help="Organization")
    parser.add_argument("--dept", type=str, default="Emergency Response", help="Department")
    parser.add_argument("--designation", type=str, default="Incident Responder", help="Designation")
    parser.add_argument("--role", type=str, default="AUTHORIZED_RESCUER", help="Role (e.g. FIRE_RESCUER, SEARCH_RESCUE)")
    parser.add_argument("--inactive", action="store_true", help="Provision as inactive")

    args = parser.parse_args()

    if args.rescuer_id and args.name and args.password:
        provision_custom_rescuer(
            rescuer_id=args.rescuer_id,
            name=args.name,
            password=args.password,
            org=args.org,
            dept=args.dept,
            designation=args.designation,
            role=args.role,
            is_active=not args.inactive
        )
    else:
        seed_default_rescuers()
