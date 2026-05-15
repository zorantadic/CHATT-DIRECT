from typing import Dict, List, Optional
from dataclasses import dataclass, field


# ------------------------------------------------------------
# SESSION MODEL (MEHANIČKI, BEZ LOGIKE)
# ------------------------------------------------------------

@dataclass
class Session:
    session_id: str
    question_queue: List[str] = field(default_factory=list)
    active_turn_id: Optional[str] = None


# ------------------------------------------------------------
# IN-MEMORY SESSION REGISTRY
# ------------------------------------------------------------

_sessions: Dict[str, Session] = {}


# ------------------------------------------------------------
# SESSION ACCESS
# ------------------------------------------------------------

def get_session(session_id: str) -> Session:
    """
    Returns existing session or creates a new one.
    No side effects besides initialization.
    """
    session = _sessions.get(session_id)
    if session is None:
        session = Session(session_id=session_id)
        _sessions[session_id] = session
    return session


def remove_session(session_id: str) -> None:
    """
    Removes session from memory (optional cleanup hook).
    """
    _sessions.pop(session_id, None)


def list_sessions() -> List[str]:
    """
    Debug / introspection helper.
    """
    return list(_sessions.keys())
