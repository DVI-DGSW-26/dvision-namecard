import { tokens } from "@/config/tokens";
import { CARD_TEXT, cardImagePath, cardPath, requireCardName, type Lang } from "@/lib/lang";
import { officeLines, roleParts } from "@/lib/org";
import { displayPhone } from "@/lib/phone";
import type { CompanyWithOffices, EmployeeWithOrg } from "@/types";

/**
 * 이메일 서명 생성.
 *
 * 서명 본체는 명함을 통째로 구운 PNG 한 장입니다(/c/[slug]/card.png). 인쇄 명함 시안의
 * 넓은 자간과 좌우 두 단 격자를 메일 클라이언트(특히 Gmail·Outlook)의 HTML 로는 못
 * 만듭니다. 카드 전체를 이미지로 두면 종이 명함과 같은 한 장이 어느 클라이언트에서든
 * 동일하게 보입니다.
 *
 * 대가: 이미지라 안의 글자·번호는 눌리지 않습니다. 그래서 이미지 전체를 명함 프로필
 * 링크로 감쌉니다(클릭 → /c/[slug], 거기서 전화·저장 등 실제 동작). text/plain 만 읽는
 * 클라이언트는 renderSignatureText 를 받습니다.
 *
 * 이미지 아래에는 같은 연락처를 글자로 한 번 더 답니다(renderContact). 이미지 한 장이
 * 전부인 서명은 사내 메일 보안 게이트웨이가 피싱으로 셉니다 — 자세한 이유는 그쪽 주석에.
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
    // 영문 서명의 번호는 +82 국제 표기로 나갑니다 — 이유는 lib/phone.ts 에.
    tel: displayPhone(present(employee.telWork) ?? present(company.tel), lang),
    // mobilePublic 이 false 면 번호가 있어도 공개하지 않습니다.
    mobile: employee.mobilePublic ? displayPhone(employee.telMobile, lang) : null,
    // 팩스는 회사 공용 번호입니다.
    fax: displayPhone(company.fax, lang),
    email: present(employee.email),
    // 사업장이 여러 곳이면 전부 줄을 나눠 넣습니다. `(43011) 대구시 …` 형태입니다.
    // 영문은 영문 주소만 나갑니다 — 안 채운 사업장은 줄이 빠집니다.
    addresses: officeLines(company.offices, lang),
    profileUrl: `${baseUrl()}${cardPath(employee.slug, lang)}`,
  };
}

/**
 * 서명에 찍히는 연락처 조각.
 *
 * HTML 글자 블록과 text/plain 폴백이 여기 한 곳에서 값을 받습니다. 두 곳이 각자
 * 조립하면 한쪽만 고쳐서 같은 사람의 메일에 서로 다른 번호가 나가게 됩니다.
 * 묶는 방식만 다릅니다 — HTML 은 연락처 넷을 한 줄로 모으고(넷을 세로로 늘어놓으면
 * 글자 블록이 명함 이미지보다 길어집니다), 평문은 한 줄에 하나씩 둡니다.
 */
function contactParts(fields: ReturnType<typeof resolveFields>) {
  return {
    headline: [fields.nameKo, fields.roleText].filter(Boolean).join(" "),
    addresses: fields.addresses,
    contacts: [
      fields.tel && `TEL ${fields.tel}`,
      fields.fax && `FAX ${fields.fax}`,
      fields.mobile && `MOBILE ${fields.mobile}`,
      fields.email && `E-MAIL ${fields.email}`,
    ].filter(Boolean) as string[],
  };
}

/**
 * 명함 이미지 주소에 끼워 넣는 판(版) 번호.
 *
 * 왜 필요한가: 서명 본체는 /c/[slug]/card.png 한 장인데 주소가 언제나 같습니다.
 * 서버는 `max-age=0, must-revalidate` 로 내주지만 메일 쪽은 그 말을 안 듣습니다 —
 * Gmail 은 이미지를 자기 프록시(googleusercontent)로 옮겨 담고 주소가 같으면
 * 담아 둔 그림을 계속 내놓습니다. 그래서 프로필에서 휴대폰 공개를 켠 뒤 서명을
 * 다시 복사해도 붙는 그림은 켜기 전 명함입니다. (실제로 이렇게 신고됐습니다:
 * 웹 명함에는 휴대폰이 뜨는데 서명에는 안 뜬다)
 *
 * 저장 시각을 붙이면 프로필을 고칠 때마다 주소가 달라져, 다시 복사한 서명은
 * 프록시가 한 번도 본 적 없는 주소를 받습니다.
 *
 * 이 번호는 쿼리가 아니라 경로에 들어갑니다(/c/[slug]/v/<번호>/card.png). 이유는
 * cardImagePath 주석에 있습니다 — 쿼리로 붙이면 메일 보안 게이트웨이가 추적 픽셀로
 * 봅니다. 사진 주소(/c/[slug]/photo?v=)는 서명에 안 들어가므로 그대로 둡니다.
 *
 * 회사 값(대표번호·팩스·주소)만 바뀐 경우는 이 번호가 그대로입니다 — Company 에
 * 저장 시각 컬럼이 없습니다. 회사 값이 바뀌면 전 직원이 서명을 다시 넣어야 하는
 * 일이라, 그때는 안내로 처리합니다.
 *
 * 라우트는 이 값을 읽지 않습니다(쿼리는 무시하고 slug·언어로만 굽습니다). 주소를
 * 다르게 만드는 것 자체가 목적입니다.
 */
