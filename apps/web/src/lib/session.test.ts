import { afterEach, describe, expect, it } from "vitest";
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setTokens } from "./session";

afterEach(() => {
  window.localStorage.clear();
});

describe("session token storage", () => {
  it("returns null for both tokens before anything is stored", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("stores and retrieves both tokens together", () => {
    setTokens("access-1", "refresh-1");
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("updates only the access token, leaving the refresh token untouched", () => {
    setTokens("access-1", "refresh-1");
    setAccessToken("access-2");
    expect(getAccessToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("clears both tokens", () => {
    setTokens("access-1", "refresh-1");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
