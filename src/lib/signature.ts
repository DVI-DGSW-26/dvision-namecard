import type { Company, Employee } from "@/types";

/**
 * 이메일 서명 HTML 생성.
 *
 * 마크업은 signature-test.html 의 A안(Compact)을 그대로 옮긴 것입니다.
 * 아웃룩 데스크톱/모바일에서 검증된 구조라 table 중첩, 인라인 스타일, mso-line-height-rule,
 * 1px 스페이서 셀 하나까지 바꾸면 안 됩니다. 값만 치환합니다.
 *
 * 메일 클라이언트는 태그 사이 개행도 공백으로 렌더링할 수 있어서 한 줄로 이어 붙입니다.
 * 반대로 텍스트 안의 공백(`(주)디비전 DVISION Inc.` 사이 등)은 의미가 있으니 건드리지 마세요.
 */

const FONT = "font-family:'맑은 고딕','Malgun Gothic',sans-serif;";

/** 서명 안에서 라벨(T/M/F/E/A)과 회사 영문명에 쓰는 흐린 회색. 브랜드 컬러와 무관하게 고정입니다. */
const LABEL_GRAY = "#A8A8B0";

/** company.brandColor 가 비었거나 형식이 깨졌을 때 쓰는 값. Company.brandColor 의 스키마 기본값과 같습니다. */
const DEFAULT_BRAND = "#931B82";

/**
 * HTML 이스케이프. 사용자가 입력한 값은 예외 없이 전부 통과시킵니다.
 *
 * `&` 를 가장 먼저 바꿔야 합니다. 나중에 바꾸면 앞서 만든 `&lt;` 의 `&` 까지 다시
 * 이스케이프해서 `&amp;lt;` 가 됩니다.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 색상값 검증.
 *
 * brandColor 는 관리자가 자유롭게 입력하는 값이라 그대로 style 속성에 넣으면
 * `red;background:url(...)` 같은 문자열로 CSS 를 주입할 수 있습니다.
 * HTML 이스케이프는 이걸 막지 못합니다(따옴표도 꺾쇠도 필요 없으므로).
 * 그래서 hex 형식인지 확인하고, 아니면 기본값으로 되돌립니다.
 */
function safeColor(value: string | null | undefined): string {
  if (value && /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)) return value;
  return DEFAULT_BRAND;
}

/** 값이 있는 문자열만 남깁니다. 공백만 있는 값도 없는 것으로 취급합니다. */
function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BASE_URL;
  if (!url) {
    // 여기서 조용히 localhost 로 넘어가면 실제 메일에 localhost 링크가 박혀 나갑니다.
    // 되돌릴 수 없는 실수라 차라리 생성 시점에 실패시킵니다.
    throw new Error("NEXT_PUBLIC_BASE_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
  }
  return url.replace(/\/+$/, "");
}

/** 서명에 실제로 노출할 값들을 한곳에서 정리합니다. HTML 판과 텍스트 판이 같은 규칙을 쓰도록. */
function resolveFields(employee: Employee, company: Company) {
  const credential = present(employee.credential);

  return {
    nameKo: employee.nameKo,
    // credential 이 없으면 rank 만. 구분자가 혼자 남지 않도록 배열로 조립합니다.
    roleText: [employee.rank as string, credential].filter(Boolean).join(" · "),
    companyKo: company.nameKo,
    companyEn: present(company.nameEn),
    tel: present(employee.telWork) ?? present(company.tel),
    // mobilePublic 이 false 면 번호가 있어도 공개하지 않습니다.
    mobile: employee.mobilePublic ? present(employee.telMobile) : null,
    fax: present(company.fax),
    email: present(employee.email),
    address: present(company.address),
    profileUrl: `${baseUrl()}/c/${employee.slug}`,
    brand: safeColor(company.brandColor),
  };
}

