import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export class PasswordHasher {
  public async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await deriveKey(password, salt, KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);

    return [
      "scrypt",
      SCRYPT_N.toString(),
      SCRYPT_R.toString(),
      SCRYPT_P.toString(),
      salt.toString("base64url"),
      derivedKey.toString("base64url"),
    ].join("$");
  }

  public async verify(password: string, storedHash: string): Promise<boolean> {
    const parsedHash = parseStoredHash(storedHash);

    if (!parsedHash) {
      return false;
    }

    const derivedKey = await deriveKey(password, parsedHash.salt, parsedHash.hash.length, parsedHash.n, parsedHash.r, parsedHash.p);

    return derivedKey.length === parsedHash.hash.length && timingSafeEqual(derivedKey, parsedHash.hash);
  }
}

async function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      {
        N: n,
        r,
        p,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function parseStoredHash(storedHash: string):
  | {
      n: number;
      r: number;
      p: number;
      salt: Buffer;
      hash: Buffer;
    }
  | null {
  const [algorithm, n, r, p, salt, hash, ...extra] = storedHash.split("$");

  if (algorithm !== "scrypt" || extra.length > 0 || !n || !r || !p || !salt || !hash) {
    return null;
  }

  return {
    n: Number(n),
    r: Number(r),
    p: Number(p),
    salt: Buffer.from(salt, "base64url"),
    hash: Buffer.from(hash, "base64url"),
  };
}
