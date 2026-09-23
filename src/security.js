import crypto from "node:crypto";

const b64url = (value) => Buffer.from(value).toString("base64url");

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, encoded) {
  const [salt, stored] = String(encoded || "").split(":");
  if (!salt || !stored) return false;
  const calculated = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return expected.length === calculated.length && crypto.timingSafeEqual(expected, calculated);
}

export function signToken(payload, secret, expiresInSeconds = 8 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encoded = b64url(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyToken(token, secret) {
  const [encoded, provided] = String(token || "").split(".");
  if (!encoded || !provided) throw new Error("Token invalido");
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Firma invalida");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token vencido");
  return payload;
}

export const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

