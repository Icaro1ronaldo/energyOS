#!/usr/bin/env bash
# EnergyOS dev environment setup
# Runs once after the Dev Container / Codespace is created.
set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EnergyOS — environment setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"

# ── 1. Install uv ─────────────────────────────────────────────────────────────
echo ""
echo "▸ Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh
# Make uv available for the rest of this script
export PATH="$HOME/.local/bin:$PATH"
echo "  ✓ uv $(uv --version)"

# ── 2. Python virtual environment + dependencies ──────────────────────────────
echo ""
echo "▸ Creating virtual environment (backend/.venv, Python 3.11)..."
uv venv "$WORKSPACE/backend/.venv" --python 3.11

echo "▸ Installing Python dependencies..."
uv pip install \
  ruff pytest httpx \
  -r "$WORKSPACE/backend/requirements.txt" \
  --python "$WORKSPACE/backend/.venv/bin/python"

echo "  ✓ Python deps installed"

# ── 3. Node / frontend ────────────────────────────────────────────────────────
echo ""
echo "▸ Installing frontend npm dependencies..."
cd "$WORKSPACE/frontend"
npm ci --silent
echo "  ✓ npm deps installed"

# ── 4. Copy .env if not present ───────────────────────────────────────────────
echo ""
cd "$WORKSPACE"
if [ ! -f .env ]; then
  cp .env .env
  echo "  ✓ .env created from .env — fill in your ENTSOE_TOKEN and AWS credentials"
else
  echo "  ✓ .env already exists, skipping"
fi

# ── 5. Terraform init ─────────────────────────────────────────────────────────
echo ""
echo "▸ Initialising Terraform..."
if command -v terraform &>/dev/null; then
  cd "$WORKSPACE/infra"
  terraform init -backend=false -input=false -no-color -upgrade 2>&1 | tail -5
  echo "  ✓ Terraform initialised"
  cd "$WORKSPACE"
else
  echo "  ⚠ terraform not found, skipping"
fi

# ── 6. Pre-pull Docker images in the background ───────────────────────────────
echo ""
echo "▸ Pre-pulling Docker images (background)..."
docker compose pull --quiet &>/dev/null &
echo "  ✓ Pull started in background"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup complete. Next steps:"
echo ""
echo "  1. Add your secrets to .env"
echo "  2. docker compose up --build"
echo "  3. docker compose exec backend alembic upgrade head"
echo "  4. (optional) trigger a backfill:"
echo "     docker compose exec celery_worker celery -A app.workers.celery_app \\"
echo "       call app.workers.backfill.run_backfill"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
