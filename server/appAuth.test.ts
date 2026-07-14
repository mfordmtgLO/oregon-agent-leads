import { describe, expect, it } from "vitest";
import {
  APP_SESSION_COOKIE,
  createSessionToken,
  SESSION_TTL_MS,
  verifyCredentials,
  verifySessionToken,
} from "./appAuth";

describe("verifyCredentials", () => {
  it("accepts the correct credentials", () => {
    expect(verifyCredentials("mike.ford", "OregonMLO2025!")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyCredentials("mike.ford", "wrongpass")).toBe(false);
  });

  it("rejects a wrong username", () => {
    expect(verifyCredentials("someone.else", "OregonMLO2025!")).toBe(false);
  });

  it("rejects empty credentials", () => {
    expect(verifyCredentials("", "")).toBe(false);
  });
});

describe("session tokens", () => {
  it("creates a token that verifies", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects an expired token", () => {
    const past = Date.now() - SESSION_TTL_MS - 1000;
    const token = createSessionToken(past);
    expect(verifySessionToken(token)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken();
    const tampered = token.replace(/.$/, c => (c === "a" ? "b" : "a"));
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it("rejects garbage and undefined tokens", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken("not.a.token")).toBe(false);
    expect(verifySessionToken("")).toBe(false);
  });

  it("exposes the expected cookie name", () => {
    expect(APP_SESSION_COOKIE).toBe("oal_session");
  });
});
