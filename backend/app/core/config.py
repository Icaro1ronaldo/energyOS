from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://energyos:energyos@localhost:5432/energyos"
    database_sync_url: str = "postgresql+psycopg2://energyos:energyos@localhost:5432/energyos"
    redis_url: str = "redis://localhost:6379/0"

    entsoe_token: str = ""

    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "eu-west-1"
    s3_bucket: str = "energyos-models"

    bidding_zones: str = "DE_LU,FR,ES,PT,NL,BE"
    forecast_horizon_hours: int = 48

    @property
    def bidding_zones_list(self) -> list[str]:
        return [z.strip() for z in self.bidding_zones.split(",")]

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
