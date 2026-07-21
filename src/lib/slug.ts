/**
 * 이름 → URL 슬러그 생성.
 *
 * 규칙: 성(family name)의 로마자만 소문자로 씁니다. `류영균` → `ryu`
 * 중복되면 뒤에 숫자를 붙입니다. `ryu` → `ryu2` → `ryu3` (하이픈 없음)
 *
 * 공개 URL(/c/[slug])에 그대로 노출되므로 소문자·숫자만 남깁니다.
 */

/**
 * 한글 성 → 로마자. 흔한 성만 담았습니다.
 *
 * 자동 음역은 오탈이 많아(류/유, 이/리, 박/pak 등 표기가 갈림) 표를 두고 갑니다.
 * 표에 없으면 nameEn 에서 성을 뽑고, 그것도 없으면 호출부가 직접 입력받아야 합니다.
 */
const FAMILY_NAME_ROMAJI: Record<string, string> = {
  김: "kim",
  이: "lee",
  박: "park",
  최: "choi",
  정: "jung",
  강: "kang",
  조: "cho",
  윤: "yoon",
  장: "jang",
  임: "lim",
  한: "han",
  오: "oh",
  서: "seo",
  신: "shin",
  권: "kwon",
  황: "hwang",
  안: "ahn",
  송: "song",
  전: "jeon",
  홍: "hong",
  유: "yoo",
  류: "ryu",
  고: "ko",
  문: "moon",
  양: "yang",
  손: "son",
  배: "bae",
  백: "baek",
  허: "heo",
  남: "nam",
  심: "shim",
  노: "noh",
  하: "ha",
  곽: "kwak",
  성: "sung",
  차: "cha",
  주: "joo",
  우: "woo",
  구: "koo",
  민: "min",
};

/** 소문자·숫자만 남깁니다. 공개 URL 에 들어가므로 그 외 문자는 전부 버립니다. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * nameEn 에서 성을 추출합니다.
 *
 * `Yeong-gyun Ryu` 처럼 "이름 성" 순서로 들어오는 걸 기본으로 보고 마지막 토큰을 씁니다.
 * `Ryu, Yeong-gyun` 처럼 쉼표가 있으면 앞쪽이 성입니다.
 */
function familyNameFromEnglish(nameEn: string): string | null {
  const trimmed = nameEn.trim();
  if (!trimmed) return null;

  const source = trimmed.includes(",")
    ? trimmed.split(",")[0]
    : trimmed.split(/\s+/).at(-1);

  const normalized = normalize(source ?? "");
  return normalized || null;
}

/**
 * 슬러그의 기본형(숫자 붙이기 전)을 만듭니다. 만들 수 없으면 null.
 * 슬러그를 자동 생성할 수 있는지 미리 확인할 때 씁니다.
 */
export function baseSlug(input: {
  familyName: string;
  givenName?: string;
  nameEn?: string | null;
}): string | null {
  const mapped = FAMILY_NAME_ROMAJI[input.familyName.trim()];
  if (mapped) return mapped;

  // 성이 이미 로마자로 들어온 경우 (외국인 직원 등)
  const direct = normalize(input.familyName);
  if (direct) return direct;

  return input.nameEn ? familyNameFromEnglish(input.nameEn) : null;
}

/**
 * 사용 가능한 슬러그를 만듭니다. `taken` 에 이미 있으면 2 부터 숫자를 붙입니다.
 *
 * 충돌 해소를 호출부에 맡기면 저장 시점에 unique 제약으로 터지므로 여기서 처리합니다.
 * 자동 생성이 불가능하면(표에 없는 성 + nameEn 없음) null 을 반환하니,
 * 호출부는 관리자에게 직접 입력받아야 합니다.
 */
export function buildSlug(
  input: { familyName: string; givenName?: string; nameEn?: string | null },
  taken: Iterable<string> = [],
): string | null {
  const base = baseSlug(input);
  if (!base) return null;

  const used = new Set(Array.from(taken, (s) => s.toLowerCase()));
  if (!used.has(base)) return base;

  // ryu → ryu2 → ryu3 …
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}
