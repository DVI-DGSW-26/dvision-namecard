import type { Company, Employee } from "@/types";

/**
 * 이메일 서명 HTML 을 생성합니다. (스텁)
 *
 * 구현 시 주의:
 * - Outlook/네이버 등 구형 메일 클라이언트 호환을 위해 table 레이아웃 + 인라인 스타일만 사용.
 *   외부 CSS, flex/grid, <style> 블록은 모두 제거됩니다.
 * - 이미지와 프로필 링크는 NEXT_PUBLIC_BASE_URL 기준 절대 URL 이어야 합니다.
 * - mobilePublic 이 false 면 telMobile 을 노출하지 않습니다.
 */
export function buildSignatureHtml(_employee: Employee, _company: Company): string {
  throw new Error("buildSignatureHtml: 아직 구현되지 않았습니다.");
}
