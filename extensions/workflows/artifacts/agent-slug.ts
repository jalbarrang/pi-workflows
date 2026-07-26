/**
 * Turn an author-supplied agent label into a filesystem-safe directory name.
 *
 * The label is arbitrary model-written text — `recon:rows`, `../../escape`, an
 * emoji, an empty string. Rather than escaping what is dangerous, this keeps only
 * what is provably safe: lowercase alphanumerics and the separator. A traversal
 * cannot survive a filter that has no `.` and no `/` in its output alphabet.
 *
 * Uniqueness is not this function's job — callers prefix the agent index, which
 * is already unique per run, so two agents labelled the same still get two dirs.
 */
const MAX_SLUG_LENGTH = 48;

export function agentSlug(label: string): string {
  const filtered = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return filtered || "agent";
}
