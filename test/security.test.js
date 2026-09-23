import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, sha256, signToken, verifyPassword, verifyToken } from "../src/security.js";

test("passwords use salted hashes and verify correctly", () => {
  const first = hashPassword("Admin123!");
  const second = hashPassword("Admin123!");
  assert.notEqual(first, second);
  assert.equal(verifyPassword("Admin123!", first), true);
  assert.equal(verifyPassword("incorrect", first), false);
});

test("signed tokens reject tampering", () => {
  const token = signToken({ sub: "user-1", role: "ADMIN" }, "secret", 60);
  assert.equal(verifyToken(token, "secret").sub, "user-1");
  assert.throws(() => verifyToken(`${token}x`, "secret"));
});

test("sha256 is deterministic", () => {
  assert.equal(sha256("ticket"), sha256("ticket"));
  assert.notEqual(sha256("ticket"), sha256("other"));
});
