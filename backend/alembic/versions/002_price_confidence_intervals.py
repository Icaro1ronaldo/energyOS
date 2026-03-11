"""Add price confidence interval columns

Revision ID: 002
Revises: 001
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("energy_prices", sa.Column("price_lower_eur_mwh", sa.Numeric(10, 4), nullable=True))
    op.add_column("energy_prices", sa.Column("price_upper_eur_mwh", sa.Numeric(10, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("energy_prices", "price_upper_eur_mwh")
    op.drop_column("energy_prices", "price_lower_eur_mwh")
