import { describe, expect, it } from "vitest";
import { createKnowledgeBaseInput, createNoteInput, loginInput, updateNoteInput } from "./schemas";

describe("createNoteInput", () => {
  it("accepts a minimal valid note and defaults type to fleeting", () => {
    const parsed = createNoteInput.parse({ kbId: "kb1", title: "Atomicity", content: "" });
    expect(parsed.type).toBe("fleeting");
  });

  it("rejects an empty title", () => {
    expect(() => createNoteInput.parse({ kbId: "kb1", title: "", content: "" })).toThrow();
  });

  it("rejects a title over 300 characters", () => {
    expect(() => createNoteInput.parse({ kbId: "kb1", title: "x".repeat(301), content: "" })).toThrow();
  });

  it("rejects an unknown note type", () => {
    expect(() => createNoteInput.parse({ kbId: "kb1", title: "T", content: "", type: "archived" })).toThrow();
  });

  it("accepts every declared note type", () => {
    for (const type of ["fleeting", "literature", "permanent", "structure"]) {
      expect(() => createNoteInput.parse({ kbId: "kb1", title: "T", content: "", type })).not.toThrow();
    }
  });
});

describe("updateNoteInput", () => {
  it("accepts a partial update with only the id", () => {
    const parsed = updateNoteInput.parse({ id: "n1" });
    expect(parsed.title).toBeUndefined();
    expect(parsed.content).toBeUndefined();
  });

  it("rejects a payload missing the id", () => {
    expect(() => updateNoteInput.parse({ title: "New title" })).toThrow();
  });

  it("rejects an empty title when title is provided", () => {
    expect(() => updateNoteInput.parse({ id: "n1", title: "" })).toThrow();
  });
});

describe("createKnowledgeBaseInput", () => {
  it("accepts a reasonable name", () => {
    expect(() => createKnowledgeBaseInput.parse({ name: "Research" })).not.toThrow();
  });

  it("rejects an empty name", () => {
    expect(() => createKnowledgeBaseInput.parse({ name: "" })).toThrow();
  });

  it("rejects a name over 120 characters", () => {
    expect(() => createKnowledgeBaseInput.parse({ name: "x".repeat(121) })).toThrow();
  });
});

describe("loginInput", () => {
  it("accepts a valid email and an 8+ character password", () => {
    expect(() => loginInput.parse({ email: "ada@example.com", password: "correcthorse" })).not.toThrow();
  });

  it("rejects a malformed email", () => {
    expect(() => loginInput.parse({ email: "not-an-email", password: "correcthorse" })).toThrow();
  });

  it("rejects a password under 8 characters", () => {
    expect(() => loginInput.parse({ email: "ada@example.com", password: "short" })).toThrow();
  });
});
