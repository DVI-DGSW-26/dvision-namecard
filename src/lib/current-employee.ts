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
    const employee = otherSlug
      ? await prisma.employee.findUnique({
          where: { slug: otherSlug },
          include: employeeOrgInclude,
        })
      : await prisma.employee.findUnique({
          where: { id: session.employeeId! },
          include: employeeOrgInclude,
        });
    const company = await prisma.company.findFirst({ include: companyOfficesInclude });

    if (!employee || !company) return { kind: "not-found" };

    return {
      kind: "ok",
      role: session.role,
      employee,
      company,
      viewingOther: Boolean(otherSlug) && employee.id !== session.employeeId,
    };
  } catch {
    return { kind: "db-error" };
  }
}
