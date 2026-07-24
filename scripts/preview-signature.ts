import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { renderSignature, renderSignatureText } from "../src/lib/signature";
import type { CompanyWithOffices, EmployeeWithOrg } from "../src/types";

/**
 * 서명 HTML 을 파일로 뽑아내는 스크립트. `pnpm sig:preview` 로 실행합니다.
 *
 * DB 없이 동작합니다. 1주차 목표가 "서명 1개를 하드코딩해서 실제 메일로 검증" 이므로
 * 여기서 나온 out/signature.html 을 브라우저로 열고 → 전체 선택 → 복사 →
 * 아웃룩/지메일 서명 설정에 붙여넣고 자기 자신에게 보내보는 것까지가 한 사이클입니다.
 */

const company = {
  id: "dvision",
  nameKo: "(주)디비전",
  nameEn: "DVISION Inc.",
  // 사업장이 둘일 때 서명이 어떻게 보이는지 확인하려고 둘 다 넣어 둡니다.
  offices: [
    { id: "o1", name: "본사", postalCode: "43011", address: "대구광역시 달성군 구지면 국가산단대로33길 237", sortOrder: 10, companyId: "dvision" },
    { id: "o2", name: "R&D센터", postalCode: "41585", address: "대구 북구 홈암로 51", sortOrder: 20, companyId: "dvision" },
  ],
  tel: "053-710-1022",
  fax: "053-715-2096",
  homepageUrl: "https://dvi-ind.com",
  // config/tokens.ts 의 primary 와 같은 값이어야 합니다. 어긋나면 미리보기가
  // 실제 서명과 다른 색으로 나와서, 색을 확인하려고 뽑는 의미가 없어집니다.
  brandColor: "#931B82",
  tagline: "알루미늄 압출 · 정밀가공 | 자동차 경량 부품 전문",
  certifications: ["IATF 16949", "ISO 9001"],
  stats: [],
} as unknown as CompanyWithOffices;

// slug 은 실제 DB 에 있는 값이어야 합니다. 이제 서명이 /c/[slug]/card.png 이미지를
// 가리키고, 그 이미지는 dev 서버가 DB 를 조회해 생성하기 때문입니다. (seed 의 "hong")
const employee = {
  id: "preview",
  slug: "hong",
  email: "yg.ryu@dvi-ind.com",
  nameKo: "류영균",
  familyName: "류",
  givenName: "영균",
  nameEn: "Youngkyun Ryu",
  rank: { id: "r1", name: "수석매니저", nameEn: "Chief Manager", sortOrder: 0 },
  executiveTitle: null,
  position: null,
  credential: "공학박사",
  bio: "더 가볍고 강한 부품과 스마트한 제조로 미래를 만듭니다",
  bioEn: null,
  telWork: "053-710-1022",
  telMobile: "010-3131-6834",
  mobilePublic: true,
  photoUrl: null,
  status: "ACTIVE",
  companyId: "dvision",
} as unknown as EmployeeWithOrg;

const signature = renderSignature(employee, company);

// 서명 자체는 <style> 을 못 쓰지만, 이 미리보기 껍데기는 브라우저 전용이라 무관합니다.
// 복사 대상은 점선 안쪽뿐입니다.
const page = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8" /><title>서명 미리보기 — ${employee.nameKo}</title></head>
<body style="margin:0;padding:40px;background:#F4F4F7;font-family:sans-serif;">
  <p style="font-size:13px;color:#6B6B75;">아래 점선 안쪽만 드래그해서 복사하세요.</p>
  <div style="border:1px dashed #C9C9D2;padding:24px;background:#FFFFFF;display:inline-block;">
${signature}
  </div>
</body>
</html>`;

mkdirSync("out", { recursive: true });
writeFileSync("out/signature.html", page, "utf8");
writeFileSync("out/signature.raw.html", signature, "utf8");
writeFileSync("out/signature.txt", renderSignatureText(employee, company), "utf8");

console.log("생성 완료:");
console.log("  out/signature.html      브라우저로 열어서 복사용");
console.log("  out/signature.raw.html  서명 마크업만 (메일 클라이언트 직접 주입용)");
console.log("  out/signature.txt       text/plain 대체본");
