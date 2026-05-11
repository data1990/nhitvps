import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export class RecoveryCodeService {
  public generateCodes(count = 10): string[] {
    return Array.from({ length: count }, () => this.generateCode());
  }

  public generateCode(): string {
    const value = randomBytes(10).toString("base64url").replaceAll("-", "").replaceAll("_", "").slice(0, 12);
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`.toUpperCase();
  }

  public hashCode(code: string): string {
    return createHash("sha256").update(normalizeCode(code), "utf8").digest("hex");
  }

  public verifyCode(code: string, codeHash: string): boolean {
    const candidate = Buffer.from(this.hashCode(code), "hex");
    const expected = Buffer.from(codeHash, "hex");

    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
}

function normalizeCode(code: string): string {
  return code.replaceAll("-", "").replaceAll(" ", "").trim().toUpperCase();
}

