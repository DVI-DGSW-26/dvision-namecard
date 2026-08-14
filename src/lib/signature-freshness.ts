/**
 * "지금 메일 앱에 붙어 있는 서명이 낡았는가" 판정.
 *
 * 왜 필요한가: 서명은 한 번 복사해 메일 프로그램에 붙이면 그걸로 끝입니다. 그 뒤로
 * 프로필을 고치든 서명 구조를 고쳐 배포하든, **이미 붙여 놓은 서명은 저절로 바뀌지
 * 않습니다.** 그래서 지금까지는 고칠 때마다 전 직원에게 "다시 복사하세요" 공지를
 * 돌려야 했고, 공지를 놓친 사람은 옛 서명을 계속 내보냈습니다.
 *
 * 낡음의 조건은 두 가지고, 둘 다 "마지막으로 복사한 시각" 하나로 판정됩니다.
 *
 *   1) 내 프로필이 바뀌었다  — 복사 시각 < employee.updatedAt
 *      (휴대폰 공개를 켰는데 서명에는 안 나온다는 신고가 실제로 있었습니다)
 *   2) 서명 구조 자체가 바뀌었다 — 복사 시각 < SIGNATURE_FORMAT_CHANGED_AT
 *
 * 회사 값(대표번호·팩스·주소)이 바뀐 경우는 여기서 못 잡습니다 — Company 에 저장
 * 시각 컬럼이 없습니다. 그때는 여전히 공지가 필요합니다.
 */

/**
 * 서명 HTML 구조가 마지막으로 바뀐 시각.
 *
 * 이 값보다 먼저 복사한 사람은 전부 낡은 서명을 들고 있는 것으로 봅니다. 서명
 * 구조를 고쳐 배포할 때 **이 날짜를 배포일로 올리세요.** 안 올리면 아무도 안내를
 * 못 받고, 필요 없는데 올리면 전 직원이 헛되이 다시 복사합니다.
 *
 * 2026-08-14: 명함 이미지 아래에 글자 연락처 블록을 붙이고, 이미지 주소의 판 번호를
 * 쿼리에서 경로로 옮겼습니다. (고객사 메일 보안 장비가 이미지 한 장짜리 서명을
 * 피싱으로 보고 반송하던 건)
 */
export const SIGNATURE_FORMAT_CHANGED_AT = new Date("2026-08-14T00:00:00.000Z");

/**
 * 낡음 판정 — 순수 함수입니다.
 *
 * 저장소(localStorage)를 모릅니다. 판정 규칙만 여기 두면 테스트가 브라우저 없이
 * 붙고, 나중에 저장소를 DB 로 옮겨도 이 함수는 그대로입니다.
 */
export function isSignatureStale({
  copiedAt,
  profileUpdatedAt,
  formatChangedAt = SIGNATURE_FORMAT_CHANGED_AT,
}: {
  copiedAt: Date | null;
  profileUpdatedAt: Date;
  formatChangedAt?: Date;
}): boolean {
  // 한 번도 복사한 적이 없으면 낡은 게 아니라 아예 없는 것이지만, 화면에서 할 일은
  // 같습니다 — 복사하러 보내면 됩니다.
  if (!copiedAt) return true;

  return copiedAt < profileUpdatedAt || copiedAt < formatChangedAt;
}

/**
 * 복사 시각을 어디에 두는가 — localStorage 입니다. DB 가 아닌 이유:
 *
 * DB 에 두려면 Employee 에 컬럼을 하나 붙여야 하는데, 그 컬럼을 쓰는 순간
 * `updatedAt` 이 함께 갱신됩니다(@updatedAt). 그러면 복사할 때마다 프로필이 바뀐
 * 것으로 잡혀서 방금 복사한 사람에게 다시 "낡았다" 고 말하는 무한 루프가 되고,
 * 명함 이미지 주소(cardVersion 이 updatedAt 을 씁니다)까지 매번 달라집니다.
 * 피하려면 별도 테이블이나 raw SQL 이 필요한데, 안내 배너 하나에 운영 DB 마이그레이션을
 * 얹을 만한 값은 아닙니다.
 *
 * 대가: 브라우저마다 따로 셉니다. 집 PC 에서 복사하고 회사 PC 에서 열면 배너가 한 번
 * 더 뜹니다. 틀리는 방향이 "쓸데없이 한 번 더 복사하게 함" 이라 안전한 쪽입니다 —
 * 반대로 놓치는 것(안내를 못 받아 옛 서명을 계속 씀)이 지금 고치려는 문제입니다.
 */
const STORAGE_KEY_PREFIX = "dingdong.signature-copied.";

/** 복사 직후 배너가 스스로 사라지게 하려고 쏘는 신호. 같은 화면에 둘 다 있습니다. */
export const SIGNATURE_COPIED_EVENT = "dingdong:signature-copied";

function storageKey(employeeId: string): string {
  return `${STORAGE_KEY_PREFIX}${employeeId}`;
}

/**
 * 마지막 복사 시각. 없거나 읽을 수 없으면 null 입니다.
 *
 * try/catch 로 감싸는 이유: 사파리 프라이빗 모드나 쿠키 차단 설정에서는 접근 자체가
 * 던집니다. 배너 하나 때문에 화면이 깨지면 안 되므로 "모른다"(null)로 떨어뜨립니다 —
 * 그러면 배너가 뜨고, 사용자는 복사를 한 번 더 할 뿐입니다.
 */
export function readSignatureCopiedAt(employeeId: string): Date | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(employeeId));
    if (!raw) return null;

    const at = new Date(raw);
    return Number.isNaN(at.getTime()) ? null : at;
  } catch {
    return null;
  }
}

/** 복사 성공 시점에 기록합니다. 서식까지 제대로 복사된 경우에만 부르세요. */
export function markSignatureCopied(employeeId: string, at: Date = new Date()): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(employeeId), at.toISOString());
  } catch {
    // 저장을 못 해도 복사 자체는 된 것이라 사용자에게 알릴 일은 아닙니다.
    // 다음 방문에 배너가 다시 뜨는 정도로 끝납니다.
  }

  window.dispatchEvent(new Event(SIGNATURE_COPIED_EVENT));
}
