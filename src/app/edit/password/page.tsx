import { redirect } from "next/navigation";
import { BottomTabBar } from "@/components/BottomTabBar";
import { TopNav } from "@/components/TopNav";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

/**
 * 비밀번호 변경. (로그인 필요 — middleware 가 보호)
 *
 * 초기 비밀번호로 들어온 사람은 middleware 가 여기로 보냅니다. 그 경우에는 위아래
 * 메뉴를 그리지 않습니다 — 다른 화면으로 갈 수 있는 것처럼 보이는데 눌러 봐야
 * 다시 여기로 튕기면, 앱이 고장 난 것처럼 읽힙니다.
 */
export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const session = await getSession();
  if (!session) redirect("/gate?next=%2Fedit%2Fpassword");

  const forced = session.mustChangePassword;

  return (
    <>
      {forced ? null : <TopNav role={session.role} current="/edit/password" />}
      <main className="mx-auto w-full max-w-[720px] px-group py-section sm:px-section sm:py-block">
        <PasswordForm forced={forced} />
      </main>
      {forced ? null : <BottomTabBar role={session.role} current="/edit/password" />}
    </>
  );
}
