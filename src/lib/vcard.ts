import type { Company, Employee } from "@/types";

/**
 * vCard 3.0 문자열을 생성합니다. (스텁)
 *
 * 구현 시 주의:
 * - N 필드는 `familyName;givenName;;;` 형태여야 합니다. (예: `류;영균;;;`)
 *   nameKo 를 쪼개지 말고 반드시 분리 저장된 컬럼을 쓸 것.
 * - 줄바꿈은 CRLF(\r\n), 75옥텟 초과 시 line folding 필요.
 * - 한글이 들어가므로 UTF-8 로 인코딩해 내려줄 것.
 * - mobilePublic 이 false 면 telMobile 을 포함하지 않습니다.
 */
export function buildVCard(_employee: Employee, _company: Company): string {
  throw new Error("buildVCard: 아직 구현되지 않았습니다.");
}
