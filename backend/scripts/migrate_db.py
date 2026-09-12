"""
AeroMesh Database Migration Script
Run whenever SQLAlchemy models are updated to sync the SQLite schema.

Usage:
    python backend/scripts/migrate_db.py
"""
import sqlite3
import os
import sys

DB_PATH = "aeromesh.db"

MIGRATIONS = [
    # (table, column_name, column_definition)
    ("reconstruction_results", "registered_image_count", "INTEGER DEFAULT 0"),
    ("reconstruction_results", "mesh_vertex_count", "INTEGER DEFAULT 0"),
    ("reconstruction_results", "mesh_face_count", "INTEGER DEFAULT 0"),
    ("reconstruction_results", "processing_time_sec", "REAL DEFAULT 0.0"),
    ("reconstruction_results", "failure_reason", "TEXT"),
    ("reconstruction_results", "diagnostic_data", "TEXT"),
    ("reconstruction_cameras", "focal_length", "REAL"),
    ("reconstruction_cameras", "cx", "REAL"),
    ("reconstruction_cameras", "cy", "REAL"),
]

def run_migrations():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    applied = 0
    skipped = 0

    for table, col_name, col_def in MIGRATIONS:
        cur.execute(f"PRAGMA table_info({table})")
        existing_cols = {r[1] for r in cur.fetchall()}

        if col_name not in existing_cols:
            sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"
            print(f"  APPLY: {sql}")
            cur.execute(sql)
            applied += 1
        else:
            skipped += 1

    conn.commit()
    conn.close()
    print(f"\nMigration complete: {applied} column(s) added, {skipped} already existed.")


if __name__ == "__main__":
    run_migrations()
