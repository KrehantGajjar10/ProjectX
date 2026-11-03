import re
from difflib import SequenceMatcher


def normalize_text_for_verification(text: str) -> str:
    """Collapses whitespace, rejoins hyphenated line breaks, removes formatting artifacts, and lowercases for fuzzy match comparison."""
    # 1. Rejoin hyphenated line breaks common in PDFs (e.g., "sys-\ntem" -> "system", "multi-\r\npage" -> "multipage")
    text = re.sub(r"(\b\w+)-\s*[\r\n]+\s*(\w+\b)", r"\1\2", text)
    # 2. Collapse line breaks, tabs, and multiple spaces into a single space
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    # 3. Normalize quotes, dashes, and bullet marks
    text = re.sub(r"[\u2018\u2019]", "'", text)
    text = re.sub(r"[\u201C\u201D]", '"', text)
    text = re.sub(r"[\u2013\u2014]", "-", text)
    # 4. Remove markdown formatting characters (*, _, `, quotes, headers)
    text = re.sub(r"[\*_`\"'#>]", "", text)
    return text.strip().lower()


def verify_evidence(
    chunk_content: str,
    excerpt: str,
    threshold: float = 0.75,
) -> tuple[bool, float, str]:
    """Programmatically verifies whether the extracted evidence excerpt exists in the source chunk.

    Tolerant of whitespace, case variations, line breaks, PDF hyphenation, markdown formatting,
    and minor punctuation changes.
    Returns:
        (is_verified: bool, match_confidence: float, matched_excerpt: str)
    """
    clean_excerpt = excerpt.strip()
    if not clean_excerpt or not chunk_content.strip():
        return False, 0.0, "Empty evidence excerpt or chunk"

    # 1. Exact verbatim substring match
    if clean_excerpt in chunk_content:
        return True, 1.0, clean_excerpt

    # 2. Whitespace & line-break normalized match
    norm_chunk = " ".join(chunk_content.split())
    norm_excerpt = " ".join(clean_excerpt.split())
    if norm_excerpt in norm_chunk:
        return True, 0.98, norm_excerpt

    # 3. Case-insensitive normalized match
    if norm_excerpt.lower() in norm_chunk.lower():
        return True, 0.95, norm_excerpt

    # 4. Hyphenation-rejoined & case-insensitive match (crucial for PDF text)
    dehyphen_chunk = " ".join(re.sub(r"(\b\w+)-\s*[\r\n]+\s*(\w+\b)", r"\1\2", chunk_content).split())
    dehyphen_excerpt = " ".join(re.sub(r"(\b\w+)-\s*[\r\n]+\s*(\w+\b)", r"\1\2", clean_excerpt).split())
    if dehyphen_excerpt.lower() in dehyphen_chunk.lower():
        return True, 0.95, clean_excerpt

    # 5. Punctuation/Markdown/dehyphenated normalized match
    scrubbed_chunk = normalize_text_for_verification(chunk_content)
    scrubbed_excerpt = normalize_text_for_verification(clean_excerpt)

    if scrubbed_excerpt in scrubbed_chunk:
        return True, 0.90, clean_excerpt

    # 6. Fuzzy sub-sequence search (handles partial token/punctuation/linebreak drifts)
    # Use SequenceMatcher over word windows
    chunk_words = scrubbed_chunk.split()
    excerpt_words = scrubbed_excerpt.split()
    excerpt_len = len(excerpt_words)

    if excerpt_len > 0 and len(chunk_words) >= excerpt_len:
        best_ratio = 0.0
        step = max(1, excerpt_len // 4)
        for i in range(0, len(chunk_words) - excerpt_len + 1, step):
            window = " ".join(chunk_words[i : i + excerpt_len])
            matcher = SequenceMatcher(None, scrubbed_excerpt, window)
            ratio = matcher.ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                if best_ratio >= threshold:
                    break

        if best_ratio >= threshold:
            return True, round(best_ratio, 3), clean_excerpt
    elif excerpt_len > 0 and len(chunk_words) > 0:
        # If chunk is shorter or equal to excerpt, compute direct ratio
        matcher = SequenceMatcher(None, scrubbed_excerpt, scrubbed_chunk)
        ratio = matcher.ratio()
        if ratio >= threshold:
            return True, round(ratio, 3), clean_excerpt

    # Evidence excerpt could not be verified
    return False, 0.0, clean_excerpt
