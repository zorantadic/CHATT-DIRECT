from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# -------------------------------------------------
# CORS (browser/Electron dev) — bez kredencijala
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # omogućava localhost + SWA + electron file/app scheme
    allow_credentials=False,      # MUST be False when allow_origins=["*"]
    allow_methods=["*"],          # POST/OPTIONS/GET...
    allow_headers=["*"],          # Content-Type, Authorization, itd.
)

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from uuid import uuid4
from typing import Optional

from .sessions import get_session
from .commands import register_control_ws, unregister_control_ws, send_to_realtime
from .agent1_client import get_agent1_client
from .models import TranscriptIn, TurnDoneIn

agent1 = get_agent1_client()
router = APIRouter()


# -------------------------------------------------------------------
# CENTRALNA POMOĆNA FUNKCIJA: DISPATCH
# -------------------------------------------------------------------
async def try_dispatch_next(session_id: str):
    session = get_session(session_id)

    if session.active_turn_id is not None:
        return

    if not session.question_queue:
        return

    question = session.question_queue.pop(0)
    turn_id = str(uuid4())

    session.active_turn_id = turn_id

    await send_to_realtime(
        session_id=session_id,
        turn_id=turn_id,
        text=question,
    )


# -------------------------------------------------------------------
# CONTROL WEBSOCKET
# -------------------------------------------------------------------
@router.websocket("/v1/control/{session_id}")
async def control_ws(ws: WebSocket, session_id: str):
    await ws.accept()
    register_control_ws(session_id, ws)

    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        unregister_control_ws(session_id)


# -------------------------------------------------------------------
# STT TRANSCRIPTS → ORCHESTRATOR
# -------------------------------------------------------------------
@router.post("/v1/sessions/{session_id}/transcripts")
async def submit_transcript(session_id: str, data: TranscriptIn):
    session = get_session(session_id)

    # UVEK poziv Agent1
    result = await agent1.triage(data.transcript)

    # DEBUG: prikaz kanonskog pitanja koje Agent1 vraća
    if result.has_question and result.questions:
        print(f"[Agent1] canonical_question={result.questions[0]}")

    if result.has_question:
        # questions[] ostaje lista (u praksi 0 ili 1)
        session.question_queue.extend(result.questions)

        # Pokušaj dispatch-a po JEDINOM pravilu
        await try_dispatch_next(session_id)

    return {"status": "ok"}


# -------------------------------------------------------------------
# TURN DONE SIGNAL
# -------------------------------------------------------------------
@router.post("/v1/sessions/{session_id}/turns/{turn_id}/done")
async def turn_done(
    session_id: str,
    turn_id: str,
    _: Optional[TurnDoneIn] = None,  # payload je opcion
):
    session = get_session(session_id)

    if session.active_turn_id != turn_id:
        raise HTTPException(status_code=409, detail="turn_id mismatch")

    session.active_turn_id = None

    # Nastavi FIFO ako ima još pitanja
    await try_dispatch_next(session_id)

    return {"status": "ok"}


app.include_router(router)
