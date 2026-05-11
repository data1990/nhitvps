import { describe, expect, it } from "vitest";
import { decodeBase32, encodeBase32, RecoveryCodeService, TotpService } from "../src/modules/auth/index.js";

describe("2FA services", () => {
  it("encodes and decodes base32 secrets", () => {
    const input = Buffer.from("12345678901234567890");
    const encoded = encodeBase32(input);

    expect(encoded).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(decodeBase32(encoded).equals(input)).toBe(true);
  });

  it("generates RFC 6238 compatible TOTP tokens", () => {
    const service = new TotpService();
    const secret = encodeBase32(Buffer.from("12345678901234567890"));

    expect(
      service.generateToken(secret, 59_000, {
        digits: 8,
        periodSeconds: 30,
        algorithm: "sha1",
      }),
    ).toBe("94287082");
  });

  it("verifies TOTP tokens within a bounded window", () => {
    const service = new TotpService();
    const secret = service.generateSecret();
    const timestamp = 1_778_400_000_000;
    const token = service.generateToken(secret, timestamp);

    expect(service.verifyToken({ secret, token, timestampMs: timestamp })).toBe(true);
    expect(service.verifyToken({ secret, token, timestampMs: timestamp + 90_000, window: 1 })).toBe(false);
  });

  it("hashes and verifies recovery codes", () => {
    const service = new RecoveryCodeService();
    const [code] = service.generateCodes(1);
    const hash = service.hashCode(code!);

    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(service.verifyCode(code!, hash)).toBe(true);
    expect(service.verifyCode("WRONG-CODE-0000", hash)).toBe(false);
  });
});