export function renderSignature(employee: Employee, company: Company): string {
  const f = resolveFields(employee, company);

  const label = (text: string) => `<span style="color:${LABEL_GRAY};">${text}</span>&nbsp; `;

  // T / M / F 는 한 줄에 모입니다. 없는 항목은 통째로 빠지고, 구분자가 끝에 남지 않도록
  // 배열로 모아 join 합니다.
  const phoneItems = [
    f.tel && `${label("T")}${escapeHtml(f.tel)}`,
    f.mobile && `${label("M")}${escapeHtml(f.mobile)}`,
    f.fax && `${label("F")}${escapeHtml(f.fax)}`,
  ].filter(Boolean) as string[];

  // 각 줄도 마찬가지. 빈 줄이 생기면 <br> 까지 같이 사라집니다.
  const contactLines = [
    phoneItems.length ? phoneItems.join("&nbsp;&nbsp;&nbsp;") : null,
    f.email &&
      `${label("E")}<a href="mailto:${escapeHtml(f.email)}" style="color:#4A4A52;text-decoration:none;">${escapeHtml(f.email)}</a>`,
    f.address && `${label("A")}${escapeHtml(f.address)}`,
  ].filter(Boolean) as string[];

  // 연락처가 하나도 없으면 구분선과 셀 자체를 넣지 않습니다.
  const contactRows = contactLines.length
    ? `<tr><td height="1" bgcolor="#E5E5EA" style="height:1px;background-color:#E5E5EA;font-size:1px;line-height:1px;">&nbsp;</td></tr>` +
      `<tr><td style="${FONT}font-size:12px;line-height:20px;mso-line-height-rule:exactly;color:#4A4A52;padding-top:12px;">${contactLines.join("<br>")}</td></tr>`
    : "";

  const nameCell =
    escapeHtml(f.nameKo) +
    (f.roleText
      ? `&nbsp;&nbsp;<span style="font-size:12px;font-weight:normal;color:#6B6B75;">${escapeHtml(f.roleText)}</span>`
      : "");

  const companyCell =
    escapeHtml(f.companyKo) +
    (f.companyEn
      ? ` <span style="color:${LABEL_GRAY};font-weight:normal;">${escapeHtml(f.companyEn)}</span>`
      : "");

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="border-collapse:collapse;width:520px;">` +
    `<tr>` +
    `<td width="3" bgcolor="${f.brand}" style="width:3px;background-color:${f.brand};font-size:1px;line-height:1px;">&nbsp;</td>` +
    `<td width="18" style="width:18px;font-size:1px;line-height:1px;">&nbsp;</td>` +
    `<td style="${FONT}">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    `<tr><td style="${FONT}font-size:17px;line-height:24px;mso-line-height-rule:exactly;color:#1A1A1E;font-weight:bold;padding-bottom:2px;">${nameCell}</td></tr>` +
    `<tr><td style="${FONT}font-size:13px;line-height:19px;mso-line-height-rule:exactly;color:${f.brand};font-weight:bold;padding-bottom:12px;">${companyCell}</td></tr>` +
    contactRows +
    `<tr><td style="${FONT}font-size:12px;line-height:18px;mso-line-height-rule:exactly;padding-top:12px;">` +
    `<a href="${escapeHtml(f.profileUrl)}" style="color:${f.brand};text-decoration:none;font-weight:bold;">명함 보기 &rsaquo;</a>` +
    `</td></tr>` +
    `</table>` +
    `</td>` +
    `</tr>` +
    `</table>`
  );
}

/**
 * Clipboard API 의 text/plain 폴백용 순수 텍스트 서명.
 *
 * 평문이므로 이스케이프하지 않습니다. 여기서 escapeHtml 을 쓰면
 * 이름의 `&` 가 `&amp;` 로 그대로 보입니다.
 */
export function renderSignatureText(employee: Employee, company: Company): string {
  const f = resolveFields(employee, company);

  const phoneItems = [
    f.tel && `T ${f.tel}`,
    f.mobile && `M ${f.mobile}`,
    f.fax && `F ${f.fax}`,
  ].filter(Boolean) as string[];

  const lines = [
    [f.nameKo, f.roleText].filter(Boolean).join(" "),
    [f.companyKo, f.companyEn].filter(Boolean).join(" "),
    phoneItems.length ? phoneItems.join("  ") : null,
    f.email && `E ${f.email}`,
    f.address && `A ${f.address}`,
    `명함 보기: ${f.profileUrl}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}
