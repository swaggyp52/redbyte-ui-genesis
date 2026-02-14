from __future__ import annotations

from agent_framework.azure import AzureOpenAIResponsesClient
from azure.identity import AzureCliCredential

from .config import IntelligenceConfig


def _build_client(config: IntelligenceConfig, deployment: str):
    return AzureOpenAIResponsesClient(
        project_endpoint=config.project_endpoint,
        deployment_name=deployment,
        credential=AzureCliCredential(),
    )


def build_agents(config: IntelligenceConfig):
    if not config.project_endpoint or not config.default_model:
        raise RuntimeError(
            "Missing Foundry config. Set AZURE_AI_PROJECT_ENDPOINT and AZURE_AI_MODEL_DEPLOYMENT_NAME."
        )

    orchestrator = _build_client(config, config.orchestrator_model).as_agent(
        name="RedByteOrchestrator",
        instructions=(
            "You orchestrate FPGA lab intelligence. Route to specialized agents and return compact, actionable outputs "
            "for student-facing UI surfaces."
        ),
    )

    diff_agent = _build_client(config, config.diff_model).as_agent(
        name="DiffAgent",
        instructions=(
            "Analyze simulation vs hardware state and explain mismatches with deterministic, student-readable findings."
        ),
    )

    evidence_agent = _build_client(config, config.evidence_model).as_agent(
        name="EvidenceAgent",
        instructions=(
            "Evaluate submission evidence semantics and return readiness, blockers, and concise next actions."
        ),
    )

    coach_agent = _build_client(config, config.coach_model).as_agent(
        name="CoachAgent",
        instructions=(
            "Provide context-aware educational guidance by lab stage. Keep explanations short, concrete, and actionable."
        ),
    )

    repair_agent = _build_client(config, config.repair_model).as_agent(
        name="RepairAgent",
        instructions=(
            "Given HDL errors and snippets, propose minimal safe repair suggestions with rationale."
        ),
    )

    return {
        "orchestrator": orchestrator,
        "diff": diff_agent,
        "evidence": evidence_agent,
        "coach": coach_agent,
        "repair": repair_agent,
    }
