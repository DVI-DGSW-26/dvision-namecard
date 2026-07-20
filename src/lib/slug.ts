/**
 * 이름 → URL 슬러그 생성. (스텁)
 *
 * 구현 시 주의:
 * - 목표 형태는 `yg-ryu` 입니다. givenName 이니셜 + 성(로마자), 전부 소문자.
 *   한글 이름만 있는 경우 로마자 변환이 필요하므로 nameEn 을 우선 사용하고,
 *   없으면 관리자가 직접 입력하도록 두는 편이 안전합니다. (자동 음역은 오탈이 많음)
 * - Employee.slug 는 unique 입니다. 충돌 시 `-2`, `-3` 을 붙이는 책임은 호출부가
 *   아니라 여기서 지도록 만들 것. 그래서 기존 슬러그 목록을 인자로 받습니다.
 * - 공개 URL(/p/[slug])에 그대로 노출되므로 소문자·숫자·하이픈만 허용합니다.
 */
export function buildSlug(
  _input: { familyName: string; givenName: string; nameEn?: string | null },
  _taken: string[] = [],
): string {
  throw new Error("buildSlug: 아직 구현되지 않았습니다.");
}
