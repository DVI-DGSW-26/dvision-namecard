import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listQuerySchema, type EmployeeListResponse } from "@/lib/employee-list";
import { departmentText } from "@/lib/org";
import { defaultPositionId } from "@/lib/org-store";
import { prisma } from "@/lib/prisma";
import { buildSlug } from "@/lib/slug";
import { employeeCreateSchema, fieldErrors, fullNameKo } from "@/lib/validation";
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

  const { q, teamId, status, page, pageSize } = parsed.data;
  const isAdmin = session.role === "admin";

  const where: Prisma.EmployeeWhereInput = {
    // 퇴사자는 관리자에게만 보입니다.
    ...(isAdmin ? {} : { status: { not: "RESIGNED" } }),
    ...(status && isAdmin ? { status } : {}),
    ...(teamId ? { teamId } : {}),
    ...(q
      ? {
          OR: [
            { nameKo: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            // 부서가 관계로 바뀌어서 팀·파트 이름까지 훑습니다.
            { team: { name: { contains: q, mode: "insensitive" } } },
            { part: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows, teams] = await Promise.all([
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
        status: true,
        updatedAt: true,
        rank: { select: { name: true } },
        team: { select: { name: true } },
        part: { select: { name: true } },
        // 항상 조회한 뒤 아래 매핑에서 member 응답에는 넣지 않습니다.
        // select 에 boolean 변수를 넣으면 반환 타입이 union 으로 갈라져 다루기 번거롭습니다.
        email: true,
      },
    }),
    // 필터용 팀 목록. 직원이 아직 없는 팀도 골라 볼 수 있어야 하므로 조직 목록에서 그대로 가져옵니다.
    prisma.team.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const body: EmployeeListResponse = {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameKo: row.nameKo,
      department: departmentText(row) || null,
      rank: row.rank?.name ?? null,
      email: isAdmin ? (row.email ?? null) : null,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    teams,
  };

  return NextResponse.json(body);
}

/**
 * 직원 추가. (admin 전용)
 *
 * middleware 는 /api/* 를 지나가지 않으므로 여기서 직접 권한을 확인합니다.
 * 새 직원은 PENDING(초대중)으로 만듭니다. 본인이 /edit 에서 정보를 채우기 전까지
 * 공개 프로필에 완성된 명함이 뜨면 안 되기 때문입니다.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = employeeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const { familyName, givenName, email, rankId, teamId, partId, slug } = parsed.data;

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    return NextResponse.json(
      { error: "회사 정보가 없습니다. 먼저 회사 정보를 등록해 주세요." },
      { status: 409 },
    );
  }

  // 이메일과 slug 는 둘 다 unique 입니다. 어느 쪽이 걸렸는지 알려주려고 미리 확인하고,
  // 확인과 INSERT 사이의 경쟁은 아래 P2002 처리로 받습니다.
  const existingEmail = await prisma.employee.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingEmail) {
    return NextResponse.json(
      { errors: { email: "이미 등록된 이메일입니다." } },
      { status: 409 },
    );
  }

  let finalSlug = slug;
  if (finalSlug) {
    const taken = await prisma.employee.findUnique({
      where: { slug: finalSlug },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        { errors: { slug: "이미 사용 중인 주소입니다." } },
        { status: 409 },
      );
    }
  } else {
    const rows = await prisma.employee.findMany({ select: { slug: true } });
    finalSlug = buildSlug(
      { familyName, givenName },
      rows.map((row) => row.slug),
    );
    // 표에 없는 성이라 자동 생성이 불가능한 경우입니다. 관리자가 직접 정해야 합니다.
    if (!finalSlug) {
      return NextResponse.json(
        { errors: { slug: "이 성은 주소를 자동으로 만들 수 없습니다. 직접 입력해 주세요." } },
        { status: 422 },
      );
    }
  }

  try {
    const created = await prisma.employee.create({
      data: {
        slug: finalSlug,
        email,
        // vCard 를 위해 성·이름은 나눠서도 보관합니다. nameKo 는 표시용 합본이고,
        // 붙이는 규칙은 프로필 수정과 같은 fullNameKo 하나만 씁니다.
        nameKo: fullNameKo(familyName, givenName),
        familyName,
        givenName,
        rankId,
        teamId,
        partId,
        // 새 직원은 '팀원' 으로 시작합니다. 관리자가 목록에서 그 항목을 지웠으면 비워 둡니다.
        positionId: await defaultPositionId(),
        status: "PENDING",
        companyId: company.id,
      },
      select: { id: true, slug: true, nameKo: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (cause: unknown) {
    // 확인 이후에 같은 값이 먼저 들어간 경우. unique 제약이 최종 방어선입니다.
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "P2002") {
      return NextResponse.json(
        { error: "이미 등록된 이메일 또는 주소입니다. 다시 시도해 주세요." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}
