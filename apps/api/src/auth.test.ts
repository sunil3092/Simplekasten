import { describe, expect, it } from "vitest";
import {
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from "./auth";

describe("password hashing", () => {
  it("verifies the correct password against its hash", () => {
    const hash = hashPassword("correcthorse");
    expect(verifyPassword("correcthorse", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPassword("correcthorse");
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("salts every hash differently, even for the same password", () => {
    expect(hashPassword("correcthorse")).not.toBe(hashPassword("correcthorse"));
  });

  it("never stores the password in plain text within the hash", () => {
    expect(hashPassword("correcthorse")).not.toContain("correcthorse");
  });
});

describe("access tokens", () => {
  it("round-trips the user id through sign and verify", () => {
    const token = signAccessToken("user-123");
    expect(verifyAccessToken(token)?.sub).toBe("user-123");
  });

  it("rejects a garbage token", () => {
    expect(verifyAccessToken("not.a.jwt")).toBeNull();
  });

  it("rejects a token signed with a different secret (tampered/forged)", () => {
    // A token that merely *looks* well-formed but wasn't signed by us should
    // never verify — this is the whole point of a signature.
    const forged =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      Buffer.from(JSON.stringify({ sub: "attacker", exp: 9999999999 })).toString("base64url") +
      ".invalidsignature";
    expect(verifyAccessToken(forged)).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("generates a unique token on every call", () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it("hashes the same token to the same value (deterministic lookup)", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it("hashes different tokens to different values", () => {
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(hashRefreshToken(generateRefreshToken()));
  });

  it("never stores the raw token within its own hash", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
