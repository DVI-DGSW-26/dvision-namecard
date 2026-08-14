import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSignatureStale, SIGNATURE_FORMAT_CHANGED_AT } from "./signature-freshness";

/**
 * 판정 규칙만 봅니다. localStorage 는 여기서 건드리지 않습니다 — 저장소를 나중에
 * DB 로 옮겨도 이 테스트는 그대로 살아 있어야 합니다.
 */

const FORMAT = new Date("2026-08-14T00:00:00.000Z");
const day = (d: string) => new Date(`2026-08-${d}T00:00:00.000Z`);

describe("isSignatureStale", () => {
  it("한 번도 복사한 적이 없으면 낡은 것으로 본다", () => {
    assert.equal(
      isSignatureStale({ copiedAt: null, profileUpdatedAt: day("01"), formatChangedAt: FORMAT }),
      true,
    );
  });

  it("프로필을 고친 뒤로 복사하지 않았으면 낡았다", () => {
    // 실제로 신고된 건: 휴대폰 공개를 켰는데 서명에는 안 나온다.
    assert.equal(
      isSignatureStale({
        copiedAt: day("10"),
        profileUpdatedAt: day("12"),
        formatChangedAt: FORMAT,
      }),
      true,
    );
  });

  it("프로필을 고친 뒤에 복사했으면 낡지 않았다", () => {
    assert.equal(
      isSignatureStale({
        copiedAt: day("20"),
        profileUpdatedAt: day("12"),
        formatChangedAt: FORMAT,
      }),
      false,
    );
  });

  it("서명 구조가 바뀐 뒤로 복사하지 않았으면 낡았다", () => {
    // 프로필은 그대로여도(오래전 저장) 구조가 바뀌면 다시 복사해야 합니다.
    assert.equal(
      isSignatureStale({
        copiedAt: day("13"),
        profileUpdatedAt: day("01"),
        formatChangedAt: FORMAT,
      }),
      true,
    );
  });

  it("구조가 바뀐 뒤에 복사했으면 낡지 않았다", () => {
    assert.equal(
      isSignatureStale({
        copiedAt: day("15"),
        profileUpdatedAt: day("01"),
        formatChangedAt: FORMAT,
      }),
      false,
    );
  });

  it("둘 중 하나만 걸려도 낡았다고 본다", () => {
    // 구조 변경 이후에 복사했지만, 그 뒤에 프로필을 또 고친 경우.
    assert.equal(
      isSignatureStale({
        copiedAt: day("15"),
        profileUpdatedAt: day("16"),
        formatChangedAt: FORMAT,
      }),
      true,
    );
  });

  it("기본 formatChangedAt 은 상수를 쓴다", () => {
    // 인자를 안 주면 배포된 값으로 판정해야 합니다. 상수 하루 전에 복사했다면 낡았고,
    // 하루 뒤에 복사했다면 아닙니다.
    const before = new Date(SIGNATURE_FORMAT_CHANGED_AT.getTime() - 86_400_000);
    const after = new Date(SIGNATURE_FORMAT_CHANGED_AT.getTime() + 86_400_000);
    const old = new Date("2020-01-01T00:00:00.000Z");

    assert.equal(isSignatureStale({ copiedAt: before, profileUpdatedAt: old }), true);
    assert.equal(isSignatureStale({ copiedAt: after, profileUpdatedAt: old }), false);
  });
});
