"""
LLM provider factory.

Returns a LangChain BaseChatModel instance based on the tenant's
LLM configuration. Supports Ollama (gemma3:1b), OpenAI, and Anthropic.
"""

from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel


def create_llm(llm_config: dict) -> BaseChatModel:
    """Instantiate the appropriate LangChain chat model.

    Args:
        llm_config: Dict with at least ``provider`` plus provider-specific keys.

    Returns:
        A LangChain chat model ready for ``.invoke()`` or ``.bind_tools()``.
    """
    provider = llm_config.get("provider", "OLLAMA").upper()

    if provider == "OLLAMA":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            base_url=llm_config.get("ollamaEndpoint", "http://host.docker.internal:11434").rstrip("/"),
            model=llm_config.get("ollamaModel", "gemma3:1b"),
            temperature=0.2,
        )

    elif provider == "OPENAI":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            api_key=llm_config.get("openaiKey", ""),
            model=llm_config.get("openaiModel", "gpt-4o"),
            temperature=0.2,
        )

    elif provider == "ANTHROPIC":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            api_key=llm_config.get("anthropicKey", ""),
            model_name=llm_config.get("anthropicModel", "claude-3-5-sonnet-20240620"),
            temperature=0.2,
        )

    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")
