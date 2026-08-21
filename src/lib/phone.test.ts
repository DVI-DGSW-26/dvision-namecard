import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { displayPhone, internationalPhone } from "./phone";

describe("internationalPhone", () => {
  it("앞자리 0 을 국가번호로 바꾼다", () => {
    // 0 은 국내에서만 붙이는 숫자입니다. 떼지 않고 +82 만 붙이면
    // (+82-053-…) 해외에서 그대로 눌러도 연결되지 않습니다.
    assert.equal(internationalPhone("053-710-1022"), "+82-53-710-1022");
    assert.equal(internationalPhone("010-1234-5678"), "+82-10-1234-5678");
    assert.equal(internationalPhone("02-123-4567"), "+82-2-123-4567");
  });

  it("앞자리 0 이 없는 대표번호는 번호를 그대로 두고 국가번호만 붙인다", () => {
    assert.equal(internationalPhone("1588-1234"), "+82-1588-1234");
  });

  it("이미 국제 표기인 번호는 손대지 않는다", () => {
    // 두 번 감싸면 +82-+82-… 가 됩니다.
    assert.equal(internationalPhone("+82-53-710-1022"), "+82-53-710-1022");
    assert.equal(internationalPhone("+1-408-555-0100"), "+1-408-555-0100");
  });
});

describe("displayPhone", () => {
  it("국문은 저장된 값 그대로 쓴다", () => {
    assert.equal(displayPhone("053-710-1022", "ko"), "053-710-1022");
  });

  it("영문은 국제 표기로 바꾼다", () => {
    assert.equal(displayPhone("053-710-1022", "en"), "+82-53-710-1022");
  });

  it("빈 값은 null 이다", () => {
    // 부르는 쪽이 전부 "없으면 그 줄을 뺀다" 로 움직입니다.
    // 빈 문자열이 새어 나가면 라벨만 남은 줄(TEL) 이 카드에 박힙니다.
    assert.equal(displayPhone("", "en"), null);
    assert.equal(displayPhone("   ", "en"), null);
    assert.equal(displayPhone(null, "en"), null);
    assert.equal(displayPhone(undefined, "ko"), null);
  });
});
