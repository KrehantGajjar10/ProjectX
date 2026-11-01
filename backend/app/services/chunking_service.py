import re
import uuid
from typing import Any

import tiktoken
from pydantic import BaseModel

from app.core.config import settings
from app.models.document import DocumentChunk
from app.processors.base import ProcessedDocument


class ChunkMetadata(BaseModel):
    chunk_index: int
    content: str
    token_count: int
    location_info: dict[str, Any]


class ChunkingService:
    """Service responsible for chunking documents into retrieval-ready segments.

    Prose documents (Markdown, PDF, DOCX, PPTX, text) are chunked to ~800-1000 tokens
    with overlap. Code is chunked along function/class symbol boundaries with line-based
    fallback.
    """

    def __init__(
        self,
        chunk_size_tokens: int | None = None,
        chunk_overlap_tokens: int | None = None,
    ) -> None:
        self.chunk_size = chunk_size_tokens or settings.CHUNK_SIZE_TOKENS
        self.chunk_overlap = chunk_overlap_tokens or settings.CHUNK_OVERLAP_TOKENS
        try:
            self._tokenizer = tiktoken.get_encoding("cl100k_base")
        except Exception:
            self._tokenizer = None

    def count_tokens(self, text: str) -> int:
        if not text:
            return 0
        if self._tokenizer:
            try:
                return len(self._tokenizer.encode(text))
            except Exception:
                pass
        # Fallback estimation: average 1 token ≈ 4 characters or 0.75 words
        return max(1, int(len(text.split()) * 1.3))

    def _split_prose_by_tokens(
        self,
        text: str,
        base_location: dict[str, Any],
        start_chunk_idx: int,
    ) -> list[ChunkMetadata]:
        """Splits large prose text into chunks with sliding token overlap."""
        chunks: list[ChunkMetadata] = []
        paragraphs = re.split(r"\n\s*\n", text)

        current_paras: list[str] = []
        current_tokens = 0
        chunk_idx = start_chunk_idx

        # Calculate approximate line count for location mapping
        len(text.splitlines())
        base_location.get("line_start", 1)

        for p in paragraphs:
            p_clean = p.strip()
            if not p_clean:
                continue

            p_tokens = self.count_tokens(p_clean)

            if current_tokens + p_tokens > self.chunk_size and current_paras:
                chunk_body = "\n\n".join(current_paras).strip()
                loc = base_location.copy()

                chunks.append(
                    ChunkMetadata(
                        chunk_index=chunk_idx,
                        content=chunk_body,
                        token_count=current_tokens,
                        location_info=loc,
                    )
                )
                chunk_idx += 1

                # Retain overlap from end of previous paragraphs
                overlap_paras: list[str] = []
                overlap_count = 0
                for prev in reversed(current_paras):
                    prev_tokens = self.count_tokens(prev)
                    if overlap_count + prev_tokens <= self.chunk_overlap:
                        overlap_paras.insert(0, prev)
                        overlap_count += prev_tokens
                    else:
                        break

                current_paras = overlap_paras
                current_tokens = overlap_count

            current_paras.append(p_clean)
            current_tokens += p_tokens

        # Flush remaining text
        if current_paras:
            chunk_body = "\n\n".join(current_paras).strip()
            loc = base_location.copy()
            chunks.append(
                ChunkMetadata(
                    chunk_index=chunk_idx,
                    content=chunk_body,
                    token_count=current_tokens,
                    location_info=loc,
                )
            )

        return chunks

    def _split_code_by_lines(
        self,
        text: str,
        base_location: dict[str, Any],
        start_chunk_idx: int,
    ) -> list[ChunkMetadata]:
        """Splits an oversized code section into overlapping line windows."""
        chunks: list[ChunkMetadata] = []
        lines = text.splitlines(keepends=True)
        total_lines = len(lines)
        base_line_start = base_location.get("line_start", 1)

        chunk_idx = start_chunk_idx
        start_idx = 0
        target_lines_per_chunk = max(30, int(self.chunk_size / 8))  # approx lines per chunk
        overlap_lines = max(5, int(self.chunk_overlap / 8))

        while start_idx < total_lines:
            end_idx = min(start_idx + target_lines_per_chunk, total_lines)
            chunk_content = "".join(lines[start_idx:end_idx]).strip()

            loc = base_location.copy()
            loc["line_start"] = base_line_start + start_idx
            loc["line_end"] = base_line_start + end_idx - 1

            if chunk_content:
                chunks.append(
                    ChunkMetadata(
                        chunk_index=chunk_idx,
                        content=chunk_content,
                        token_count=self.count_tokens(chunk_content),
                        location_info=loc,
                    )
                )
                chunk_idx += 1

            if end_idx >= total_lines:
                break
            start_idx = end_idx - overlap_lines

        return chunks

    def chunk_processed_document(
        self,
        processed_doc: ProcessedDocument,
        document_id: uuid.UUID,
        source_id: uuid.UUID | None,
    ) -> list[DocumentChunk]:
        """Chunks a ProcessedDocument into a list of SQLAlchemy DocumentChunk models."""
        generated_chunks: list[ChunkMetadata] = []
        chunk_idx = 0

        for section in processed_doc.sections:
            content = section.content.strip()
            if not content:
                continue

            sec_tokens = self.count_tokens(content)

            # Build full location tracer
            loc = section.location_info.copy()
            loc["file_path"] = processed_doc.file_path
            loc["file_type"] = processed_doc.file_type
            loc["document_id"] = str(document_id)
            if source_id:
                loc["source_id"] = str(source_id)

            if processed_doc.file_type == "code":
                # Code symbol chunking
                if sec_tokens <= self.chunk_size:
                    generated_chunks.append(
                        ChunkMetadata(
                            chunk_index=chunk_idx,
                            content=content,
                            token_count=sec_tokens,
                            location_info=loc,
                        )
                    )
                    chunk_idx += 1
                else:
                    # Function/class is oversized, split by lines
                    sub_chunks = self._split_code_by_lines(content, loc, chunk_idx)
                    generated_chunks.extend(sub_chunks)
                    chunk_idx += len(sub_chunks)
            else:
                # Prose document chunking (Markdown, PDF, DOCX, PPTX, text)
                if sec_tokens <= self.chunk_size:
                    generated_chunks.append(
                        ChunkMetadata(
                            chunk_index=chunk_idx,
                            content=content,
                            token_count=sec_tokens,
                            location_info=loc,
                        )
                    )
                    chunk_idx += 1
                else:
                    sub_chunks = self._split_prose_by_tokens(content, loc, chunk_idx)
                    generated_chunks.extend(sub_chunks)
                    chunk_idx += len(sub_chunks)

        # Convert to SQLAlchemy DocumentChunk models
        result: list[DocumentChunk] = []
        for c in generated_chunks:
            result.append(
                DocumentChunk(
                    document_id=document_id,
                    chunk_index=c.chunk_index,
                    content=c.content,
                    token_count=c.token_count,
                    location_info=c.location_info,
                )
            )

        return result


_global_chunker: ChunkingService | None = None


def get_chunking_service() -> ChunkingService:
    global _global_chunker
    if _global_chunker is None:
        _global_chunker = ChunkingService()
    return _global_chunker
