import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { anonCaller, registerUser, uniqueEmail } from "../test-helpers";

describe("auth.register", () => {
  it("creates a user with a default knowledge base and returns usable tokens", async () => {
    const { kb, accessToken, refreshToken } = await registerUser("register");
    expect(kb.name).toBe("My Vault");
    expect(kb.isDefault).toBe(true);
    expect(accessToken).toEqual(expect.any(String));
    expect(refreshToken).toEqual(expect.any(String));
  });

  it("rejects a second registration with the same email", async () => {
    const email = uniqueEmail("dup");
    await anonCaller.auth.register({ email, password: "correcthorse-battery", displayName: "First" });
    await expect(
      anonCaller.auth.register({ email, password: "correcthorse-battery", displayName: "Second" }),
    ).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<TRPCError>);
  });
});

describe("auth.login", () => {
  it("logs in with the correct password", async () => {
    const email = uniqueEmail("login");
    await anonCaller.auth.register({ email, password: "correcthorse-battery", displayName: "Login Test" });
    const result = await anonCaller.auth.login({ email, password: "correcthorse-battery" });
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it("rejects a wrong password", async () => {
    const email = uniqueEmail("wrongpw");
    await anonCaller.auth.register({ email, password: "correcthorse-battery", displayName: "Wrong PW" });
    await expect(anonCaller.auth.login({ email, password: "not-the-password" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a login for an email that was never registered", async () => {
    await expect(
      anonCaller.auth.login({ email: uniqueEmail("ghost"), password: "correcthorse-battery" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("auth.refresh", () => {
  it("issues a new access token for a valid refresh token", async () => {
    const { refreshToken } = await registerUser("refresh");
    const refreshed = await anonCaller.auth.refresh({ refreshToken });
    expect(refreshed.accessToken).toEqual(expect.any(String));
  });

  it("rotates the refresh token, invalidating the one just used", async () => {
    const { refreshToken } = await registerUser("rotate");
    await anonCaller.auth.refresh({ refreshToken });
    // The original token was single-use; replaying it must fail even though
    // it hasn't expired — this is what stops a stolen-but-unused token from
    // being replayed indefinitely.
    await expect(anonCaller.auth.refresh({ refreshToken })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a refresh token that never existed", async () => {
    await expect(anonCaller.auth.refresh({ refreshToken: "not-a-real-token" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("auth.logout", () => {
  it("revokes the refresh token so it can no longer be used", async () => {
    const { refreshToken } = await registerUser("logout");
    await anonCaller.auth.logout({ refreshToken });
    await expect(anonCaller.auth.refresh({ refreshToken })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("is a harmless no-op for a token that doesn't exist", async () => {
    await expect(anonCaller.auth.logout({ refreshToken: "never-issued" })).resolves.toEqual({ ok: true });
  });
});
