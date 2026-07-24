import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generatePassword, hashPassword } from "../src/lib/password";

/**
 * 초기 비밀번호 발급 — 첫 관리자를 만들 때만 쓰는 스크립트입니다.
 *
 *   pnpm admin:password <이메일> [--member]
 *
 * 평소에는 관리자가 임직원 관리 화면에서 발급합니다. 이 스크립트가 필요한 경우는
 * 하나뿐입니다 — 관리자가 아직 아무도 없어서 그 화면에 들어갈 수 없을 때.
 * (관리자가 0명이 되는 걸 서버가 막고 있으므로, 정상 운영 중에는 생기지 않습니다)
 *
 * 이메일로 사람을 찾습니다. 없는 이메일이면 만들지 않고 멈춥니다 — 직원 등록은
 * 관리 화면의 일이고, 여기서 만들 수 있게 하면 그게 곧 뒷문이 됩니다.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  // 기본은 관리자입니다. 이 스크립트를 쓰는 상황 자체가 "관리자가 없다" 이기 때문입니다.
  const asMember = args.includes("--member");

  if (!email) {
    console.error("사용법: pnpm admin:password <이메일> [--member]");
    process.exit(1);
  }

  const employee = await prisma.employee.findUnique({
    where: { email },
    select: { id: true, nameKo: true, status: true },
  });

  if (!employee) {
    console.error(`${email} 로 등록된 직원이 없습니다. 임직원 관리에서 먼저 등록해 주세요.`);
    process.exit(1);
  }
  if (employee.status === "RESIGNED") {
    console.error(`${employee.nameKo} 님은 퇴사 처리 상태라 로그인할 수 없습니다.`);
    process.exit(1);
  }

  const password = generatePassword();
  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      role: asMember ? "MEMBER" : "ADMIN",
    },
  });

  console.log("");
  console.log(`  ${employee.nameKo} (${email})`);
  console.log(`  권한     ${asMember ? "직원" : "관리자"}`);
  console.log(`  비밀번호 ${password}`);
  console.log("");
  console.log("  첫 로그인에서 비밀번호를 바꾸게 됩니다. 이 값은 다시 볼 수 없습니다.");
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
