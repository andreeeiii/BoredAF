/**
 * Link Integrity helpers — ensures LLM-generated suggestion text matches the pool entry.
 * Extracted to a standalone file to avoid importing LangGraph dependencies in tests.
 */

/**
 * Validate that the LLM-generated suggestion text is consistent with the pool's content_text.
 * Extracts the subject name from content_text (before " — " or first 2 words) and checks
 * if it appears (case-insensitive) in the LLM suggestion.
 *
 * Matching strategy (in order):
 * 1. Full subject match (e.g., "GothamChess live" in LLM text)
 * 2. First word match — the creator/brand name (e.g., "GothamChess" in LLM text)
 * Returns true if consistent, false if mismatched.
 */
export function validateLinkTextConsistency(
  llmSuggestion: string,
  poolContentText: string
): boolean {
  if (!llmSuggestion || !poolContentText) return false;

  const subjectName = extractSubjectName(poolContentText);
  if (!subjectName || subjectName.length < 2) return true;

  const llmLower = llmSuggestion.toLowerCase();
  const subjectLower = subjectName.toLowerCase();

  // Try full subject match first
  if (llmLower.includes(subjectLower)) return true;

  // Try first word (creator/brand name) — must be 3+ chars to be meaningful
  const firstWord = subjectName.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3 && llmLower.includes(firstWord.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Extract the subject/creator name from a pool content_text entry.
 * Tries " — " separator first (e.g., "MrBeast — insane challenges" → "MrBeast").
 * Falls back to first 3 words (e.g., "Watch shroud streaming FPS" → "Watch shroud streaming").
 * For activity-style entries (e.g., "Do a 5-minute plank"), returns the meaningful part.
 */
export function extractSubjectName(contentText: string): string {
  const dashIndex = contentText.indexOf(" — ");
  if (dashIndex > 0) {
    return contentText.slice(0, dashIndex).trim();
  }

  const altDashIndex = contentText.indexOf(" - ");
  if (altDashIndex > 0) {
    return contentText.slice(0, altDashIndex).trim();
  }

  // If separator is at position 0, return empty (no subject before it)
  if (contentText.startsWith(" — ") || contentText.startsWith(" - ")) {
    return "";
  }

  const words = contentText.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(" ");
}

/**
 * Validate that a URL is a real, external suggestion link.
 * Returns true only for http/https URLs pointing to known platforms.
 * Returns false for empty strings, localhost, relative paths, or invalid URLs.
 */
export function isValidSuggestionUrl(url: string | null | undefined): boolean {
  if (!url || url.trim().length === 0) return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a URL for use as a suggestion link.
 * Returns the URL if valid, or null if invalid.
 */
export function sanitizeLink(url: string | null | undefined): string | null {
  if (!url) return null;
  return isValidSuggestionUrl(url) ? url.trim() : null;
}
