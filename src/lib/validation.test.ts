import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { employeeProfileSchema, fullNameKo } from "./validation";

/**
 * 프로필 저장 계약을 지키는 테스트.
 *
 * 여기서 잠그는 건 두 가지입니다.
 *
 * 1) 이름은 성·이름으로 받는다. 한 칸으로 되돌리면 표시 이름만 바뀌고 vCard 의
 *    N 필드는 등록 당시 이름으로 남습니다. (홍박사인데 주소록에는 홍길동)
 * 2) mobilePublic 이 저장 대상이다. 스키마에서 빠지면 화면에서 체크를 켜도
 *    서버가 그 값을 버려서, 번호가 여전히 아무 데도 안 나갑니다.
 */

const valid = {
  familyName: "홍",
  givenName: "길동",
  nameEn: "Gil-dong Hong",
  rankId: "",
  executiveTitleId: "",
  positionId: "",
  credential: "",
  credentialEn: "",
  telWork: "",
  telMobile: "010-1234-5678",
  mobilePublic: true,
  email: "hong@dvi-ind.com",
};

describe("fullNameKo", () => {
  it("성과 이름을 붙인다", () => {
    assert.equal(fullNameKo("홍", "길동"), "홍길동");
  });

  it("두 글자 성도 그대로 붙인다", () => {
    // 합쳐 받은 뒤 쪼개는 구현이었다면 `남;궁민수` 로 틀렸을 값입니다.
    assert.equal(fullNameKo("남궁", "민수"), "남궁민수");
  });
});

describe("employeeProfileSchema", () => {
  it("성·이름을 따로 받는다", () => {
    const parsed = employeeProfileSchema.safeParse(valid);

    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.familyName, "홍");
    assert.equal(parsed.data?.givenName, "길동");
  });

  it("합본 이름(nameKo)은 받지 않는다 — 서버가 만든다", () => {
    const parsed = employeeProfileSchema.safeParse({ ...valid, nameKo: "다른이름" });

    assert.equal(parsed.success, true);
    assert.equal("nameKo" in (parsed.data ?? {}), false);
  });

  it("성이 비면 거부한다", () => {
    const parsed = employeeProfileSchema.safeParse({ ...valid, familyName: "" });

    assert.equal(parsed.success, false);
  });

  it("이름이 비면 거부한다", () => {
    const parsed = employeeProfileSchema.safeParse({ ...valid, givenName: "  " });

    assert.equal(parsed.success, false);
  });

  it("mobilePublic 을 저장 대상으로 통과시킨다", () => {
    const on = employeeProfileSchema.safeParse(valid);
    const off = employeeProfileSchema.safeParse({ ...valid, mobilePublic: false });

    assert.equal(on.data?.mobilePublic, true);
    assert.equal(off.data?.mobilePublic, false);
  });

  it("mobilePublic 이 불리언이 아니면 거부한다", () => {
    // 체크박스 대신 문자열이 오면 "false" 가 참으로 새어 들어갑니다.
    const parsed = employeeProfileSchema.safeParse({ ...valid, mobilePublic: "false" });

    assert.equal(parsed.success, false);
  });

  it("영문명은 여전히 필수다", () => {
    const parsed = employeeProfileSchema.safeParse({ ...valid, nameEn: "" });

    assert.equal(parsed.success, false);
  });
});
