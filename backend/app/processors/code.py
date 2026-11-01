import re
from typing import Any

from app.processors.base import BaseFileProcessor, ProcessedDocument, ProcessedSection


class CodeProcessor(BaseFileProcessor):
    """Symbol-boundary aware code processor for Python, TypeScript/JavaScript, and other languages."""

    # Python patterns
    PY_PATTERN = re.compile(
        r"^(?P<indent>[ \t]*)(?P<type>async\s+def|def|class)\s+(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)"
    )

    # JS/TS patterns
    TS_PATTERN = re.compile(
        r"^(?:export\s+)?(?:default\s+)?(?P<type>async\s+function|function|class|interface|type|const|let)\s+(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)"
    )

    # Generic language pattern (Go, Rust, Java, C++)
    GENERIC_PATTERN = re.compile(
        r"^(?:pub\s+|public\s+|private\s+|protected\s+)?(?P<type>fn|func|class|struct|interface|void|int|string)\s+(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)"
    )

    EXTENSION_MAP = {
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "typescript-react",
        ".js": "javascript",
        ".jsx": "javascript-react",
        ".mjs": "javascript",
        ".cjs": "javascript",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c-header",
        ".hpp": "cpp-header",
        ".sql": "sql",
        ".sh": "bash",
    }

    def _detect_language(self, file_path: str) -> str:
        for ext, lang in self.EXTENSION_MAP.items():
            if file_path.lower().endswith(ext):
                return lang
        return "code"

    def process(
        self,
        content: str | bytes,
        file_path: str,
        title: str | None = None,
        mime_type: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ProcessedDocument:
        if isinstance(content, bytes):
            text = content.decode("utf-8", errors="replace")
        else:
            text = content

        content_hash = self.compute_sha256(text)
        doc_title = title or file_path.split("/")[-1]
        language = self._detect_language(file_path)

        lines = text.splitlines(keepends=True)
        sections: list[ProcessedSection] = []
        total_lines = len(lines)

        if total_lines == 0:
            return ProcessedDocument(
                title=doc_title,
                content_hash=content_hash,
                file_path=file_path,
                file_type="code",
                mime_type=mime_type or "text/plain",
                metadata={"language": language, "total_lines": 0},
                sections=[],
                raw_content="",
            )

        # Select boundary regex based on language
        if language == "python":
            pattern = self.PY_PATTERN
        elif language.startswith(("javascript", "typescript")):
            pattern = self.TS_PATTERN
        else:
            pattern = self.GENERIC_PATTERN

        current_symbol_name = "module_preamble"
        current_symbol_type = "preamble"
        current_lines: list[str] = []
        symbol_start_line = 1

        for idx, line in enumerate(lines):
            line_num = idx + 1
            line.strip()

            # Skip comments and blank lines for boundary detection
            is_boundary = False
            match = pattern.match(line)
            if match:
                raw_type = match.group("type").strip()
                match.group("name").strip()

                # For Python, verify top-level or method indentation
                if language == "python":
                    indent = len(match.group("indent"))
                    if indent == 0 or (indent == 4 and "def" in raw_type):
                        is_boundary = True
                else:
                    is_boundary = True

            if is_boundary and match:
                if current_lines:
                    sec_content = "".join(current_lines).strip()
                    if sec_content:
                        sections.append(
                            ProcessedSection(
                                content=sec_content,
                                location_info={
                                    "file_path": file_path,
                                    "file_type": "code",
                                    "language": language,
                                    "symbol_name": current_symbol_name,
                                    "symbol_type": current_symbol_type,
                                    "line_start": symbol_start_line,
                                    "line_end": line_num - 1,
                                },
                            )
                        )

                current_symbol_name = match.group("name")
                current_symbol_type = match.group("type").replace("async ", "")
                current_lines = [line]
                symbol_start_line = line_num
            else:
                current_lines.append(line)

        # Flush final symbol
        if current_lines:
            sec_content = "".join(current_lines).strip()
            if sec_content:
                sections.append(
                    ProcessedSection(
                        content=sec_content,
                        location_info={
                            "file_path": file_path,
                            "file_type": "code",
                            "language": language,
                            "symbol_name": current_symbol_name,
                            "symbol_type": current_symbol_type,
                            "line_start": symbol_start_line,
                            "line_end": total_lines,
                        },
                    )
                )

        # Safe fallback if no boundaries were found (e.g. flat script)
        if (
            len(sections) <= 1
            and total_lines > 60
            and sections
            and sections[0].location_info.get("symbol_type") == "preamble"
        ):
            sections = []
            block_size = 50
            for start_idx in range(0, total_lines, block_size):
                end_idx = min(start_idx + block_size, total_lines)
                block_content = "".join(lines[start_idx:end_idx]).strip()
                if block_content:
                    sections.append(
                        ProcessedSection(
                            content=block_content,
                            location_info={
                                "file_path": file_path,
                                "file_type": "code",
                                "language": language,
                                "symbol_name": f"lines_{start_idx + 1}_{end_idx}",
                                "symbol_type": "code_block",
                                "line_start": start_idx + 1,
                                "line_end": end_idx,
                            },
                        )
                    )

        doc_meta = metadata.copy() if metadata else {}
        doc_meta.update(
            {
                "language": language,
                "total_lines": total_lines,
                "symbol_count": len(sections),
            }
        )

        return ProcessedDocument(
            title=doc_title,
            content_hash=content_hash,
            file_path=file_path,
            file_type="code",
            mime_type=mime_type or "text/plain",
            metadata=doc_meta,
            sections=sections,
            raw_content=text,
        )
