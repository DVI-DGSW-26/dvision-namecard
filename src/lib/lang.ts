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

/** 공개 카드 주소. 국문은 언어 조각이 없습니다 — 기존 링크가 그대로 살아야 합니다. */
export function cardPath(slug: string, lang: Lang, suffix = ""): string {
  const base = `/c/${encodeURIComponent(slug)}${lang === "en" ? "/en" : ""}`;
  return suffix ? `${base}/${suffix}` : base;
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
    homepage: "Company website",
    linkedin: "LinkedIn",
    youtube: "Company introduction video",
    instagram: "Instagram",
    cardOf: (name: string) => `${name} business card`,
  },
} satisfies Record<Lang, Record<string, unknown>>;
