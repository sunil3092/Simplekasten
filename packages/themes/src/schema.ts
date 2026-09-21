import { z } from "zod";

export const COLOR_KEYS = [
  "bg", "surface", "surface2", "ink", "inkMuted", "inkFaint", "line", "lineSoft",
  "accent", "accentInk", "accentSoft", "accent2", "accent2Soft", "danger", "dangerSoft",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const FONT_KEYWORDS = ["sans", "rounded-bold", "serif", "mono"] as const;
export type FontKeyword = (typeof FONT_KEYWORDS)[number];

export const RESERVED_THEME_IDS: readonly string[] = ["memphis", "classic"];

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a #rgb or #rrggbb colour");

const palette = z
  .object(Object.fromEntries(COLOR_KEYS.map((key) => [key, hexColor])) as Record<ColorKey, typeof hexColor>)
  .strict();

const shapeSchema = z
  .object({
    borderWidth: z.number().min(0).max(6),
    radius: z.number().min(0).max(24),
    shadow: z
      .object({ x: z.number().min(0).max(16), y: z.number().min(0).max(16), color: hexColor })
      .strict()
      .optional(),
  })
  .strict();

const fontSchema = z
  .object({ display: z.enum(FONT_KEYWORDS), body: z.enum(FONT_KEYWORDS), mono: z.enum(FONT_KEYWORDS) })
  .strict();

export const themeSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]{1,40}$/, "must be 1-40 characters of a-z, 0-9 or -"),
    name: z.string().min(1).max(60),
    author: z.string().max(80).optional(),
    colors: z.object({ light: palette, dark: palette.optional() }).strict(),
    shape: shapeSchema,
    font: fontSchema,
  })
  .strict();

export type Theme = z.infer<typeof themeSchema>;
