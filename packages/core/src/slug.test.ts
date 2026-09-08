import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Great Vault")).toBe("my-great-vault");
  });

  it("strips punctuation and collapses runs of separators", () => {
    expect(slugify("Hello, World!!  Again")).toBe("hello-world-again");
  });

  it("trims leading/trailing hyphens produced by leading/trailing punctuation", () => {
    expect(slugify("--Wrapped--")).toBe("wrapped");
  });

  it("falls back to the given default when nothing alphanumeric remains", () => {
    expect(slugify("!!!", "vault")).toBe("vault");
    expect(slugify("   ")).toBe("untitled");
  });
});
