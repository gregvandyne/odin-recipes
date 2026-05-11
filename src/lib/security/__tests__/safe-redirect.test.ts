import { describe, it, expect } from "vitest";
import { safeNextPath } from "../safe-redirect";

describe("safeNextPath", () => {
  it("accepts simple absolute paths", () => {
    expect(safeNextPath("/v")).toBe("/v");
    expect(safeNextPath("/coordinator/messages/abc")).toBe("/coordinator/messages/abc");
  });

  it("preserves a query string and a hash on a same-origin path", () => {
    expect(safeNextPath("/v/insights?week=4")).toBe("/v/insights?week=4");
    expect(safeNextPath("/admin/audit?action=flag.resolve#row-7")).toBe(
      "/admin/audit?action=flag.resolve#row-7",
    );
  });

  it("rejects protocol-relative URLs (//evil)", () => {
    expect(safeNextPath("//evil.example/path")).toBe("/");
    expect(safeNextPath("//attacker.com")).toBe("/");
  });

  it("rejects backslash-style protocol-relative tricks", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/\\\\foo")).toBe("/");
  });

  it("rejects absolute URLs with scheme", () => {
    expect(safeNextPath("https://evil.example/page")).toBe("/");
    expect(safeNextPath("http://attacker.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects URL-encoded protocol-relative tricks", () => {
    // After decode, %2F%2Fevil.example would start with "//" which is unsafe.
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/");
  });

  it("rejects values that don't start with a slash", () => {
    expect(safeNextPath("evil")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("..")).toBe("/");
  });

  it("rejects values with whitespace", () => {
    expect(safeNextPath("/ /evil")).toBe("/");
    expect(safeNextPath("/v\n/evil")).toBe("/");
  });

  it("rejects oversized inputs", () => {
    expect(safeNextPath("/" + "a".repeat(2000))).toBe("/");
  });

  it("returns the supplied fallback when input is invalid", () => {
    expect(safeNextPath(undefined, "/coordinator")).toBe("/coordinator");
    expect(safeNextPath(null, "/admin")).toBe("/admin");
    expect(safeNextPath(123, "/v")).toBe("/v");
    expect(safeNextPath("https://evil.example", "/v")).toBe("/v");
  });

  it("accepts the root path", () => {
    expect(safeNextPath("/")).toBe("/");
  });

  it("rejects malformed percent-encoding", () => {
    // Doesn't throw — just falls back to default.
    expect(safeNextPath("/%E0%A4%A")).toBe("/");
  });
});
