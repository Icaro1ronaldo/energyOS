import os
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic

router = APIRouter()

SYSTEM_PROMPT = """You are EnergyOS Assistant, an AI specialized in European energy markets.
You help users understand electricity prices, generation mix, and consumption patterns
across ENTSOE bidding zones: DE_LU (Germany/Luxembourg), FR (France), ES (Spain),
PT (Portugal), NL (Netherlands), BE (Belgium), AT (Austria), IT_NORTH (North Italy),
PL (Poland), FI (Finland), DK_1 (Denmark West).

The EnergyOS platform shows:
- Day-ahead electricity prices (€/MWh)
- Electricity consumption / load (MW, aggregated to GWh)
- Generation mix by source: solar, wind_onshore, wind_offshore, nuclear,
  hydro_run_of_river_and_poundage, hydro_water_reservoir, hydro_pumped_storage,
  biomass, geothermal, fossil_gas, fossil_hard_coal, fossil_brown_coal_lignite,
  fossil_oil, other_renewable, other
- All data is at 15-minute resolution from ENTSO-E

Be concise, accurate, and helpful. When discussing numbers, use appropriate units.
If the user asks something outside energy markets, politely redirect."""


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


def _get_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not configured on the server.",
        )
    return anthropic.Anthropic(api_key=api_key)


@router.post("/")
async def chat(request: ChatRequest):
    client = _get_client()

    def generate():
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps(text)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
