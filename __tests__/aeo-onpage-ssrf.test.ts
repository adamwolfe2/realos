import { describe, it, expect } from "vitest";
import { normalizeUrl } from "@/lib/aeo/run-onpage-audit";

describe("lib/aeo/run-onpage-audit — normalizeUrl SSRF guard", () => {
  it("accepts plain https URLs", () => {
    expect(normalizeUrl("https://www.example.com/about")).toBe(
      "https://www.example.com/about",
    );
  });

  it("auto-prefixes https on bare domains", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("rejects file:// URLs", () => {
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects javascript: URLs", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects ftp:// URLs", () => {
    expect(normalizeUrl("ftp://example.com")).toBeNull();
  });

  it("rejects localhost", () => {
    expect(normalizeUrl("http://localhost")).toBeNull();
    expect(normalizeUrl("http://localhost:5432/db")).toBeNull();
    expect(normalizeUrl("LOCALHOST")).toBeNull();
  });

  it("rejects 127.0.0.0/8 loopback", () => {
    expect(normalizeUrl("http://127.0.0.1")).toBeNull();
    expect(normalizeUrl("http://127.1.2.3:8080")).toBeNull();
  });

  it("rejects RFC 1918 private ranges", () => {
    expect(normalizeUrl("http://10.0.0.1")).toBeNull();
    expect(normalizeUrl("http://192.168.1.5")).toBeNull();
    expect(normalizeUrl("http://172.16.0.1")).toBeNull();
    expect(normalizeUrl("http://172.20.0.1")).toBeNull();
    expect(normalizeUrl("http://172.31.255.255")).toBeNull();
  });

  it("does NOT reject 172.32.0.1 (outside RFC 1918)", () => {
    expect(normalizeUrl("http://172.32.0.1")).toBe("http://172.32.0.1/");
  });

  it("rejects 169.254.x.x link-local (cloud metadata)", () => {
    expect(normalizeUrl("http://169.254.169.254/latest/meta-data/")).toBeNull();
  });

  it("rejects Google Cloud metadata hostname", () => {
    expect(
      normalizeUrl("http://metadata.google.internal/computeMetadata/v1/"),
    ).toBeNull();
  });

  it("rejects IPv6 loopback ::1", () => {
    expect(normalizeUrl("http://[::1]")).toBeNull();
  });

  it("rejects IPv6 link-local fe80::", () => {
    expect(normalizeUrl("http://[fe80::1]")).toBeNull();
  });

  it("rejects empty and whitespace input", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
  });

  it("rejects unparseable garbage", () => {
    expect(normalizeUrl("http://[")).toBeNull();
  });
});
