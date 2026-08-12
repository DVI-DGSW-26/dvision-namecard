import { tokens } from "@/config/tokens";
import { CARD_TEXT, cardPath, requireCardName, type Lang } from "@/lib/lang";
import { officeLines, roleParts } from "@/lib/org";
import type { CompanyWithOffices, EmployeeWithOrg } from "@/types";

/**
 * 이메일 서명 생성.
 *
 * 서명 본체는 명함을 통째로 구운 PNG 한 장입니다(/c/[slug]/card.png). Gmail 이 CSS
 * 배경 이미지를 지우고 요소 겹침도 지원하지 않아, 디자인의 "글자 뒤 워터마크" 를 HTML
 * 로는 못 만듭니다. 카드 전체를 이미지로 두면 워터마크까지 디자인 그대로, 어느 메일
 * 클라이언트에서든 동일하게 보입니다.
 *
 * 대가: 이미지라 안의 글자·번호는 눌리지 않습니다. 그래서 이미지 전체를 명함 프로필
 * 링크로 감쌉니다(클릭 → /c/[slug], 거기서 전화·저장 등 실제 동작). 이미지를 막은
 * 수신자는 alt 텍스트를 보고, text/plain 만 읽는 클라이언트는 renderSignatureText 를 받습니다.
 *
 * 이미지 주소는 절대경로(NEXT_PUBLIC_BASE_URL)여야 합니다 — Gmail 은 이미지를 구글 프록시로
 * 불러오므로 공개된 https 주소가 아니면(로컬 localhost 등) 뜨지 않습니다.
 */

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

/** 서명 텍스트 폴백에 쓸 값들. HTML 이미지 카드(card.png)와 같은 노출 규칙을 따릅니다. */
function resolveFields(employee: EmployeeWithOrg, company: CompanyWithOffices, lang: Lang) {
  const en = lang === "en";
  return {
    // 영문 서명은 영문명을 씁니다. 안 적었으면 만들지 않습니다 — 한글로 떨어뜨리면
    // 영문 메일에 한글 이름이 붙어 나가고, 서명은 한 번 넣으면 계속 나갑니다.
    nameKo: requireCardName(employee, lang),
    // 직위 · 임원 직책 · 직책 · 자격을 한 줄로. 없는 항목은 통째로 빠지고
    // 구분자가 혼자 남지 않도록 조립합니다.
    roleText: [
      ...roleParts(employee, lang),
      present(en ? employee.credentialEn : employee.credential),
    ]
      .filter(Boolean)
      .join(" · "),
    // TEL 은 개인 사무실 번호 우선, 없으면 회사 대표번호.
    tel: present(employee.telWork) ?? present(company.tel),
    // mobilePublic 이 false 면 번호가 있어도 공개하지 않습니다.
    mobile: employee.mobilePublic ? present(employee.telMobile) : null,
    // 팩스는 회사 공용 번호입니다.
    fax: present(company.fax),
    email: present(employee.email),
    // 사업장이 여러 곳이면 전부 줄을 나눠 넣습니다. `(43011) 대구시 …` 형태입니다.
    // 영문은 영문 주소만 나갑니다 — 안 채운 사업장은 줄이 빠집니다.
    addresses: officeLines(company.offices, lang),
    profileUrl: `${baseUrl()}${cardPath(employee.slug, lang)}`,
  };
}

/**
 * 메일에서도 버티는 글꼴 지정.
 *
 * 웹폰트는 못 씁니다(Gmail 이 @font-face 를 지웁니다). 받는 사람 기기에 이미 있는
 * 글꼴만 나열하고, 한글이 없는 글꼴을 먼저 적어도 한글 글리프는 뒤 항목에서 옵니다.
 */
const CTA_FONT =
  "-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Arial,sans-serif";

/**
 * 명함 이미지 아래에 붙는 클릭 유도 버튼.
 *
 * 서명이 이미지 한 장이라 받는 사람 눈에는 그냥 그림입니다 — 눌러 볼 생각 자체를
 * 하지 않습니다. 그래서 카드는 손대지 않고(모양은 card.png 가 정합니다) 그 아래에
 * 버튼을 한 줄 답니다. 카드 안에 넣지 않는 건 디자인을 지키기 위해서이기도 하지만,
 * 이미지 안의 "눌러 보세요" 는 눌러도 아무 일이 없어서 오히려 신뢰를 깎기 때문입니다.
 *
 * a 태그에 padding 을 준 버튼이 아니라 표(table)로 만든 이유: Outlook 데스크톱은
 * Word 엔진이라 inline-block 의 padding 을 무시해서, 글자에 배경색만 딱 붙은 모양이
 * 됩니다. 배경·테두리를 td 가 맡으면 어느 클라이언트에서든 버튼으로 보입니다.
 * (border-radius 를 못 읽는 Outlook 에서는 각진 버튼이 됩니다 — 그 정도는 괜찮습니다.)
 *
 * 색은 primary 를 씁니다. "화면의 5% 이내" 규칙에서 CTA 는 허용된 자리입니다.
 */
