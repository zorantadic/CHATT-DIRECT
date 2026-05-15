from dotenv import load_dotenv
load_dotenv()

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.agents.models import ListSortOrder
import os

client = AIProjectClient(
    credential=DefaultAzureCredential(),
    endpoint=os.environ["AGENT1_PROJECT_ENDPOINT"]
)

agent_id = os.environ["AGENT1_AGENT_ID"]

thread = client.agents.threads.create()

client.agents.messages.create(
    thread_id=thread.id,
    role="user",
    content="My login keeps failing after the update."
)

run = client.agents.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent_id
)

if run.status == "failed":
    raise RuntimeError(run.last_error)

messages = client.agents.messages.list(
    thread_id=thread.id,
    order=ListSortOrder.ASCENDING
)

for m in messages:
    if m.text_messages:
        print(m.role, ":", m.text_messages[-1].text.value)
