"""create_users_and_authorized_rescuers_tables

Revision ID: 9bb41eec25b3
Revises: 
Create Date: 2026-10-01 16:46:42.693325

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '9bb41eec25b3'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    # 1. users table
    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=True),
            sa.Column("role", sa.String(length=64), nullable=False, server_default="GENERAL_USER"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("google_id", sa.String(length=128), nullable=True),
            sa.Column("profile_image", sa.String(length=1024), nullable=True),
            sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=True)
        op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)
    else:
        # Verify columns exist
        cols = [c["name"] for c in inspector.get_columns("users")]
        if "password_hash" not in cols:
            op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
        if "role" not in cols:
            op.add_column("users", sa.Column("role", sa.String(length=64), nullable=False, server_default="GENERAL_USER"))
        if "is_active" not in cols:
            op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
        if "updated_at" not in cols:
            op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    # 2. authorized_rescuers table
    if "authorized_rescuers" not in existing_tables:
        op.create_table(
            "authorized_rescuers",
            sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
            sa.Column("rescuer_id", sa.String(length=64), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("organization", sa.String(length=255), nullable=False),
            sa.Column("department", sa.String(length=255), nullable=False),
            sa.Column("designation", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("role", sa.String(length=64), nullable=False, server_default="AUTHORIZED_RESCUER"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_authorized_rescuers_rescuer_id", "authorized_rescuers", ["rescuer_id"], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    if "authorized_rescuers" in existing_tables:
        op.drop_table("authorized_rescuers")
    if "users" in existing_tables:
        op.drop_table("users")
