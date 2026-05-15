from enum import Enum


class SessionState(str, Enum):
    LISTEN = "LISTEN"
    TRIAGE = "TRIAGE"
    ANSWERING = "ANSWERING"
