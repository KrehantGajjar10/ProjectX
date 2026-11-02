import json
import logging
import re
from contextvars import ContextVar
from typing import Any

# Context variable tracking current request ID across async tasks
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class SensitiveDataFilter(logging.Filter):
    """Filters and masks sensitive data (API keys, JWTs, passwords, auth headers) in logs."""

    # Patterns matching sensitive variables / secrets
    PATTERNS = [
        (re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE), r"\1[MASKED_TOKEN]"),
        (
            re.compile(r"(password[\"']?\s*[:=]\s*[\"'])[^\"']+", re.IGNORECASE),
            r"\1[MASKED_PASSWORD]",
        ),
        (
            re.compile(r"(access_token[\"']?\s*[:=]\s*[\"'])[^\"']+", re.IGNORECASE),
            r"\1[MASKED_TOKEN]",
        ),
        (
            re.compile(r"(api_key[\"']?\s*[:=]\s*[\"'])[^\"']+", re.IGNORECASE),
            r"\1[MASKED_API_KEY]",
        ),
        (
            re.compile(r"(secret_key[\"']?\s*[:=]\s*[\"'])[^\"']+", re.IGNORECASE),
            r"\1[MASKED_SECRET]",
        ),
        (re.compile(r"(ghp_[A-Za-z0-9_]{30,})", re.IGNORECASE), r"[MASKED_GITHUB_TOKEN]"),
        (re.compile(r"(AIza[0-9A-Za-z-_]{35})", re.IGNORECASE), r"[MASKED_GEMINI_KEY]"),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, repl in self.PATTERNS:
                record.msg = pattern.sub(repl, record.msg)

        if record.args:
            if isinstance(record.args, dict):
                clean_args = {}
                for k, v in record.args.items():
                    if any(
                        secret_term in k.lower()
                        for secret_term in ("token", "secret", "password", "key")
                    ):
                        clean_args[k] = "[MASKED]"
                    elif isinstance(v, str):
                        val = v
                        for pattern, repl in self.PATTERNS:
                            val = pattern.sub(repl, val)
                        clean_args[k] = val
                    else:
                        clean_args[k] = v
                record.args = clean_args
            elif isinstance(record.args, tuple):
                clean_args_list = []
                for v in record.args:
                    if isinstance(v, str):
                        val = v
                        for pattern, repl in self.PATTERNS:
                            val = pattern.sub(repl, val)
                        clean_args_list.append(val)
                    else:
                        clean_args_list.append(v)
                record.args = tuple(clean_args_list)

        return True


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as structured JSON including request_id."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "request_id": request_id_ctx.get("-"),
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)


def setup_logging(structured_json: bool = False, level: int = logging.INFO) -> None:
    """Configures root logger with sensitive data filter and request ID formatting."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid duplicate handlers
    if not root_logger.handlers:
        handler = logging.StreamHandler()
        if structured_json:
            formatter = StructuredJsonFormatter()
        else:
            formatter = logging.Formatter(
                fmt="%(asctime)s [%(levelname)s] [req:%(request_id)s] %(name)s: %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        handler.setFormatter(formatter)
        root_logger.addHandler(handler)

    # Ensure sensitive data filter and request ID filter are attached to all handlers
    for handler in root_logger.handlers:
        handler.addFilter(RequestIdFilter())
        handler.addFilter(SensitiveDataFilter())


class RequestIdFilter(logging.Filter):
    """Attaches request_id to LogRecord for standard string formatters."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get("-")
        return True
