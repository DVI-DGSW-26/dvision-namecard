import { api, ensureCards, json } from "../src/lib/api";
import type { AccountLookup } from "../src/lib/auth";
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
 * 인사 시스템에 등록된 이메일이어야 합니다. 직원은 인사가 만들고, 여기서는 만들지
 * 않습니다. 명함 서버(NAMECARD_API_URL)가 떠 있어야 합니다.
 */
async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  const asMember = args.includes("--member");

  if (!email) {
    console.error("사용법: pnpm admin:password <이메일> [--member]");
    process.exit(1);
  }

  const lookup = () =>
    api<AccountLookup>(`/auth/lookup?${new URLSearchParams({ email })}`).catch(() => null);

  let employee = await lookup();
  if (!employee) {
    console.error(`${email} 로 등록된 직원이 인사 시스템에 없습니다.`);
    process.exit(1);
  }
  if (employee.status === "RESIGNED") {
    console.error(`${email} 은(는) 인사 시스템에서 퇴사 처리된 직원이라 로그인할 수 없습니다.`);
    process.exit(1);
  }
  // 인사에 막 등록돼 명함이 아직 없으면 만듭니다. 비밀번호·권한은 명함 행에 저장됩니다.
  if (!employee.slug) {
    await ensureCards();
    employee = (await lookup())!;
  }

  const password = generatePassword();
  await api(
    `/employees/${employee.id}/password`,
    json("PUT", { passwordHash: await hashPassword(password), mustChangePassword: true }),
  );
  await api(
    `/employees/${employee.id}/admin`,
    json("PATCH", { slug: employee.slug, role: asMember ? "MEMBER" : "ADMIN" }),
  );

  console.log("");
  console.log(`  ${email}`);
  console.log(`  권한     ${asMember ? "직원" : "관리자"}`);
  console.log(`  비밀번호 ${password}`);
  console.log("");
  console.log("  첫 로그인에서 비밀번호를 바꾸게 됩니다. 이 값은 다시 볼 수 없습니다.");
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
