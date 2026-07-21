import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { escapeHtml, renderSignature, renderSignatureText } from "./signature";
import type { Company, Employee } from "@/types";

// baseUrl() 은 모듈 로드 시점이 아니라 호출 시점에 env 를 읽으므로,
// import 가 호이스팅돼도 테스트가 실행될 때는 이 값이 잡혀 있습니다.
process.env.NEXT_PUBLIC_BASE_URL = "https://dvi-ind.com";

const company: Company = {
  id: "dvision",
  nameKo: "(주)디비전",
  nameEn: "DVISION Inc.",
  address: "대구광역시 달성군 구지면 국가산단대로33길 237",
  tel: "053-710-1022",
  fax: "053-715-2096",
  logoUrl: "/brand/logo.png",
  homepageUrl: null,
  brandColor: "#931B82",
  tagline: "자동차 경량 부품 전문",
  certifications: ["IATF 16949", "ISO 9001"],
  industry: "알루미늄 압출 · 정밀가공",
  foundedYear: 1998,
  capacity: 12000,
  equipmentCount: 86,
  employeeCount: 142,
};

const employee: Employee = {
  id: "emp_1",
  slug: "hong",
  email: "hong@dvi-ind.com",
  nameKo: "홍길동",
  familyName: "홍",
  givenName: "길동",
  nameEn: null,
  rank: "대표이사",
  department: null,
  credential: "공학박사",
  bio: null,
  telWork: "053-710-1022",
  telMobile: "010-1234-5678",
  mobilePublic: true,
  photoUrl: null,
  status: "ACTIVE",
  companyId: "dvision",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

/** 테스트마다 필요한 필드만 덮어씁니다. */
const emp = (overrides: Partial<Employee> = {}): Employee => ({ ...employee, ...overrides });
const co = (overrides: Partial<Company> = {}): Company => ({ ...company, ...overrides });

describe("escapeHtml", () => {
  it("HTML 특수문자 5종을 변환한다", () => {
    assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  });

  it("& 를 먼저 변환해 이중 이스케이프가 생기지 않는다", () => {
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  });
});

describe("renderSignature", () => {
  it("모든 값이 있으면 T·M·F 가 모두 나온다", () => {
    const html = renderSignature(emp(), co());

    assert.match(html, /홍길동/);
    assert.match(html, /대표이사 · 공학박사/);
    assert.match(html, /\(주\)디비전/);
    assert.match(html, /DVISION Inc\./);
    assert.match(html, />T<\/span>&nbsp; 053-710-1022/);
    assert.match(html, />M<\/span>&nbsp; 010-1234-5678/);
    assert.match(html, />F<\/span>&nbsp; 053-715-2096/);
    assert.match(html, /mailto:hong@dvi-ind\.com/);
    assert.match(html, /대구광역시 달성군 구지면 국가산단대로33길 237/);
    assert.match(html, /href="https:\/\/dvi-ind\.com\/c\/hong"/);
  });

  it("검증된 A안 마크업 구조를 유지한다", () => {
    const html = renderSignature(emp(), co());

    // 아웃룩 호환의 핵심 요소들. 이게 깨지면 서명이 무너집니다.
    assert.match(html, /^<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520"/);
    assert.match(html, /border-collapse:collapse;width:520px;/);
    assert.match(html, /mso-line-height-rule:exactly/);
    assert.match(html, /<td width="3" bgcolor="#931B82"/); // 좌측 세로 바
    assert.match(html, /명함 보기 &rsaquo;/);
    assert.ok(!html.includes("\n"), "개행이 없어야 한다");
    assert.ok(!html.includes("<style"), "style 블록을 쓰지 않는다");
    assert.ok(!html.includes("class="), "CSS 클래스를 쓰지 않는다");
  });

  it("telMobile 이 없으면 M 항목이 통째로 빠진다", () => {
    const html = renderSignature(emp({ telMobile: null }), co());

    assert.ok(!html.includes(">M</span>"), "M 라벨이 남으면 안 된다");
    assert.match(html, />T<\/span>/);
    assert.match(html, />F<\/span>/);
    // T 와 F 가 구분자 하나로 이어지고, 구분자가 중복되지 않아야 합니다.
    assert.match(html, /053-710-1022&nbsp;&nbsp;&nbsp;<span[^>]*>F<\/span>/);
  });

  it("mobilePublic 이 false 면 번호가 있어도 M 이 빠진다", () => {
    const html = renderSignature(emp({ mobilePublic: false }), co());

    assert.ok(!html.includes(">M</span>"), "M 라벨이 남으면 안 된다");
    assert.ok(!html.includes("010-1234-5678"), "비공개 번호가 노출되면 안 된다");
  });

  it("credential 이 없으면 rank 만 표시한다", () => {
    const html = renderSignature(emp({ credential: null }), co());

    assert.match(html, /대표이사<\/span>/);
    assert.ok(!html.includes("·"), "구분자가 혼자 남으면 안 된다");
  });

  it("이름의 & 를 이스케이프한다", () => {
    const html = renderSignature(emp({ nameKo: "홍길동 & 김철수" }), co());

    assert.match(html, /홍길동 &amp; 김철수/);
    assert.ok(!/홍길동 & 김/.test(html), "원본 & 가 그대로 남으면 안 된다");
  });

  it("이름에 태그가 들어와도 마크업으로 해석되지 않는다", () => {
    const html = renderSignature(emp({ nameKo: `<script>alert('x')</script>` }), co());

    assert.ok(!html.includes("<script>"), "태그가 그대로 들어가면 안 된다");
    assert.match(html, /&lt;script&gt;/);
  });

  it("fax 가 없으면 F 항목이 빠진다", () => {
    const html = renderSignature(emp(), co({ fax: null }));

    assert.ok(!html.includes(">F</span>"));
    assert.match(html, />M<\/span>/);
  });

  it("전화 정보가 하나도 없으면 그 줄과 <br> 이 함께 사라진다", () => {
    const html = renderSignature(
      emp({ telWork: null, telMobile: null }),
      co({ tel: "", fax: null }),
    );

    assert.ok(!html.includes(">T</span>"));
    assert.ok(!html.includes(">M</span>"));
    assert.ok(!html.includes(">F</span>"));
    // E 줄이 <br> 로 시작하면 앞에 빈 줄이 남은 것입니다.
    assert.ok(!/padding-top:12px;"><br>/.test(html), "빈 줄이 남으면 안 된다");
  });

  it("telWork 가 없으면 회사 대표번호로 대체한다", () => {
    const html = renderSignature(emp({ telWork: null }), co({ tel: "053-000-0000" }));

    assert.match(html, />T<\/span>&nbsp; 053-000-0000/);
  });

  it("brandColor 를 서명 전체에 반영한다", () => {
    const html = renderSignature(emp(), co({ brandColor: "#FF0000" }));

    assert.match(html, /bgcolor="#FF0000"/);
    assert.match(html, /background-color:#FF0000;/);
    assert.match(html, /color:#FF0000;text-decoration:none;font-weight:bold;/);
    assert.ok(!html.includes("#931B82"), "기본 브랜드 컬러가 남으면 안 된다");
  });

  it("brandColor 로 CSS 를 주입할 수 없다", () => {
    const html = renderSignature(emp(), co({ brandColor: "red;background:url(http://evil)" }));

    assert.ok(!html.includes("evil"), "주입된 CSS 가 통과되면 안 된다");
    assert.match(html, /bgcolor="#931B82"/); // 기본값으로 되돌아감
  });
});

describe("renderSignatureText", () => {
  it("줄바꿈이 \\n 인 순수 텍스트를 만든다", () => {
    const text = renderSignatureText(emp(), co());

    assert.equal(
      text,
      [
        "홍길동 대표이사 · 공학박사",
        "(주)디비전 DVISION Inc.",
        "T 053-710-1022  M 010-1234-5678  F 053-715-2096",
        "E hong@dvi-ind.com",
        "A 대구광역시 달성군 구지면 국가산단대로33길 237",
        "명함 보기: https://dvi-ind.com/c/hong",
      ].join("\n"),
    );
    assert.ok(!text.includes("<"), "태그가 들어가면 안 된다");
    assert.ok(!text.includes("&nbsp;"), "HTML 엔티티가 들어가면 안 된다");
  });

  it("평문이므로 & 를 이스케이프하지 않는다", () => {
    const text = renderSignatureText(emp({ nameKo: "홍길동 & 김철수" }), co());

    assert.match(text, /홍길동 & 김철수/);
    assert.ok(!text.includes("&amp;"));
  });

  it("HTML 판과 같은 빈 값 규칙을 따른다", () => {
    const text = renderSignatureText(emp({ mobilePublic: false }), co({ fax: null }));

    assert.match(text, /^T 053-710-1022$/m);
    assert.ok(!text.includes("010-1234-5678"));
    assert.ok(!text.includes("F "));
  });
});
