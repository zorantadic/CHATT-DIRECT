from typing import Dict
from fastapi import WebSocket
import asyncio


# ------------------------------------------------------------
# CONTROL WS REGISTRY (SESSION → WS)
# ------------------------------------------------------------

_control_ws: Dict[str, WebSocket] = {}


# ------------------------------------------------------------
# REGISTRATION
# ------------------------------------------------------------

def register_control_ws(session_id: str, ws: WebSocket) -> None:
    """
    Registers a Control WebSocket for a session.
    One Control WS per session is expected.
    """
    _control_ws[session_id] = ws


def unregister_control_ws(session_id: str) -> None:
    """
    Unregisters Control WebSocket for a session.
    """
    _control_ws.pop(session_id, None)


# ------------------------------------------------------------
# SEND COMMAND → FRONTEND
# ------------------------------------------------------------

async def send_to_realtime(session_id: str, turn_id: str, text: str) -> None:
    """
    Sends SEND_TO_REALTIME command to frontend via Control WS.
    This is the ONLY command this module sends.
    """
    ws = _control_ws.get(session_id)
    if ws is None:
        # Frontend not connected; nothing to do
        return

    payload = {
        "command": "SEND_TO_REALTIME",
        "payload": {
            "turnId": turn_id,
            "text": text,
        },
    }

    try:
        await ws.send_json(payload)
    except Exception:
        # If sending fails, drop the connection reference
        _control_ws.pop(session_id, None)

