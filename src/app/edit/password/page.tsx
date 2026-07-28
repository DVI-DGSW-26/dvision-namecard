import { redirect } from "next/navigation";
import { BottomTabBar } from "@/components/BottomTabBar";
import { TopNav } from "@/components/TopNav";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

/**
 * 비밀번호 변경. (로그인 필요 — proxy 가 보호)
 *
 * 스스로 바꾸러 오는 화면입니다. 강제 변경(초기 비번으로 들어온 사람을 여기로
 * 가두던 흐름)은 없앴으므로, 항상 위아래 메뉴를 그려서 언제든 다른 화면으로
 * 나갈 수 있게 합니다.
 */
export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const session = await getSession();
  if (!session) redirect("/gate?next=%2Fedit%2Fpassword");

  return (
    <>
      <TopNav role={session.role} current="/edit/password" />
      <main className="mx-auto w-full max-w-[720px] px-group py-section sm:px-section sm:py-block">
        <PasswordForm forced={false} />
      </main>
      <BottomTabBar role={session.role} current="/edit/password" />
    </>
  );
}
