import { themeSchema, type Theme } from "./schema";

export type ParseResult = { ok: true; theme: Theme } | { ok: false; errors: string[] };

/** Never throws — returns readable errors instead, so UIs can show them inline. */
export function parseTheme(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: ["Not valid JSON"] };
  }

  const result = themeSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".") || "theme"}: ${issue.message}`),
    };
  }
  return { ok: true, theme: result.data };
}
