import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { escapeHtml, renderSignature, renderSignatureText } from "./signature";
import type { CompanyWithOffices, EmployeeWithOrg } from "@/types";

// baseUrl() 은 모듈 로드 시점이 아니라 호출 시점에 env 를 읽으므로,
// import 가 호이스팅돼도 테스트가 실행될 때는 이 값이 잡혀 있습니다.
process.env.NEXT_PUBLIC_BASE_URL = "https://dvi-ind.com";

/** 사업장 한 줄. 서명에는 `(우편번호) 주소` 로 합쳐서 나갑니다. */
const office = (
  name: string,
  postalCode: string,
  address: string,
  addressEn: string | null = null,
) => ({
  id: `office_${name}`,
  name,
  postalCode,
  address,
  addressEn,
  sortOrder: 0,
  companyId: "dvision",
});

const company: CompanyWithOffices = {
  id: "dvision",
  nameKo: "(주)디비전",
  nameEn: "DVISION Inc.",
  offices: [office("본사", "43011", "대구광역시 달성군 구지면 국가산단대로33길 237")],
  tel: "053-710-1022",
  fax: "053-715-2096",
  homepageUrl: null,
  homepageUrlEn: null,
  industryEn: null,
  taglineEn: null,
  youtubeUrlEn: null,
  linkedinUrl: null,
  youtubeUrl: null,
  instagramUrl: null,
  brandColor: "#931B82",
  tagline: "자동차 경량 부품 전문",
  certifications: ["IATF 16949", "ISO 9001"],
  certificationsEn: ["IATF 16949", "ISO 9001"],
  industry: "알루미늄 압출 · 정밀가공",
};

/** 조직 목록 행 한 줄. 서명에서는 이름만 의미가 있습니다. */
const orgItem = (name: string) => ({ id: `org_${name}`, name, nameEn: "", sortOrder: 0 });

const employee: EmployeeWithOrg = {
  id: "emp_1",
  slug: "hong",
  email: "hong@dvi-ind.com",
  // 계정 컬럼. 서명 렌더링과는 무관하지만 타입을 채우려면 있어야 합니다.
  passwordHash: null,
  mustChangePassword: false,
  role: "MEMBER",
  nameKo: "홍길동",
  familyName: "홍",
  givenName: "길동",
  nameEn: null,
  rankId: "org_수석매니저",
  rank: orgItem("수석매니저"),
  executiveTitleId: null,
  executiveTitle: null,
  positionId: null,
  position: null,
  teamId: null,
  partId: null,
  credential: "공학박사",
  credentialEn: null,
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
const emp = (overrides: Partial<EmployeeWithOrg> = {}): EmployeeWithOrg => ({
  ...employee,
  ...overrides,
});
const co = (overrides: Partial<CompanyWithOffices> = {}): CompanyWithOffices => ({
  ...company,
  ...overrides,
});

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
  it("명함 이미지를 프로필 링크로 감싼다", () => {
    const html = renderSignature(emp(), co());

    // 이미지 본체 — 절대경로 card.png (Gmail 프록시가 불러올 수 있어야 하므로 https 절대경로)
    assert.match(html, /<img src="https:\/\/dvi-ind\.com\/c\/hong\/card\.png"/);
    // 이미지 전체가 프로필로 연결
    assert.match(html, /<a href="https:\/\/dvi-ind\.com\/c\/hong"/);
    // 이미지를 막은 수신자를 위한 alt
    assert.match(html, /alt="홍길동 명함"/);
    assert.match(html, /width="600"/);
  });

  it("이미지 주소·링크가 어긋나지 않는다 (card.png 는 프로필 경로 + /card.png)", () => {
    const html = renderSignature(emp({ slug: "yeonghui" }), co());

    assert.match(html, /href="https:\/\/dvi-ind\.com\/c\/yeonghui"/);
    assert.match(html, /src="https:\/\/dvi-ind\.com\/c\/yeonghui\/card\.png"/);
  });

  it("alt 의 이름에 든 & 를 이스케이프한다", () => {
    const html = renderSignature(emp({ nameKo: "홍길동 & 김철수" }), co());

    assert.match(html, /alt="홍길동 &amp; 김철수 명함"/);
    assert.ok(!/alt="홍길동 & 김/.test(html), "원본 & 가 그대로 남으면 안 된다");
  });

  it("이름에 태그가 들어와도 alt 가 마크업으로 해석되지 않는다", () => {
    const html = renderSignature(emp({ nameKo: `<script>` }), co());

    assert.ok(!html.includes("<script>"), "태그가 그대로 들어가면 안 된다");
    assert.match(html, /&lt;script&gt;/);
  });
});

describe("renderSignatureText", () => {
  it("줄바꿈이 \\n 인 순수 텍스트를 만든다", () => {
    const text = renderSignatureText(emp(), co());

    assert.equal(
      text,
      [
        "홍길동 수석매니저 · 공학박사",
        "(43011) 대구광역시 달성군 구지면 국가산단대로33길 237",
        "TEL 053-710-1022",
        "FAX 053-715-2096",
        "MOBILE 010-1234-5678",
        "E-MAIL hong@dvi-ind.com",
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

  it("mobilePublic 이 false 면 휴대폰이, fax 가 없으면 FAX 가 빠진다", () => {
    const text = renderSignatureText(emp({ mobilePublic: false }), co({ fax: null }));

    assert.match(text, /^TEL 053-710-1022$/m);
    assert.ok(!text.includes("010-1234-5678"));
    assert.ok(!text.includes("FAX "));
    assert.ok(!text.includes("MOBILE "));
  });

  it("credential 이 없으면 rank 만, 있으면 함께 표시한다", () => {
    assert.match(renderSignatureText(emp({ credential: null }), co()), /^홍길동 수석매니저$/m);
    assert.match(renderSignatureText(emp(), co()), /^홍길동 수석매니저 · 공학박사$/m);
  });
});
