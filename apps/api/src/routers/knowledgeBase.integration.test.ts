import { describe, expect, it } from "vitest";
import { registerUser } from "../test-helpers";

describe("knowledgeBase.create / list", () => {
  it("gives every new user exactly one default vault", async () => {
    const { caller } = await registerUser("kb-default");
    const kbs = await caller.knowledgeBase.list();
    expect(kbs).toHaveLength(1);
    expect(kbs[0].isDefault).toBe(true);
  });

  it("creates an additional vault and lists both, oldest first", async () => {
    const { caller } = await registerUser("kb-create");
    const created = await caller.knowledgeBase.create({ name: "Research" });
    expect(created.name).toBe("Research");
    expect(created.isDefault).toBe(false);

    const kbs = await caller.knowledgeBase.list();
    expect(kbs.map((k) => k.name)).toEqual(["My Vault", "Research"]);
  });

  it("slugifies the vault name for its slug", async () => {
    const { caller } = await registerUser("kb-slug");
    const created = await caller.knowledgeBase.create({ name: "Deep Work & Focus!!" });
    expect(created.slug).toBe("deep-work-focus");
  });

  it("only ever lists the caller's own vaults, never another user's", async () => {
    const alice = await registerUser("kb-alice");
    const bob = await registerUser("kb-bob");
    await bob.caller.knowledgeBase.create({ name: "Bob's Second Vault" });

    const aliceKbs = await alice.caller.knowledgeBase.list();
    expect(aliceKbs.every((kb) => kb.ownerId === alice.userId)).toBe(true);
    expect(aliceKbs.some((kb) => kb.name === "Bob's Second Vault")).toBe(false);
  });
});
