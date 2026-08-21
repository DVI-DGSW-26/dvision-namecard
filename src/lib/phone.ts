import type { Lang } from "@/lib/lang";

/**
 * 명함·서명·vCard 에 찍히는 전화번호 표기.
 *
 * 번호는 DB 에 국내 표기 그대로 들어 있습니다(`053-710-1022`, `010-1234-5678`).
 * 국문 카드는 그 값이 맞지만, 영문 카드를 받는 사람은 한국 밖에 있습니다 —
 * 앞자리 0 은 국내에서만 붙이는 국내 통화용 숫자라, 해외에서 그대로 누르면
 * 연결되지 않습니다. 영문 카드는 국가번호를 붙이고 그 0 을 뗍니다.
 *
 *   053-710-1022  →  +82-53-710-1022
 *   010-1234-5678 →  +82-10-1234-5678
 *
 * 국가번호 뒤도 하이픈으로 잇습니다(`+82 53-…` 이 아니라 `+82-53-…`). 번호가
 * 통째로 한 덩어리가 되어야 명함 이미지·서명에서 중간에 줄이 안 바뀝니다.
 * tel: 링크에도 그대로 실을 수 있습니다.
 */

/** 국가번호 — 전 직원이 한국 번호를 씁니다. 해외 지사가 생기면 여기가 갈라집니다. */
const KR_CODE = "+82";

/**
 * 국내 표기를 국제 표기로. 이미 `+` 로 시작하는 값은 손대지 않습니다 —
 * 직접 국제 표기로 적어 둔 번호를 두 번 감싸면 `+82-+82-…` 가 됩니다.
 *
 * 앞자리 0 이 없는 번호(1588-1234 같은 대표번호)는 0 만 안 떼고 국가번호를 붙입니다.
 */
export function internationalPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("+")) return trimmed;

  const national = trimmed.startsWith("0") ? trimmed.slice(1) : trimmed;
  return `${KR_CODE}-${national}`;
}

/**
 * 언어에 맞는 표기를 고릅니다. 국문은 저장된 값 그대로입니다.
 *
 * 값이 비면 null 을 돌려줍니다 — 부르는 쪽이 전부 "없으면 그 줄을 뺀다" 로
 * 움직이고 있어서, 빈 문자열을 그대로 넘기면 라벨만 남은 줄이 생깁니다.
 */
export function displayPhone(value: string | null | undefined, lang: Lang): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return lang === "en" ? internationalPhone(trimmed) : trimmed;
}
