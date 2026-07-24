import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generatePassword, hashPassword, verifyPassword } from "./password";

/**
 * 비밀번호 해시의 계약을 지키는 테스트.
 *
 * 여기가 무너지면 증상이 조용합니다 — 로그인은 계속 되는데 아무 값이나 통과하거나,
 * 반대로 맞는 비밀번호가 막혀서 전원이 관리자에게 재발급을 부탁하게 됩니다.
 */

describe("hashPassword / verifyPassword", () => {
  it("맞는 비밀번호를 통과시킨다", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  });

  it("틀린 비밀번호를 막는다", async () => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(await verifyPassword("correct horse battery stapler", hash), false);
  });

  it("같은 비밀번호라도 해시가 매번 다르다", async () => {
    // 소금이 없으면 같은 비밀번호를 쓰는 사람들이 DB 에서 한눈에 묶입니다.
    const a = await hashPassword("same-password-1234");
    const b = await hashPassword("same-password-1234");

    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same-password-1234", a), true);
    assert.equal(await verifyPassword("same-password-1234", b), true);
  });

  it("해시가 없으면 무엇도 통과시키지 않는다", async () => {
    // 아직 발급받지 못한 계정입니다. 빈 값이 빈 비밀번호와 맞아떨어지면 안 됩니다.
    assert.equal(await verifyPassword("", null), false);
    assert.equal(await verifyPassword("anything", null), false);
  });

  it("형식이 깨진 저장값은 던지지 않고 막는다", async () => {
    for (const broken of ["", "not-a-hash", "scrypt$16384$8$1$onlyfive", "bcrypt$a$b$c$d$e"]) {
      assert.equal(await verifyPassword("whatever", broken), false, broken);
    }
  });

  it("해시에 파라미터가 함께 적혀 있다", async () => {
    // 나중에 강도를 올려도 옛 해시를 옛 파라미터로 검증할 수 있어야 합니다.
    const hash = await hashPassword("password-1234");
    const [algorithm, n, r, p] = hash.split("$");

    assert.equal(algorithm, "scrypt");
    assert.ok(Number(n) >= 16384);
    assert.ok(Number(r) > 0);
    assert.ok(Number(p) > 0);
  });
});

describe("generatePassword", () => {
  it("기본 길이는 12자다", () => {
    assert.equal(generatePassword().length, 12);
  });

  it("헷갈리는 글자를 넣지 않는다", () => {
    // 사람이 받아 적는 값이라 0/O, 1/l/I 를 뺐습니다.
    const sample = Array.from({ length: 40 }, () => generatePassword()).join("");

    assert.match(sample, /^[a-zA-Z2-9]+$/);
    assert.equal(/[01lIO]/.test(sample), false);
  });

  it("부를 때마다 다른 값이 나온다", () => {
    const values = new Set(Array.from({ length: 50 }, () => generatePassword()));

    assert.equal(values.size, 50);
  });
});
