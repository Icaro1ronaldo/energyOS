import numpy as np
import pandas as pd
import lightgbm as lgb
from dataclasses import dataclass


@dataclass
class LGBMForecast:
    """Container for the three quantile models (p10, p50, p90)."""
    model_p10: lgb.Booster
    model_p50: lgb.Booster
    model_p90: lgb.Booster
    last_known: pd.DataFrame  # tail of training data needed for lag generation


_FEATURE_COLS = ["hour", "dayofweek", "month", "lag_24", "lag_48", "lag_168", "roll_24_mean"]


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["hour"] = df["ds"].dt.hour
    df["dayofweek"] = df["ds"].dt.dayofweek
    df["month"] = df["ds"].dt.month
    df["lag_24"] = df["y"].shift(24)
    df["lag_48"] = df["y"].shift(48)
    df["lag_168"] = df["y"].shift(168)
    df["roll_24_mean"] = df["y"].shift(1).rolling(24).mean()
    return df.dropna()


def _lgb_params(alpha: float) -> dict:
    return {
        "objective": "quantile",
        "alpha": alpha,
        "metric": "quantile",
        "num_leaves": 63,
        "learning_rate": 0.05,
        "num_iterations": 100,
        "verbosity": -1,
    }


def train(df: pd.DataFrame) -> LGBMForecast:
    """
    Fit three LightGBM quantile models (p10, p50, p90) on historical data.

    Args:
        df: DataFrame with columns 'ds' (datetime) and 'y' (numeric value).

    Returns:
        Fitted LGBMForecast container.
    """
    df = df.sort_values("ds").reset_index(drop=True)
    feat = _build_features(df)

    X = feat[_FEATURE_COLS]
    y = feat["y"]
    dataset = lgb.Dataset(X, label=y, free_raw_data=False)

    m10 = lgb.train(_lgb_params(0.1), dataset)
    m50 = lgb.train(_lgb_params(0.5), dataset)
    m90 = lgb.train(_lgb_params(0.9), dataset)

    return LGBMForecast(
        model_p10=m10,
        model_p50=m50,
        model_p90=m90,
        last_known=df.tail(200).reset_index(drop=True),
    )


def generate_hindcast(model: LGBMForecast, n_days: int = 7) -> pd.DataFrame:
    """
    Generate in-sample predictions for the last n_days of known data using
    actual lag values (non-recursive, vectorised).  These are stored as
    forecast rows so the chart can overlay model fit against actuals.

    Returns:
        DataFrame with columns: ds, yhat, yhat_lower, yhat_upper.
    """
    feat = _build_features(model.last_known)
    tail = feat.tail(n_days * 24)
    if tail.empty:
        return pd.DataFrame(columns=["ds", "yhat", "yhat_lower", "yhat_upper"])

    X = tail[_FEATURE_COLS].values
    return pd.DataFrame({
        "ds":          tail["ds"].values,
        "yhat":        np.maximum(0, model.model_p50.predict(X)),
        "yhat_lower":  np.maximum(0, model.model_p10.predict(X)),
        "yhat_upper":  np.maximum(0, model.model_p90.predict(X)),
    })


def generate_forecast(model: LGBMForecast, horizon_hours: int) -> pd.DataFrame:
    """
    Generate a forward-looking forecast for the next horizon_hours using
    recursive lag filling so each step uses the previous p50 prediction.

    Returns:
        DataFrame with columns: ds, yhat, yhat_lower, yhat_upper.
    """
    # Keep a rolling numpy buffer of the last 200 values for fast lag access
    history = model.last_known.copy()
    last_ts = history["ds"].iloc[-1]
    y_buf = list(history["y"].values)  # extend as we predict

    future_ts = [last_ts + pd.Timedelta(hours=h) for h in range(1, horizon_hours + 1)]
    yhats, lowers, uppers = [], [], []

    for ts in future_ts:
        hour = ts.hour
        dow = ts.dayofweek
        month = ts.month
        lag_24 = y_buf[-24] if len(y_buf) >= 24 else np.nan
        lag_48 = y_buf[-48] if len(y_buf) >= 48 else np.nan
        lag_168 = y_buf[-168] if len(y_buf) >= 168 else np.nan
        roll_24 = float(np.mean(y_buf[-25:-1])) if len(y_buf) >= 25 else np.nan

        X = np.array([[hour, dow, month, lag_24, lag_48, lag_168, roll_24]])

        yhat = float(model.model_p50.predict(X)[0])
        yhat_lower = float(model.model_p10.predict(X)[0])
        yhat_upper = float(model.model_p90.predict(X)[0])

        yhat = max(0.0, yhat)
        y_buf.append(yhat)
        yhats.append(yhat)
        lowers.append(max(0.0, yhat_lower))
        uppers.append(max(0.0, yhat_upper))

    return pd.DataFrame({"ds": future_ts, "yhat": yhats, "yhat_lower": lowers, "yhat_upper": uppers})
