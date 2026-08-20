/**
 * 명함의 언어.
 *
 * 국문과 영문은 주소가 갈립니다 — /c/hong 과 /c/hong/en. 같은 주소에서 토글만
 * 하면 외국 거래처에 영문 카드 링크를 바로 보낼 수 없고, 명함 이미지(card.png)도
 * 언어별로 따로 구울 수 없습니다.
 *
 * 영문 값이 비어 있으면 그 줄을 통째로 뺍니다. 한글로 대신 채우지 않습니다 —
 * 영문 명함에 한글이 섞이면 안 만든 것만 못합니다. 예외는 이름 하나뿐이고,
 * 이름 없는 명함은 명함이 아니라서 한글 이름으로 떨어집니다.
 */

export const LANGS = ["ko", "en"] as const;

export type Lang = (typeof LANGS)[number];

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

/**
 * 카드·서명·vCard 에 찍히는 이름. 영문 카드에 영문명이 없으면 null 입니다.
 *
 * 예전에는 영문명이 비면 한글 이름으로 떨어뜨렸습니다. "이름 없는 명함은 명함이
 * 아니다" 가 이유였는데, 그러면 영문 명함에 한글 이름이 남습니다. 다른 값은 전부
 * 빈 줄을 빼는 규칙을 지키는데 이름만 예외였던 셈이라, 영문 카드를 열면 딱 한 줄
 * 한글이 박혀 있었습니다.
 *
 * 그래서 예외를 없앱니다 — 이름을 못 채우면 그 사람의 영문 카드는 **아직 없습니다**.
 * 부르는 쪽(페이지 · card.png · vCard)이 null 을 받으면 404 로 답하고, 언어 토글도
 * English 를 내밀지 않습니다. 반쪽짜리 영문 명함을 내주는 것보다 없다고 말하는
 * 편이 정직합니다.
 */
export function cardName(
  employee: { nameKo: string; nameEn?: string | null },
  lang: Lang,
): string | null {
  return lang === "en" ? employee.nameEn?.trim() || null : employee.nameKo;
}

/**
 * cardName 의 non-null 판 — 라우트가 이미 404 로 막은 뒤, 실제로 카드를 조립하는
 * 자리에서 씁니다.
 *
 * 여기서 한글 이름으로 떨어뜨리지 않고 던지는 이유: 조용히 폴백하면 새 화면을
 * 만든 사람이 404 가드를 빠뜨려도 아무 일 없이 한글이 섞인 영문 카드가 나갑니다.
 * 그건 배포되고 나서야 알게 되는 종류의 사고입니다.
 */
export function requireCardName(
  employee: { nameKo: string; nameEn?: string | null },
  lang: Lang,
): string {
  const name = cardName(employee, lang);
  if (!name) throw new Error(`영문명이 없어 ${employee.nameKo} 의 영문 카드를 만들 수 없습니다.`);
  return name;
}

/** 공개 카드 주소. 국문은 언어 조각이 없습니다 — 기존 링크가 그대로 살아야 합니다. */
export function cardPath(slug: string, lang: Lang, suffix = ""): string {
  const base = `/c/${encodeURIComponent(slug)}${lang === "en" ? "/en" : ""}`;
  return suffix ? `${base}/${suffix}` : base;
}

/**
 * 명함 이미지 주소. 판 번호는 쿼리(`?v=`)가 아니라 경로에 넣습니다.
 *
 * 쿼리로 붙이면 메일 보안 게이트웨이가 수신 추적 픽셀과 구분하지 못합니다 —
 * "값이 매번 달라지는 쿼리가 달린 외부 이미지" 가 정확히 추적 픽셀의 생김새입니다.
 * 실제로 한 고객사 사내 보안에서 저희 메일이 통째로 격리됐습니다. 경로로 옮기면
 * 주소를 새로 만들어 캐시를 밀어내는 목적은 그대로 두고 그 생김새만 없앱니다.
 *
 * 번호를 안 주면 판 없는 주소가 나옵니다. 이미 나간 서명들이 그 주소를 쓰고 있어
 * 두 형태 모두 살아 있어야 합니다 — 지우면 그동안 보낸 메일의 명함이 전부 깨집니다.
 */
export function cardImagePath(slug: string, lang: Lang, version?: string): string {
  return cardPath(slug, lang, version ? `v/${encodeURIComponent(version)}/card.png` : "card.png");
}

/** 언어 토글에 보여 줄 이름. 각자 자기 언어로 적어야 못 읽는 쪽이 안 생깁니다. */
export const LANG_LABEL: Record<Lang, string> = {
  ko: "한국어",
  en: "English",
};

/**
 * 카드 화면의 고정 문구.
 *
 * 값(이름·직위·주소)은 DB 에서 오고, 여기 있는 건 화면이 스스로 그리는 말입니다.
 * 두 언어를 나란히 두면 한쪽만 고치고 넘어가는 일이 줄어듭니다.
 */
export const CARD_TEXT = {
  ko: {
    phone: "전화",
    mobile: "휴대폰",
    fax: "팩스",
    email: "이메일",
    saveCard: "눌러서 명함 이미지 저장",
    /**
     * 연락처 저장(.vcf) 버튼 문구.
     *
     * saveCard 와 다른 일입니다. 저건 명함 사진 한 장을 앨범에 남기는 것이고,
     * 이건 상대방 주소록에 번호·메일·주소가 들어가는 것입니다. 두 버튼이 한
     * 화면에 있으므로 문구만으로 구분이 돼야 합니다.
     */
    saveContact: "연락처 저장",
    /**
     * 이메일 서명에서 명함 이미지 아래에 붙는 버튼 문구.
     *
     * 서명 본체가 이미지 한 장이라 받는 사람은 그게 눌린다는 걸 모릅니다.
     * 이 버튼이 그걸 알려 주는 유일한 글자라, 눌렀을 때 도착하는 곳과 말이
     * 맞아야 합니다. 문구를 바꾸면 영문 쪽(en.signatureCta)도 같이 보세요.
     */
    signatureCta: "프로필 보러 가기 →",
    homepage: "회사 홈페이지",
    linkedin: "링크드인",
    youtube: "회사 소개 영상",
    instagram: "인스타그램",
    /** 명함 이미지 파일명과 alt 에 씁니다. */
    cardOf: (name: string) => `${name} 명함`,
  },
  en: {
    phone: "TEL",
    mobile: "MOBILE",
    fax: "FAX",
    email: "E-MAIL",
    saveCard: "Tap to save card image",
    saveContact: "Save contact",
    /*
      국문(프로필 보러 가기)과 같은 곳으로 갑니다. 예전 문구는 "Tap the card to save
      my contact" 였는데, 서명을 누르면 연락처가 저장되는 게 아니라 공개 카드가 열립니다.
      카드에 연락처 저장 버튼이 다시 생긴 지금도 그대로입니다 — 저장은 그 화면에서 한 번
      더 눌러야 하는 일이라, 서명의 문구는 실제로 도착하는 곳을 말합니다. 없는 동작을
      약속하는 버튼은 눌린 뒤에 신뢰를 깎습니다.
    */
    signatureCta: "View my profile →",
    homepage: "Company website",
    linkedin: "LinkedIn",
    youtube: "Company introduction video",
    instagram: "Instagram",
    cardOf: (name: string) => `${name} business card`,
  },
} satisfies Record<Lang, Record<string, unknown>>;
