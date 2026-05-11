import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isSameOrigin } from "../same-origin";

/**
 * Build a minimal RequestLike object (just `headers.get`). The helper
 * doesn't touch anything else on the request.
 */
function buildRequest(opts: {
  origin?: string;
  referer?: string;
  host?: string;
}) {
  const headers = new Headers();
  if (opts.origin !== undefined) headers.set("origin", opts.origin);
  if (opts.referer !== undefined) headers.set("referer", opts.referer);
  if (opts.host !== undefined) headers.set("host", opts.host);
  return { headers };
}

describe("isSameOrigin", () => {
  let savedAuthUrl: string | undefined;

  beforeEach(() => {
    savedAuthUrl = process.env.AUTH_URL;
  });

  afterEach(() => {
    if (savedAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = savedAuthUrl;
    }
  });

  it("accepts an Origin matching the request host (preview deploy)", () => {
    delete process.env.AUTH_URL;
    const req = buildRequest({
      origin: "https://sentinel-pr-42.vercel.app",
      host: "sentinel-pr-42.vercel.app",
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("accepts an Origin matching the configured AUTH_URL", () => {
    process.env.AUTH_URL = "https://sentinel.example.com";
    const req = buildRequest({
      origin: "https://sentinel.example.com",
      host: "internal-host.local",
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("rejects an Origin from a different host", () => {
    process.env.AUTH_URL = "https://sentinel.example.com";
    const req = buildRequest({
      origin: "https://evil.example.com",
      host: "sentinel.example.com",
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("falls back to Referer when Origin is missing", () => {
    process.env.AUTH_URL = "https://sentinel.example.com";
    const req = buildRequest({
      referer: "https://sentinel.example.com/coordinator",
      host: "sentinel.example.com",
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("rejects a Referer from a different host", () => {
    process.env.AUTH_URL = "https://sentinel.example.com";
    const req = buildRequest({
      referer: "https://evil.example.com/page",
      host: "sentinel.example.com",
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("rejects when neither Origin nor Referer is present", () => {
    process.env.AUTH_URL = "https://sentinel.example.com";
    const req = buildRequest({
      host: "sentinel.example.com",
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("is case-insensitive on host comparison", () => {
    process.env.AUTH_URL = "https://Sentinel.example.com";
    const req = buildRequest({
      origin: "https://SENTINEL.EXAMPLE.COM",
      host: "sentinel.example.com",
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("rejects malformed Origin URLs", () => {
    process.env.AUTH_URL = "https://sentinel.example.com";
    const req = buildRequest({
      origin: "not-a-url",
      host: "sentinel.example.com",
    });
    expect(isSameOrigin(req)).toBe(false);
  });
});
