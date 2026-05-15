from pydantic import BaseModel
from typing import Optional


# ------------------------------------------------------------
# STT → ORCHESTRATOR
# ------------------------------------------------------------

class TranscriptIn(BaseModel):
    transcript: str


# ------------------------------------------------------------
# TURN DONE SIGNAL (ČIST EVENT)
# ------------------------------------------------------------

class TurnDoneIn(BaseModel):
    """
    Empty or optional payload.
    turn_done is a SIGNAL, not data.
    """
    status: Optional[str] = None
    endedAt: Optional[str] = None
