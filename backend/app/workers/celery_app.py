from celery import Celery
from celery.schedules import crontab
from ..core.config import settings

app = Celery(
    "energyos",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.ingestion",
        "app.workers.backfill",
        "app.workers.ml_forecast",
    ],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.ingestion.*": {"queue": "default"},
        "app.workers.backfill.*": {"queue": "default"},
        "app.workers.ml_forecast.*": {"queue": "ml"},
    },
    beat_schedule={
        # Fetch fresh actuals every 15 minutes
        "ingest-actuals-every-15-min": {
            "task": "app.workers.ingestion.ingest_all",
            "schedule": crontab(minute="*/15"),
        },
        # Retrain ML models and write new forecasts daily at 02:00 UTC
        "ml-forecast-daily": {
            "task": "app.workers.ml_forecast.run_all_forecasts",
            "schedule": crontab(hour="2", minute="0"),
        },
    },
)
