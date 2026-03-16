from fastapi import APIRouter, BackgroundTasks
from ...workers.ml_forecast import run_all_forecasts

router = APIRouter()


@router.post("/run", status_code=202)
async def trigger_forecast(background_tasks: BackgroundTasks):
    """
    Immediately retrain all ML models and write fresh hindcast + forward
    forecasts to the database.  Returns 202 at once; the job runs in the
    background (same process, no Celery required).
    """
    background_tasks.add_task(run_all_forecasts)
    return {"status": "accepted", "message": "Forecast job started in background"}
