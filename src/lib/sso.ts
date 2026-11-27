import { ensureCardFor, lookupAccount, type Authenticated } from "./auth";

/**
 * SSO 계정 ↔ 명함 연결. SSO 이메일과 인사 이메일이 같은 직원을 찾습니다.
 *
 * 연결 정보를 명함 쪽에 따로 저장하지 않습니다. 인사 시스템이 원본이라, 인사에서
 * 이메일을 고치면 명함도 그대로 따라갑니다. 인사에 없는 사람은 SSO 롤이 있어도
 * 들어올 수 없습니다 — 명함은 인사에 등록된 직원의 것입니다.
 *
 * 역할(MEMBER/ADMIN)은 이 앱이 계속 관리합니다(패턴 B) — SSO 는
 * "우리 직원인가"만 답하고, 명함 관리자 권한은 여기서 정합니다.
 */
export async function findOrLinkEmployee(email: string): Promise<Authenticated | null> {
  const normalized = email.trim().toLowerCase();
  const employee = normalized ? await lookupAccount({ email: normalized }) : null;

  // SSO 쪽이 재직 중이어도 인사에서 퇴사 처리했으면 막습니다.
  if (!employee || employee.status === "RESIGNED") return null;

  // 인사에 막 등록된 사람은 명함이 아직 없습니다. 첫 로그인에서 만듭니다.
  await ensureCardFor(employee);

  return {
    employeeId: employee.id,
    role: employee.role === "ADMIN" ? "admin" : "member",
    mustChangePassword: false,
  };
}
