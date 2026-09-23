import { describe, expect, it } from "vitest";
import { parseTemplateFile, serializeTemplateFile } from "./template-file";
import type { Template } from "./types";

describe("template-file frontmatter round-trip", () => {
  it("serializes then parses back to the same template", () => {
    const template: Template = {
      id: "tpl1",
      name: "Daily Log",
      content: "## Tasks\n\n## Log\n\nWritten on {{date}}.",
      isDefaultForDailyNote: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    const raw = serializeTemplateFile(template);
    expect(parseTemplateFile(raw, template.id)).toEqual(template);
  });

  it("round-trips isDefaultForDailyNote, omitting the field entirely when false", () => {
    const isDefault: Template = {
      id: "tpl2",
      name: "Default",
      content: "body",
      isDefaultForDailyNote: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const raw = serializeTemplateFile(isDefault);
    expect(raw).toContain("isDefaultForDailyNote");
    expect(parseTemplateFile(raw, isDefault.id)).toEqual(isDefault);

    const notDefault: Template = { ...isDefault, id: "tpl3", isDefaultForDailyNote: false };
    const rawNotDefault = serializeTemplateFile(notDefault);
    expect(rawNotDefault).not.toContain("isDefaultForDailyNote");
    expect(parseTemplateFile(rawNotDefault, notDefault.id)).toEqual(notDefault);
  });

  it("throws when a file has no frontmatter block", () => {
    expect(() => parseTemplateFile("just plain markdown, no frontmatter", "id1")).toThrow();
  });
});
