import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cardName, requireCardName } from "./lang";

/**
 * 영문 카드에 한글이 새지 않는지 지키는 테스트.
 *
 * 이 규칙은 한 줄만 되돌리면(`?? employee.nameKo`) 조용히 무너집니다. 그때 깨지는
 * 건 화면 어딘가가 아니라 거래처에 이미 건네진 명함이라, 여기서 잠가 둡니다.
 */

const emp = (nameEn: string | null) => ({ nameKo: "류영균", nameEn });

describe("cardName", () => {
  it("국문 카드는 한글 이름을 쓴다", () => {
    assert.equal(cardName(emp("Young-gyun Ryu"), "ko"), "류영균");
  });

  it("영문 카드는 영문명을 쓴다", () => {
    assert.equal(cardName(emp("Young-gyun Ryu"), "en"), "Young-gyun Ryu");
  });

  it("영문명이 없으면 영문 카드는 null 이다 — 한글 이름으로 떨어지지 않는다", () => {
    assert.equal(cardName(emp(null), "en"), null);
  });

  it("공백만 있는 영문명도 없는 것으로 본다", () => {
    // 폼에서 스페이스 한 칸을 지우지 않고 저장한 값입니다. 이걸 이름으로 인정하면
    // 이름 자리가 빈 영문 명함이 나갑니다.
    assert.equal(cardName(emp("   "), "en"), null);
  });

  it("영문명 앞뒤 공백은 떼고 쓴다", () => {
    assert.equal(cardName(emp("  Young-gyun Ryu  "), "en"), "Young-gyun Ryu");
  });

  it("영문명이 없어도 국문 카드는 멀쩡하다", () => {
    assert.equal(cardName(emp(null), "ko"), "류영균");
  });
});

describe("requireCardName", () => {
  it("값이 있으면 그대로 돌려준다", () => {
    assert.equal(requireCardName(emp("Young-gyun Ryu"), "en"), "Young-gyun Ryu");
  });

  it("영문명이 없으면 던진다 — 404 가드를 빠뜨린 화면이 조용히 한글을 내보내지 못하게", () => {
    assert.throws(() => requireCardName(emp(null), "en"), /영문명이 없어/);
  });
});
