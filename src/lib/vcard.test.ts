import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVCard } from "./vcard";
import type { Company, Employee } from "@/types";

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
  certifications: ["IATF 16949"],
  industry: "알루미늄 압출 · 정밀가공",
};

const employee: Employee = {
  id: "emp_1",
  slug: "ryu",
  email: "yk.ryu@dvi-ind.com",
  nameKo: "류영균",
  familyName: "류",
  givenName: "영균",
  nameEn: null,
  rank: "대표이사",
  position: null,
  department: "경영지원",
  credential: "공학박사",
  bio: null,
  telWork: "053-710-1022",
  telMobile: "010-3131-6834",
  mobilePublic: true,
  photoUrl: null,
  status: "ACTIVE",
  companyId: "dvision",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const emp = (o: Partial<Employee> = {}): Employee => ({ ...employee, ...o });
const co = (o: Partial<Company> = {}): Company => ({ ...company, ...o });

/** 접힌 줄을 원래대로 펴서 값을 확인할 때 씁니다. */
const unfold = (vcf: string) => vcf.replace(/\r\n /g, "");

describe("buildVCard", () => {
  it("BEGIN/VERSION/END 로 감싼다", () => {
    const vcf = buildVCard(emp(), co());

    assert.ok(vcf.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"));
    assert.ok(vcf.endsWith("END:VCARD\r\n"));
  });

  it("줄바꿈이 전부 CRLF 다", () => {
    const vcf = buildVCard(emp(), co());

    // LF 앞에는 반드시 CR 이 있어야 합니다. 아이폰이 LF 만 있는 파일을 거부합니다.
    assert.ok(!/[^\r]\n/.test(vcf), "LF 단독 줄바꿈이 있으면 안 된다");
  });

  it("N 은 성과 이름을 분리해 넣는다", () => {
    const vcf = unfold(buildVCard(emp(), co()));

    assert.match(vcf, /^N:류;영균;;;$/m);
    assert.match(vcf, /^FN:류영균$/m);
  });

  it("두 글자 성도 분리 저장된 값을 그대로 쓴다", () => {
    // nameKo 를 쪼개는 구현이었다면 `남;궁민수` 로 틀렸을 값입니다.
    const vcf = unfold(
      buildVCard(emp({ nameKo: "남궁민수", familyName: "남궁", givenName: "민수" }), co()),
    );

    assert.match(vcf, /^N:남궁;민수;;;$/m);
  });

  it("mobilePublic 이 false 면 휴대폰을 넣지 않는다", () => {
    const vcf = unfold(buildVCard(emp({ mobilePublic: false }), co()));

    assert.ok(!vcf.includes("010-3131-6834"), "비공개 번호가 나가면 안 된다");
    assert.ok(!vcf.includes("TYPE=CELL"));
    assert.match(vcf, /TEL;TYPE=WORK,VOICE:053-710-1022/);
  });

  it("값이 없는 항목은 줄째로 빠진다", () => {
    const vcf = unfold(
      buildVCard(emp({ telWork: null, credential: null }), co({ fax: null, address: "" })),
    );

    assert.ok(!vcf.includes("NOTE:"));
    assert.ok(!vcf.includes("ADR"));
    assert.ok(!vcf.includes("TYPE=WORK,FAX"));
    // 빈 값이 `TEL;TYPE=WORK,VOICE:` 처럼 라벨만 남으면 안 됩니다.
    assert.ok(!/:\r\n/.test(vcf), "값이 빈 줄이 남으면 안 된다");
  });

  it("직급과 직책이 모두 있으면 TITLE 에 함께 넣는다", () => {
    const vcf = unfold(buildVCard(emp({ rank: "부장", position: "생산본부장" }), co()));

    assert.match(vcf, /^TITLE:부장 생산본부장$/m);
  });

  it("직책이 없으면 직급만 넣는다", () => {
    const vcf = unfold(buildVCard(emp({ rank: "과장", position: null }), co()));

    assert.match(vcf, /^TITLE:과장$/m);
  });

  it("특수문자를 이스케이프한다", () => {
    const vcf = unfold(buildVCard(emp(), co({ nameKo: "디비전; 주식회사, 대구" })));

    assert.match(vcf, /ORG:디비전\\; 주식회사\\, 대구/);
  });

  it("역슬래시를 먼저 이스케이프해 이중 처리가 생기지 않는다", () => {
    const vcf = unfold(buildVCard(emp(), co({ nameKo: "A\\;B" })));

    // `\` → `\\`, `;` → `\;` 이므로 결과는 `A\\\;B` 입니다.
    assert.match(vcf, /ORG:A\\\\\\;B/);
  });

  it("75옥텟을 넘는 줄을 접고, 펴면 원래 값이 나온다", () => {
    const long = "대구광역시 달성군 구지면 국가산단대로33길 237 디비전 제2공장 연구동 3층 품질보증팀";
    const vcf = buildVCard(emp(), co({ address: long }));

    const encoder = new TextEncoder();
    for (const line of vcf.split("\r\n")) {
      assert.ok(encoder.encode(line).length <= 75, `75옥텟 초과: ${line}`);
    }
    // 접힌 줄은 공백 한 칸으로 시작해야 하고, 펴면 원본이 복원돼야 합니다.
    assert.ok(vcf.includes("\r\n "), "접힌 줄이 있어야 한다");
    assert.ok(unfold(vcf).includes(long), "펴면 원래 주소가 나와야 한다");
  });

  it("한글이 접히는 지점에서 깨지지 않는다", () => {
    const vcf = buildVCard(emp(), co({ address: "가".repeat(60) }));

    assert.ok(!unfold(vcf).includes("�"), "대체 문자가 생기면 안 된다");
    assert.match(unfold(vcf), new RegExp(`ADR;TYPE=WORK:;;${"가".repeat(60)};;;;`));
  });

  it("공개 프로필 URL 을 넣는다", () => {
    const vcf = unfold(buildVCard(emp(), co()));

    assert.match(vcf, /^URL:https:\/\/dvi-ind\.com\/c\/ryu$/m);
  });
});
