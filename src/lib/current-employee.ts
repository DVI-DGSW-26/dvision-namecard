import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/session-token";
import {
  companyOfficesInclude,
  employeeOrgInclude,
  type CompanyWithOffices,
  type EmployeeWithOrg,
} from "@/types";

/**
 * "지금 편집할 대상" 을 정합니다. /edit 과 /edit/signature 가 같이 씁니다.
 *
 * 기본은 세션의 employeeId — 게이트에서 사내 이메일로 확인한 본인입니다.
 * 관리자만 ?e=<slug> 로 다른 사람을 열 수 있습니다. 회원이 같은 쿼리를 붙여도
 * 무시하고 본인을 엽니다. 안 그러면 주소창만 고쳐서 남의 명함을 편집할 수 있습니다.
 */

export type ResolveResult =
  | {
      kind: "ok";
      role: Role;
      employee: EmployeeWithOrg;
      company: CompanyWithOffices;
      viewingOther: boolean;
    }
  | { kind: "no-session" }
  | { kind: "no-self" }
  | { kind: "not-found" }
  | { kind: "db-error" };

export async function resolveEditTarget(slugParam?: string): Promise<ResolveResult> {
  const session = await getSession();
  if (!session) return { kind: "no-session" };

  const isAdmin = session.role === "admin";
  // 회원이 붙인 ?e= 는 버립니다. 관리자만 남의 것을 열 수 있습니다.
  const otherSlug = isAdmin && slugParam ? slugParam : null;

  // 직원이 한 명도 없을 때 들어온 관리자(부트스트랩)는 열 명함이 없습니다.
  if (!otherSlug && !session.employeeId) return { kind: "no-self" };

  try {
    /*
     * 회사를 따로 조회하지 않고 직원에 붙여서 한 번에 읽습니다.
     *
     * 예전에는 employee 를 읽고 나서 company 를 또 읽었는데, DB 가 싱가포르에
     * 있어 그 한 줄이 그대로 80ms 였습니다. Employee.companyId 는 not null 이라
     * 직원이 있으면 회사는 반드시 딸려 옵니다. (공개 카드도 같은 방식입니다 —
     * app/c/[slug]/profile.tsx 의 getProfile)
     */
    const employee = await prisma.employee.findUnique({
      where: otherSlug ? { slug: otherSlug } : { id: session.employeeId! },
      include: { company: { include: companyOfficesInclude }, ...employeeOrgInclude },
      // 관계마다 SELECT 를 따로 보내지 않고 한 번에 조인합니다. (schema.prisma 의 relationJoins)
      relationLoadStrategy: "join",
    });

    if (!employee) return { kind: "not-found" };

    return {
      kind: "ok",
      role: session.role,
      employee,
      company: employee.company,
      viewingOther: Boolean(otherSlug) && employee.id !== session.employeeId,
    };
  } catch {
    return { kind: "db-error" };
  }
}
