import { createHash, randomBytes } from "node:crypto";

export class SessionTokenService {
  public createToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString("base64url");

    return {
      token,
      tokenHash: this.hashToken(token),
    };
  }

  public hashToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }
}

