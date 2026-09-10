// Shared by vault-slug generation (knowledgeBase.create) and vault-export
// filenames — both need the same "safe for a URL segment / filesystem path"
// transform, just with different fallbacks for an all-punctuation input.
export function slugify(value: string, fallback = "untitled"): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || fallback;
}
