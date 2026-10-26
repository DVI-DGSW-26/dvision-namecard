import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api, ensureCards } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { listQuerySchema, type EmployeeListResponse } from "@/lib/employee-list";
import { departmentText } from "@/lib/org";
import { readOrgLists } from "@/lib/org-store";
import type { EmployeeWithOrg } from "@/types";

/**
 * 직원 목록.
 *
 * 직원은 인사 시스템에서 옵니다. 여기서 추가·삭제하지 않습니다 — 입사자는 인사에
 * 등록되면 다음 목록 조회 때 명함이 만들어지고(ensureCards), 퇴사는 인사에서
 * 처리하면 명함이 닫힙니다.
 *
 * middleware 는 /api/* 를 지나가지 않으므로 여기서 직접 세션을 확인합니다.
 * - admin: /admin 임직원 관리 표. RESIGNED 포함, email 포함.
 * - member: /edit 의 본인 선택용. RESIGNED 제외, email 은 내려주지 않습니다.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = listQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { q, teamId, status, page, pageSize } = parsed.data;
  const isAdmin = session.role === "admin";

  await ensureCards();

  const params = new URLSearchParams({
    q,
    teamId,
    page: String(page),
    pageSize: String(pageSize),
    // 퇴사자는 관리자에게만 보입니다.
    includeResigned: String(isAdmin),
  });
  if (status && isAdmin) params.set("status", status);

  const [{ items, total }, org] = await Promise.all([
    api<{ items: (EmployeeWithOrg & { updatedAt: string })[]; total: number }>(`/employees?${params}`),
    readOrgLists(),
  ]);

  const body: EmployeeListResponse = {
    items: items.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameKo: row.nameKo,
      department: departmentText(row) || null,
      rank: row.rank?.name ?? null,
      email: isAdmin ? (row.email ?? null) : null,
      status: row.status,
      role: row.role,
      hasPassword: row.hasPassword,
      updatedAt: row.updatedAt,
    })),
    total,
    page,
    pageSize,
    // 필터용 팀 목록. 직원이 아직 없는 팀도 골라 볼 수 있어야 하므로 조직 목록에서 그대로 가져옵니다.
    teams: org.teams.map((team) => ({ id: team.id, name: team.name })),
  };

  return NextResponse.json(body);
}
