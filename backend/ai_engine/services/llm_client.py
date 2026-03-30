"""
LLM client — OpenAI-compatible interface that works with:
- Ollama (local, default): LLM_BASE_URL=http://localhost:11434/v1
- vLLM (self-hosted GPU): LLM_BASE_URL=http://your-server:8000/v1
- OpenAI: LLM_BASE_URL=https://api.openai.com/v1

Switch provider purely via environment variables — zero code changes needed.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI
        _client = OpenAI(
            base_url=settings.LLM_BASE_URL,
            api_key=settings.LLM_API_KEY,
        )
    return _client


def chat(messages: list[dict[str, str]], model: str | None = None, temperature: float = 0.2) -> str:
    """
    Send a chat completion request and return the response text.
    Uses the default LLM_MODEL unless overridden.
    """
    model = model or settings.LLM_MODEL
    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        logger.exception("LLM request failed (model=%s): %s", model, exc)
        raise


def _repair_json(text: str) -> str:
    """
    Best-effort JSON repair for common LLM output issues:
    - Trailing commas before } or ]
    - Single quotes instead of double quotes
    - Unescaped newlines inside strings
    - Truncated output (adds closing brackets)
    """
    # Remove markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```\s*$", "", text.strip(), flags=re.MULTILINE)
    text = text.strip()

    # Remove trailing commas before ] or }
    text = re.sub(r",\s*([}\]])", r"\1", text)

    # Replace unescaped newlines inside strings (common with llama3.2)
    text = re.sub(r'(?<!\\)\n(?=[^"]*"(?:[^"\\]|\\.)*")', " ", text)

    # If JSON starts with [ or { but appears truncated, try to close it
    if text and text[0] in ("{", "["):
        opens = text.count("{") + text.count("[")
        closes = text.count("}") + text.count("]")
        if opens > closes:
            diff = opens - closes
            # Determine what to close
            closer = "}" if text[0] == "{" else "]"
            text = text.rstrip(",\n ") + (closer * diff)

    return text


def chat_json(messages: list[dict[str, str]], model: str | None = None) -> Any:
    """
    Send a chat request and parse the response as JSON.
    Strips markdown fences and repairs common LLM JSON formatting issues.
    """
    raw = chat(messages, model=model)
    cleaned = _repair_json(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Second attempt: extract first JSON object/array found in the response
        match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", cleaned)
        if match:
            try:
                extracted = _repair_json(match.group(1))
                return json.loads(extracted)
            except json.JSONDecodeError:
                pass
        logger.error("LLM returned non-JSON (raw[:300]): %s", raw[:300])
        raise ValueError(f"LLM did not return valid JSON") from None


def summary_chat(messages: list[dict[str, str]]) -> str:
    """Use the lighter summary model for prose output (insights, descriptions)."""
    return chat(messages, model=settings.LLM_SUMMARY_MODEL, temperature=0.4)
