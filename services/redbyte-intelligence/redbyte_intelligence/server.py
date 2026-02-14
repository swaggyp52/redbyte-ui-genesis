from __future__ import annotations

from dotenv import load_dotenv

from .agents import build_agents
from .config import load_config
from .tracing import configure_logging


def build_server_agent():
    load_dotenv(override=False)
    config = load_config()
    configure_logging(config.log_level)
    agents = build_agents(config)
    return agents["orchestrator"]


def main() -> None:
    app_agent = build_server_agent()

    from azure.ai.agentserver.agentframework import from_agent_framework

    server = from_agent_framework(app_agent)
    server.run()


if __name__ == "__main__":
    main()
