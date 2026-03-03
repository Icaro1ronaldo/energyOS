import pandas as pd
from prophet import Prophet


def train(df: pd.DataFrame) -> Prophet:
    """
    Fit a Prophet model on historical data.

    Args:
        df: DataFrame with columns 'ds' (datetime) and 'y' (numeric value).

    Returns:
        Fitted Prophet model.
    """
    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=True,
        yearly_seasonality=True,
        changepoint_prior_scale=0.05,
    )
    model.fit(df)
    return model


def generate_forecast(model: Prophet, horizon_hours: int) -> pd.DataFrame:
    """
    Generate a forward-looking forecast for the next horizon_hours.

    Returns:
        DataFrame with columns: ds, yhat, yhat_lower, yhat_upper.
    """
    future = model.make_future_dataframe(
        periods=horizon_hours, freq="h", include_history=False
    )
    forecast = model.predict(future)
    return forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]]
