import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ...core.config import settings

router = APIRouter()

CHANNELS = ["energyos:prices", "energyos:load", "energyos:production"]


@router.websocket("/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()

    r = aioredis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(*CHANNELS)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"].decode())
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(*CHANNELS)
        await r.aclose()
