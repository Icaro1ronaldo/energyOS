import json
import redis
from ..core.config import settings

CHANNEL_PRICES = "energyos:prices"
CHANNEL_LOAD = "energyos:load"
CHANNEL_PRODUCTION = "energyos:production"

_client: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.redis_url)
    return _client


def publish(channel: str, payload: dict) -> None:
    _get_redis().publish(channel, json.dumps(payload, default=str))
