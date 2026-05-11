import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type TotpOptions = {
  digits?: number;
  periodSeconds?: number;
  algorithm?: "sha1" | "sha256" | "sha512";
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD_SECONDS = 30;
const DEFAULT_ALGORITHM = "sha1";

export class TotpService {
  public generateSecret(byteLength = 20): string {
    return encodeBase32(randomBytes(byteLength));
  }

  public generateToken(secret: string, timestampMs = Date.now(), options: TotpOptions = {}): string {
    const digits = options.digits ?? DEFAULT_DIGITS;
    const periodSeconds = options.periodSeconds ?? DEFAULT_PERIOD_SECONDS;
    const algorithm = options.algorithm ?? DEFAULT_ALGORITHM;
    const counter = Math.floor(timestampMs / 1000 / periodSeconds);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const hmac = createHmac(algorithm, decodeBase32(secret)).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const binary =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);
    const otp = binary % 10 ** digits;

    return otp.toString().padStart(digits, "0");
  }

  public verifyToken(input: {
    secret: string;
    token: string;
    timestampMs?: number;
    window?: number;
    options?: TotpOptions;
  }): boolean {
    const digits = input.options?.digits ?? DEFAULT_DIGITS;

    if (!new RegExp(`^\\d{${digits}}$`).test(input.token)) {
      return false;
    }

    const timestampMs = input.timestampMs ?? Date.now();
    const periodSeconds = input.options?.periodSeconds ?? DEFAULT_PERIOD_SECONDS;
    const window = input.window ?? 1;

    for (let offset = -window; offset <= window; offset += 1) {
      const candidate = this.generateToken(input.secret, timestampMs + offset * periodSeconds * 1000, input.options);

      if (safeEqual(candidate, input.token)) {
        return true;
      }
    }

    return false;
  }

  public createProvisioningUri(input: {
    issuer: string;
    accountName: string;
    secret: string;
    options?: TotpOptions;
  }): string {
    const digits = input.options?.digits ?? DEFAULT_DIGITS;
    const period = input.options?.periodSeconds ?? DEFAULT_PERIOD_SECONDS;
    const algorithm = (input.options?.algorithm ?? DEFAULT_ALGORITHM).toUpperCase();
    const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.accountName)}`;
    const query = new URLSearchParams({
      secret: input.secret,
      issuer: input.issuer,
      algorithm,
      digits: digits.toString(),
      period: period.toString(),
    });

    return `otpauth://totp/${label}?${query.toString()}`;
  }
}

export function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replaceAll("=", "").replaceAll(" ", "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error("Invalid base32 input");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

