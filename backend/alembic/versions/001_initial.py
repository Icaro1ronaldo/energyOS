"""Initial schema with TimescaleDB hypertables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # energy_prices ─────────────────────────────────────────────────────────────
    op.create_table(
        "energy_prices",
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("bidding_zone", sa.String(20), nullable=False),
        sa.Column("is_forecast", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("price_eur_mwh", sa.Numeric(10, 4)),
        sa.PrimaryKeyConstraint("timestamp", "bidding_zone", "is_forecast"),
    )
    op.create_index("ix_energy_prices_zone_ts", "energy_prices", ["bidding_zone", "timestamp"])
    op.execute("SELECT create_hypertable('energy_prices', 'timestamp', if_not_exists => TRUE)")

    # energy_loads ──────────────────────────────────────────────────────────────
    op.create_table(
        "energy_loads",
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("bidding_zone", sa.String(20), nullable=False),
        sa.Column("is_forecast", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("load_mw", sa.Numeric(12, 2)),
        sa.PrimaryKeyConstraint("timestamp", "bidding_zone", "is_forecast"),
    )
    op.create_index("ix_energy_loads_zone_ts", "energy_loads", ["bidding_zone", "timestamp"])
    op.execute("SELECT create_hypertable('energy_loads', 'timestamp', if_not_exists => TRUE)")

    # energy_productions ────────────────────────────────────────────────────────
    op.create_table(
        "energy_productions",
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("bidding_zone", sa.String(20), nullable=False),
        sa.Column("production_type", sa.String(50), nullable=False),
        sa.Column("is_forecast", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("value_mw", sa.Numeric(12, 2)),
        sa.PrimaryKeyConstraint("timestamp", "bidding_zone", "production_type", "is_forecast"),
    )
    op.create_index(
        "ix_energy_productions_zone_type_ts",
        "energy_productions",
        ["bidding_zone", "production_type", "timestamp"],
    )
    op.execute("SELECT create_hypertable('energy_productions', 'timestamp', if_not_exists => TRUE)")

    # ml_model_registry ─────────────────────────────────────────────────────────
    op.create_table(
        "ml_model_registry",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("domain", sa.String(20), nullable=False),
        sa.Column("bidding_zone", sa.String(20), nullable=False),
        sa.Column("production_type", sa.String(50), nullable=True),
        sa.Column("s3_key", sa.Text, nullable=False),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_table("ml_model_registry")
    op.drop_table("energy_productions")
    op.drop_table("energy_loads")
    op.drop_table("energy_prices")
