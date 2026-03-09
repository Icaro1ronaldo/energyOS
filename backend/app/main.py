from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1 import prices, load, production, chat
from .api.ws import live

app = FastAPI(title="EnergyOS API", version="1.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prices.router, prefix="/api/v1/prices", tags=["prices"])
app.include_router(load.router, prefix="/api/v1/load", tags=["load"])
app.include_router(production.router, prefix="/api/v1/production", tags=["production"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(live.router, prefix="/ws", tags=["websocket"])


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
