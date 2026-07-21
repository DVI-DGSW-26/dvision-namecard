import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listQuerySchema, type EmployeeListResponse } from "@/lib/employee-list";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * 직원 목록.
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

  const { q, department, status, page, pageSize } = parsed.data;
  const isAdmin = session.role === "admin";

  const where: Prisma.EmployeeWhereInput = {
    // 퇴사자는 관리자에게만 보입니다.
    ...(isAdmin ? {} : { status: { not: "RESIGNED" } }),
    ...(status && isAdmin ? { status } : {}),
    ...(department ? { department } : {}),
    ...(q
      ? {
          OR: [
            { nameKo: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows, departmentRows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      // 목업의 "수정일" 정렬. updatedAt 이 같을 때 순서가 흔들려 페이지 사이를
      // 오갈 때 행이 중복/누락되지 않도록 id 를 타이브레이커로 둡니다.
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        nameKo: true,
        department: true,
        rank: true,
        status: true,
        updatedAt: true,
        // 항상 조회한 뒤 아래 매핑에서 member 응답에는 넣지 않습니다.
        // select 에 boolean 변수를 넣으면 반환 타입이 union 으로 갈라져 다루기 번거롭습니다.
        email: true,
      },
    }),
    prisma.employee.findMany({
      where: { department: { not: null } },
      distinct: ["department"],
      orderBy: { department: "asc" },
      select: { department: true },
    }),
  ]);

  const body: EmployeeListResponse = {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameKo: row.nameKo,
      department: row.department,
      rank: row.rank,
      email: isAdmin ? (row.email ?? null) : null,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    departments: departmentRows
      .map((row) => row.department)
      .filter((name): name is string => Boolean(name)),
  };

  return NextResponse.json(body);
}

/**
 * 직원 추가. (스텁)
 * 구현 시: admin 세션인지 getSession() 으로 확인 → zod 검증 → buildSlug() 로 slug 생성.
 * middleware 는 /api/* 를 지나가지 않으므로 여기서 직접 권한을 확인해야 합니다.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ todo: "employees:create" }, { status: 501 });
}