function renderCta(profileUrl: string, lang: Lang): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">` +
    `<tr>` +
    // bgcolor 속성을 style 과 같이 적습니다 — 예전 Outlook 은 td 의 background-color 를 무시합니다.
    `<td bgcolor="${tokens.color.primarySoft}" style="background-color:${tokens.color.primarySoft};border:1px solid ${tokens.color.primary};border-radius:6px;padding:${tokens.space.sibling}px ${tokens.space.group}px;">` +
    `<a href="${escapeHtml(profileUrl)}" style="display:inline-block;color:${tokens.color.primary};text-decoration:none;font-family:${CTA_FONT};font-size:${tokens.font.captionBold.size}px;font-weight:${tokens.font.captionBold.weight};line-height:1.4;letter-spacing:${tokens.letterSpacing};white-space:nowrap;">` +
    // 고정 문구라 이스케이프하지 않습니다. 사용자 입력이 아닙니다.
    CARD_TEXT[lang].signatureCta +
    `</a>` +
    `</td>` +
    `</tr>` +
    `</table>`
  );
}

/**
 * 서명에 박히는 명함 이미지의 표시 폭.
 *
 * 원본 PNG 는 600x340 입니다. 그대로 600 으로 넣으면 메일 본문 폭(보통 600~700px)을
 * 서명 하나가 꽉 채워서, 본문보다 서명이 더 커 보입니다. 400 으로 줄여 붙입니다.
 *
 * 더 줄이지는 마세요. 카드가 이미지라 안의 글자도 같이 줄어듭니다 — 화면에 찍히는
 * 크기는 원본 글자 크기 x (표시폭/600) 이라, 400 에서 연락처 글자(원본 14px)가 이미
 * 9.3px 입니다. 이미지라 드래그 복사도 안 되니 이 아래로는 이메일 주소를 눈으로
 * 읽어 옮겨 적기 어려워집니다.
 *
 * 원본을 400 으로 다시 굽지 않는 이유: 600 짜리를 400 에 넣으면 1.5 배로 눌려 들어가
 * 고해상도 화면(맥·최신 노트북)에서 오히려 더 또렷합니다. 파일 크기도 수십 KB 그대로입니다.
 */
const CARD_DISPLAY_WIDTH = 400;

/**
 * 서명 HTML — 명함 이미지 한 장을 프로필 링크로 감싸고, 그 아래 버튼을 답니다.
 *
 * 카드의 실제 모양(이름·역할·로고·주소·연락처·워터마크)과 값 노출 규칙은 이미지 라우트
 * (app/c/[slug]/card.png)가 정합니다. 여기서는 그 이미지를 가리키고 클릭을 걸 뿐입니다.
 *
 * 바깥을 표로 감싸는 이유: 이미지와 버튼을 div 로 쌓으면 Outlook 이 사이에 제멋대로
 * 여백을 넣고, 메일 클라이언트가 서명을 인용문 안에 넣을 때 두 줄이 갈라지기도 합니다.
 */
export function renderSignature(
  employee: EmployeeWithOrg,
  _company: CompanyWithOffices,
  lang: Lang = "ko",
): string {
  // _company 는 renderSignatureText 와 시그니처를 맞추려고 받습니다. 카드의 실제 값은
  // 이미지 라우트가 DB 에서 직접 읽으므로 여기서는 slug·이름만 있으면 됩니다.
  const base = baseUrl();
  const cardUrl = `${base}${cardPath(employee.slug, lang, "card.png")}`;
  const profileUrl = `${base}${cardPath(employee.slug, lang)}`;
  // 이미지를 막은 수신자가 보는 글자입니다. 영문 서명이면 영문 이름으로 나갑니다.
  const altName = requireCardName(employee, lang);

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    `<tr><td style="padding:0;">` +
    `<a href="${escapeHtml(profileUrl)}" style="display:inline-block;text-decoration:none;">` +
    // width 속성과 style 을 같이 적습니다 — Outlook 데스크톱은 style 의 width 를 무시하고
    // 속성만 봅니다. 둘 중 하나만 두면 클라이언트마다 크기가 달라집니다.
    `<img src="${escapeHtml(cardUrl)}" alt="${escapeHtml(CARD_TEXT[lang].cardOf(altName))}" width="${CARD_DISPLAY_WIDTH}" style="display:block;border:0;width:${CARD_DISPLAY_WIDTH}px;max-width:100%;height:auto;" />` +
    `</a>` +
    `</td></tr>` +
    // 카드와 버튼이 한 덩어리로 보이도록 8px 만 띄웁니다. 더 벌리면 서명에 딸린 별개 링크처럼 읽힙니다.
    `<tr><td style="padding:${tokens.space.sibling}px 0 0;">${renderCta(profileUrl, lang)}</td></tr>` +
    `</table>`
  );
}

/**
 * Clipboard API 의 text/plain 폴백용 순수 텍스트 서명. 이미지를 아예 못 쓰는 환경의 마지막 보루입니다.
 *
 * 평문이므로 이스케이프하지 않습니다. 여기서 escapeHtml 을 쓰면 이름의 `&` 가 `&amp;` 로 그대로 보입니다.
 */
export function renderSignatureText(
  employee: EmployeeWithOrg,
  company: CompanyWithOffices,
  lang: Lang = "ko",
): string {
  const f = resolveFields(employee, company, lang);

  const lines = [
    [f.nameKo, f.roleText].filter(Boolean).join(" "),
    ...f.addresses,
    f.tel && `TEL ${f.tel}`,
    f.fax && `FAX ${f.fax}`,
    f.mobile && `MOBILE ${f.mobile}`,
    f.email && `E-MAIL ${f.email}`,
    `명함 보기: ${f.profileUrl}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}
