import { NextResponse, type NextRequest } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { passwordChangeSchema } from "@/lib/validation";
import { fieldErrors } from "@/lib/validation";

/**
 * 본인 비밀번호 변경. 로그인한 사람이 자기 것만 바꿉니다.
 *
 * 관리자용 발급(/api/employees/[id]/password)과 나눠 둔 이유: 저쪽은 남의 비밀번호를
 * 새로 만들어 화면에 한 번 보여 주는 일이고, 이쪽은 현재 비밀번호를 아는 본인이
 * 바꾸는 일입니다. 한 라우트에 합치면 "현재 비밀번호 확인" 을 건너뛰는 분기가
 * 생기고, 그 분기가 곧 남의 비밀번호를 바꾸는 길이 됩니다.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.employeeId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { passwordHash: true, role: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "없는 계정입니다." }, { status: 404 });
  }

  // 세션만으로 바꾸게 두면 자리를 비운 사이 열린 화면으로 비밀번호를 갈아 끼울 수 있습니다.
  const ok = await verifyPassword(parsed.data.currentPassword, employee.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { errors: { currentPassword: "현재 비밀번호가 올바르지 않습니다." } },
      { status: 422 },
    );
  }

  try {
    await prisma.employee.update({
      where: { id: session.employeeId },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        // 초기 비밀번호를 벗어났습니다. 이걸 안 내리면 계속 변경 화면으로 돌아옵니다.
        mustChangePassword: false,
      },
    });
  } catch {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }

  /*
    세션을 다시 발급합니다.

    mustChangePassword 는 토큰 안에 있어서(middleware 가 Edge 라 DB 를 못 봅니다)
    DB 만 고치면 쿠키에는 여전히 true 가 남아, 바꾸고 나서도 변경 화면에 갇힙니다.
  */
  await createSession({
    role: session.role,
    employeeId: session.employeeId,
    mustChangePassword: false,
  });

  return NextResponse.json({ ok: true });
}
