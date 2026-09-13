/**
 * Central configuration constants for Apache Beam Pipeline Builder.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Single source of truth for cross-cutting configuration values shared by the
 * extension host and the code-generation pipeline.
 *
 * Architectural decisions:
 * - The Gemini model is pinned here rather than read from settings so that a
 *   generated pipeline is always reproducible from the extension version alone.
 * - NOTE: This constant previously read 'gemini-3.5-flash', which contradicted
 *   the project standard in .gemini/GEMINI.md (finding A7). Reconciled in favour
 *   of GEMINI.md, which is authoritative for this project.
 * - NOTE: gemini-3.7-flash on Vertex AI MUST be invoked with location 'global'.
 *   Regional endpoints such as us-central1 do not host this publisher model and
 *   return 404 NOT_FOUND. The call site already passes location: 'global' --
 *   do not "fix" that to a regional endpoint.
 * - Gemini 1.x / 2.x models (including gemini-2.5-*) are deprecated and must
 *   never be reintroduced here.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';
