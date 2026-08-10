import { redirect } from "next/navigation";
import { BottomTabBar } from "@/components/BottomTabBar";
import { TopNav } from "@/components/TopNav";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

/**
 * 비밀번호 변경. (로그인 필요 — proxy 가 보호)
 *

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
