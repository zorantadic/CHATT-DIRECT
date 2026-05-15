import os
import json
from typing import List

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.agents.models import ListSortOrder, MessageRole


class Agent1Result:
    def __init__(self, has_question: bool, questions: List[str]):
        self.has_question = has_question
        self.questions = questions


class Agent1Client:
    """
    Semantic Question Triage client for Foundry Agent 'slusac'.

    - Stateless usage: one thread per call
    - One user message
    - One run
    - Strict JSON output expected
    """

    def __init__(self):
        try:
            self.project_endpoint = os.environ["AGENT1_PROJECT_ENDPOINT"]
            self.agent_id = os.environ["AGENT1_AGENT_ID"]
        except KeyError as e:
            raise RuntimeError(f"Missing required env var: {e}")

        self.client = AIProjectClient(
            credential=DefaultAzureCredential(),
            endpoint=self.project_endpoint,
        )

    async def triage(self, transcript: str) -> Agent1Result:
        """
        Send transcript to Agent 1 and return parsed triage result.
        """
        # 1) Create isolated thread
        thread = self.client.agents.threads.create()

        # 2) Send transcript as user message
        self.client.agents.messages.create(
            thread_id=thread.id,
            role="user",
            content=transcript,
        )

        # 3) Run agent (blocking until complete)
        run = self.client.agents.runs.create_and_process(
            thread_id=thread.id,
            agent_id=self.agent_id,
        )

        if run.status == "failed":
            raise RuntimeError(f"Agent1 run failed: {run.last_error}")

        # 4) Read messages
        messages = self.client.agents.messages.list(
            thread_id=thread.id,
            order=ListSortOrder.ASCENDING,
        )

        agent_message = None

        for m in messages:
            if m.role == MessageRole.AGENT and m.text_messages:
                agent_message = m.text_messages[-1].text.value
                break

        if not agent_message:
            raise RuntimeError("Agent1 returned no AGENT message")

        # 5) Parse strict JSON
        try:
            parsed = json.loads(agent_message)
        except json.JSONDecodeError:
            raise ValueError(f"Agent1 returned non-JSON output: {agent_message}")

        # 6) Validate schema
        if (
            not isinstance(parsed, dict)
            or "hasQuestion" not in parsed
            or "questions" not in parsed
        ):
            raise ValueError(f"Invalid Agent1 JSON schema: {parsed}")

        has_question = bool(parsed["hasQuestion"])
        questions_raw = parsed["questions"]

        if not isinstance(questions_raw, list):
            raise ValueError("Agent1 'questions' must be a list")

        questions: List[str] = []
        for q in questions_raw:
            if isinstance(q, str):
                q = q.strip()
                if q:
                    questions.append(q)

        if not has_question:
            return Agent1Result(has_question=False, questions=[])

        if has_question and not questions:
            raise ValueError("Agent1 hasQuestion=true but no valid questions")

        return Agent1Result(has_question=True, questions=questions)


# Singleton-style helper
_agent1_client = None


def get_agent1_client() -> Agent1Client:
    global _agent1_client
    if _agent1_client is None:
        _agent1_client = Agent1Client()
    return _agent1_client
