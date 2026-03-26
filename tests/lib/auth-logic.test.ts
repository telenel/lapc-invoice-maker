import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// 6-digit access code pattern — mirrors the detection logic in the NextAuth
// credentials provider without requiring a database connection.
// ---------------------------------------------------------------------------

const ACCESS_CODE_RE = /^\d{6}$/;

describe("6-digit access code regex", () => {
  it("matches a valid 6-digit code", () => {
    expect(ACCESS_CODE_RE.test("123456")).toBe(true);
  });

  it("matches another valid 6-digit code (all zeros)", () => {
    expect(ACCESS_CODE_RE.test("000000")).toBe(true);
  });

  it("does not match a 5-digit string", () => {
    expect(ACCESS_CODE_RE.test("12345")).toBe(false);
  });

  it("does not match a 7-digit string", () => {
    expect(ACCESS_CODE_RE.test("1234567")).toBe(false);
  });

  it("does not match alphabetic characters", () => {
    expect(ACCESS_CODE_RE.test("abcdef")).toBe(false);
  });

  it("does not match a mixed alphanumeric string", () => {
    expect(ACCESS_CODE_RE.test("12abc6")).toBe(false);
  });

  it("does not match a string with a leading space", () => {
    expect(ACCESS_CODE_RE.test(" 123456")).toBe(false);
  });

  it("does not match a string with a trailing space", () => {
    expect(ACCESS_CODE_RE.test("123456 ")).toBe(false);
  });

  it("does not match an empty string", () => {
    expect(ACCESS_CODE_RE.test("")).toBe(false);
  });

  it("does not match a string with special characters", () => {
    expect(ACCESS_CODE_RE.test("12-456")).toBe(false);
  });
});
