import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface StoredUser {
  email: string;
  passwordHash: string;
  createdAt: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new Error("Введите корректный email");
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
    throw new Error("Введите корректный email");
  }
  return trimmed;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Пароль должен содержать не менее 8 символов");
  }
  if (password.length > 128) {
    throw new Error("Пароль не должен превышать 128 символов");
  }
  return password;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$100000$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];
  const derived = crypto
    .pbkdf2Sync(password, salt, iterations, 32, "sha256")
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
}

export class AuthStore {
  private usersFile: string;
  private secretKey: string;
  private users = new Map<string, StoredUser>();

  constructor(dataDir: string, secretKey?: string) {
    this.usersFile = path.join(dataDir, "users.json");
    this.secretKey =
      secretKey ||
      process.env.SECRET_KEY ||
      crypto.createHash("sha256").update(dataDir + "|reshis-avia").digest("hex");
    this.load();
    this.ensureDemoUser();
  }

  private load() {
    if (fs.existsSync(this.usersFile)) {
      try {
        const list = JSON.parse(fs.readFileSync(this.usersFile, "utf8")) as StoredUser[];
        for (const u of list) {
          this.users.set(u.email, u);
        }
      } catch {
        this.users.clear();
      }
    }
  }

  private save() {
    fs.writeFileSync(
      this.usersFile,
      JSON.stringify(Array.from(this.users.values()), null, 2),
      "utf8"
    );
  }

  private ensureDemoUser() {
    const demoEmail = "demo@reshis.avia";
    if (!this.users.has(demoEmail)) {
      this.users.set(demoEmail, {
        email: demoEmail,
        passwordHash: hashPassword("Demo12345"),
        createdAt: new Date().toISOString(),
      });
      this.save();
    }
  }

  register(rawEmail: unknown, rawPassword: unknown): { token: string; user: { email: string } } {
    const email = normalizeEmail(rawEmail);
    const password = validatePassword(rawPassword);
    if (this.users.has(email)) {
      const err = new Error("Пользователь с таким email уже зарегистрирован") as Error & {
        status?: number;
      };
      err.status = 409;
      throw err;
    }
    this.users.set(email, {
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    this.save();
    return { token: this.issueToken(email), user: { email } };
  }

  login(rawEmail: unknown, rawPassword: unknown): { token: string; user: { email: string } } {
    const email = normalizeEmail(rawEmail);
    if (typeof rawPassword !== "string" || !rawPassword) {
      const err = new Error("Неверный email или пароль") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    const user = this.users.get(email);
    if (!user || !verifyPassword(rawPassword, user.passwordHash)) {
      const err = new Error("Неверный email или пароль") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    return { token: this.issueToken(email), user: { email } };
  }

  issueToken(email: string): string {
    const payload = Buffer.from(
      JSON.stringify({
        email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      })
    ).toString("base64url");
    const sig = crypto
      .createHmac("sha256", this.secretKey)
      .update(payload)
      .digest("base64url");
    return `${payload}.${sig}`;
  }

  verifyToken(token: string): { email: string } | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto
      .createHmac("sha256", this.secretKey)
      .update(payload)
      .digest("base64url");
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        email: string;
        exp: number;
      };
      if (!data.email || Date.now() > data.exp) return null;
      if (!this.users.has(data.email)) return null;
      return { email: data.email };
    } catch {
      return null;
    }
  }
}
