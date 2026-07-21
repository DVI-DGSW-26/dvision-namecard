import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_REDIRECT, safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("내부 경로는 그대로 통과시킨다", () => {
    assert.equal(safeRedirect("/edit"), "/edit");
    assert.equal(safeRedirect("/admin/employees"), "/admin/employees");
    assert.equal(safeRedirect("/edit?e=ryu"), "/edit?e=ryu");
  });

  it("값이 없으면 기본 경로로 보낸다", () => {
    assert.equal(safeRedirect(null), DEFAULT_REDIRECT);
    assert.equal(safeRedirect(undefined), DEFAULT_REDIRECT);
    assert.equal(safeRedirect(""), DEFAULT_REDIRECT);
  });

  it("절대 URL 은 막는다", () => {
    assert.equal(safeRedirect("https://evil.example"), DEFAULT_REDIRECT);
    assert.equal(safeRedirect("http://evil.example"), DEFAULT_REDIRECT);
    assert.equal(safeRedirect("javascript:alert(1)"), DEFAULT_REDIRECT);
  });

  it("프로토콜 상대 URL 은 막는다", () => {
    // 이게 통과하면 //evil.example 로 그대로 나갑니다.
    assert.equal(safeRedirect("//evil.example"), DEFAULT_REDIRECT);
    assert.equal(safeRedirect("//evil.example/path"), DEFAULT_REDIRECT);
  });

  it("역슬래시 변형도 막는다", () => {
    // 일부 브라우저가 /\evil.example 을 //evil.example 과 같게 해석합니다.
    assert.equal(safeRedirect("/\\evil.example"), DEFAULT_REDIRECT);
  });

  it("제어문자가 섞이면 막는다", () => {
    assert.equal(safeRedirect("/edit\nSet-Cookie: x=1"), DEFAULT_REDIRECT);
    assert.equal(safeRedirect("/edit\r\n"), DEFAULT_REDIRECT);
    assert.equal(safeRedirect("/edit\t"), DEFAULT_REDIRECT);
  });

  it("/gate 로 되돌리지 않는다", () => {
    // 로그인 직후 다시 로그인 화면이 뜨는 고리를 막습니다.
    assert.equal(safeRedirect("/gate"), DEFAULT_REDIRECT);
    assert.equal(safeRedirect("/gate?next=/edit"), DEFAULT_REDIRECT);
  });

  it("경로 일부가 gate 로 시작해도 정상 경로면 통과시킨다", () => {
    assert.equal(safeRedirect("/gateway"), "/gateway");
  });
});