function cardVersion(employee: EmployeeWithOrg): string {
  return employee.updatedAt.getTime().toString(36);
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
 * 명함 이미지 아래에 붙는 글자 서명.
 *
 * 이미지에 이미 있는 값을 왜 또 글자로 적는가 — 세 가지 이유가 겹칩니다.
 *
 * 1) 사내 메일 보안 게이트웨이(APT·피싱 차단)는 "본문이 이미지 한 장뿐이고 그
 *    이미지가 통째로 외부 링크" 인 메일을 피싱으로 셉니다. 가짜 로그인 화면을
 *    이미지로 깔고 전체를 링크로 감싼 진짜 피싱이 정확히 그 모양이라, 필터 입장에서
 *    구분할 방법이 없습니다. 실제로 한 고객사에서 저희 메일이 전부 격리됐습니다
 *    (다른 수신처는 멀쩡했습니다 — 그 회사 게이트웨이만 그렇게 셉니다).
 *    읽을 수 있는 글자가 본문에 있으면 그 패턴이 깨집니다.
 * 2) 이미지를 기본으로 막는 클라이언트(아웃룩)에서는 alt 한 줄이 전부였습니다.
 * 3) 이미지 안의 글자는 드래그가 안 됩니다. 받는 사람이 번호를 옮겨 적으려면
 *    눈으로 보고 손으로 쳐야 했습니다.
 *
 * 카드 모양은 건드리지 않습니다 — 이미지 아래에 보조 색(subText)으로 작게 답니다.
 * 카드가 계속 주인공이고 이 블록은 필터와 이미지 차단 수신자를 위한 보험입니다.
 *
 * 링크는 하나도 넣지 않습니다(이메일도 mailto 로 걸지 않음). 링크 수를 늘리는 건
 * 이 블록을 넣는 목적과 정반대입니다.
 */
const CONTACT_STYLE =
  `font-family:${CTA_FONT};font-size:${tokens.font.caption.size}px;` +
  `font-weight:${tokens.font.caption.weight};line-height:${tokens.lineHeight};` +
  `letter-spacing:${tokens.letterSpacing};color:${tokens.color.subText};`;

function renderContact(parts: ReturnType<typeof contactParts>): string {
  const lines = [
    // 이름·직함만 본문 색으로 올립니다. 나머지는 보조 색이라 카드를 안 이깁니다.
    parts.headline &&
      `<span style="color:${tokens.color.text};font-weight:${tokens.font.captionBold.weight};">${escapeHtml(parts.headline)}</span>`,
    ...parts.addresses.map(escapeHtml),
    parts.contacts.map(escapeHtml).join(" · "),
  ].filter(Boolean);

  // <br /> 로 줄을 나눕니다. 줄마다 <p>·<div> 를 두면 아웃룩이 사이에 제멋대로
  // 여백을 넣어, 줄 간격이 클라이언트마다 달라집니다.
  return lines.join("<br />");
}

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
  company: CompanyWithOffices,
  lang: Lang = "ko",
): string {
  // 카드 안의 값은 이미지 라우트가 DB 에서 직접 읽습니다. company 가 여기에도 필요한
  // 건 이미지 아래 글자 블록 때문입니다 — 대표번호·팩스·주소가 회사 값입니다.
  const base = baseUrl();
  const cardUrl = `${base}${cardImagePath(employee.slug, lang, cardVersion(employee))}`;
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
    // 글자 블록은 카드 폭에 맞춰 가둡니다. width 속성을 같이 적는 건 이미지와 같은
    // 이유입니다 — 아웃룩은 style 의 width 를 무시하고 속성만 봅니다.
    `<tr><td width="${CARD_DISPLAY_WIDTH}" style="padding:${tokens.space.group}px 0 0;width:${CARD_DISPLAY_WIDTH}px;max-width:100%;${CONTACT_STYLE}">` +
    renderContact(contactParts(resolveFields(employee, company, lang))) +
    `</td></tr>` +
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
  const parts = contactParts(f);

  // 평문에서는 연락처를 한 줄에 하나씩 둡니다. 세로로 길어져도 상관없고,
  // 오히려 그 편이 주소록에 옮겨 적기 쉽습니다. (HTML 은 한 줄로 모읍니다)
  const lines = [
    parts.headline,
    ...parts.addresses,
    ...parts.contacts,
    `명함 보기: ${f.profileUrl}`,
  ].filter(Boolean);

  return lines.join("\n");
}
