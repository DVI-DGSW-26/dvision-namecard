import { defaultPositionId } from "./org-store";
import { prisma } from "./prisma";
import { buildSlug } from "./slug";
import type { Authenticated } from "./auth";

/**
 * SSO 계정 ↔ 명함 연결. (연동 가이드 §5의 순서 그대로)
 *
 *   ① ssoSubject 조회 — 두 번째 로그인부터 항상 여기
 *   ② 이메일 조회     — 최초 1회, 기존 명함에 연결
 *   ③ 없으면 생성     — SSO 의 employee 게이트를 통과한 재직자만 온다
 *
 * 영구 키는 sub 입니다. 이메일은 관리자가 바꿀 수 있어 계속 이메일로
 * 찾으면 주소가 바뀔 때 계정이 갈라집니다.
 *
 * 역할(MEMBER/ADMIN)은 이 앱이 계속 관리합니다(패턴 B) — SSO 는
 * "우리 직원인가"만 답하고, 명함 관리자 권한은 여기서 정합니다.
 *
 * prisma 를 쓰므로 Node 런타임 전용입니다.
 */
export async function findOrLinkEmployee(
  sub: string,
  email: string,
  displayName: string,
): Promise<Authenticated | null> {
  // ① 이미 연결된 명함
  const bySub = await prisma.employee.findUnique({
    where: { ssoSubject: sub },
    select: { id: true, role: true, status: true },
  });
  if (bySub) {
    // SSO 쪽이 재직 중이어도 명함 쪽에서 퇴사 처리했으면 막습니다.
    if (bySub.status === "RESIGNED") return null;
    return {
      employeeId: bySub.id,
      role: bySub.role === "ADMIN" ? "admin" : "member",
      mustChangePassword: false,
    };
  }

  // ② 이메일로 기존 명함 연결 (최초 1회)
  const normalized = email.trim().toLowerCase();
  if (normalized) {
    const byEmail = await prisma.employee.findUnique({
      where: { email: normalized },
      select: { id: true, role: true, status: true },
    });
    if (byEmail) {
      if (byEmail.status === "RESIGNED") return null;
      await prisma.employee.update({
        where: { id: byEmail.id },
        data: { ssoSubject: sub },
      });
      return {
        employeeId: byEmail.id,
        role: byEmail.role === "ADMIN" ? "admin" : "member",
        mustChangePassword: false,
      };
    }
  }

  // ③ 새 명함. SSO 게이트(employee 롤)를 통과했으므로 재직자가 맞습니다.
  //    비밀번호는 만들지 않습니다 — 이 사람은 SSO 로만 들어옵니다.
  //    이름·부서는 본인이 /edit 에서 채웁니다 (기존 공용 비밀번호 경로와 동일).
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) return null;

  const localPart = normalized.split("@")[0] || "member";
  const taken = (await prisma.employee.findMany({ select: { slug: true } })).map((row) => row.slug);
  const slug = buildSlug({ familyName: localPart }, taken) ?? `member${taken.length + 1}`;

  try {
    const created = await prisma.employee.create({
      data: {
        // SSO 계정에 이메일이 없는 직원(생산직 일부)은 계정 식별자를 자리에 둡니다.
        // email 은 unique 라 비워 둘 수 없습니다. 본인·관리자가 나중에 바로잡습니다.
        email: normalized || `${sub}@sso.local`,
        ssoSubject: sub,
        slug,
        nameKo: displayName || localPart,
        familyName: "",
        givenName: displayName || localPart,
        positionId: await defaultPositionId(),
        status: "ACTIVE",
        passwordHash: null,
        mustChangePassword: false,
        companyId: company.id,
      },
      select: { id: true },
    });
    return { employeeId: created.id, role: "member", mustChangePassword: false };
  } catch {
    // 같은 계정으로 동시에 들어오면 unique 제약(ssoSubject·email)에 걸립니다.
    // 이미 만들어진 것을 다시 집습니다.
    const existing = await prisma.employee.findFirst({
      where: { OR: [{ ssoSubject: sub }, ...(normalized ? [{ email: normalized }] : [])] },
      select: { id: true, role: true, status: true },
    });
    if (!existing || existing.status === "RESIGNED") return null;
    return {
      employeeId: existing.id,
      role: existing.role === "ADMIN" ? "admin" : "member",
      mustChangePassword: false,
    };
  }
}
