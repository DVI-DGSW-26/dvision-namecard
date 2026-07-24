import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePassword, hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

/**
 * 초기 비밀번호 발급·재발급. (admin 전용)
 *
 * 만든 비밀번호를 응답으로 **한 번만** 돌려줍니다. 저장되는 건 해시뿐이라 이 응답을
 * 놓치면 다시 볼 수 없고, 그때는 또 발급하면 됩니다. 관리자가 값을 정하게 두지 않는
 * 이유는 password.ts 의 generatePassword 주석에 적어 두었습니다.
 *
 * 받은 사람은 첫 로그인에서 곧바로 변경 화면으로 갑니다(mustChangePassword).
 * 관리자도 아는 비밀번호를 계속 쓰면, 그 사람으로 남은 흔적과 본인의 흔적을
 * 구분할 수 없습니다.
 */
export async function POST(_request: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { email: true, nameKo: true, status: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "없는 직원입니다." }, { status: 404 });
  }
  // 퇴사자는 로그인 자체가 막혀 있어서 발급해 봐야 쓸 수 없습니다. 쓸모없는 비밀번호를
  // 만들어 전달하는 사고를 여기서 막습니다.
  if (employee.status === "RESIGNED") {
    return NextResponse.json(
      { error: "퇴사 처리된 직원입니다. 상태를 되돌린 뒤에 발급해 주세요." },
      { status: 409 },
    );
  }

  const password = generatePassword();

  try {
    await prisma.employee.update({
      where: { id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true },
    });
  } catch {
    return NextResponse.json({ error: "발급하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, password, email: employee.email, nameKo: employee.nameKo });
}
