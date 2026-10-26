import { redirect } from "next/navigation";
import { BottomTabBar } from "@/components/BottomTabBar";
import { TopNav } from "@/components/TopNav";
import { getSession } from "@/lib/auth";
import { apiOrNull } from "@/lib/api";
import type { CompanyWithOffices } from "@/types";
import { CompanyEditor } from "./CompanyEditor";

/**
 * 회사 정보 관리. (admin 세션 필요 — middleware 가 보호)
 *
 * middleware 가 이미 막아주지만 세션을 여기서 다시 읽고 role 도 확인합니다.
 * matcher 를 손대다 /admin 이 빠지는 사고가 나도 페이지가 열리지 않게 하기 위함입니다.
 * (임직원 관리·조직 관리와 같은 방식)
 */
export const dynamic = "force-dynamic";

export default async function AdminCompanyPage() {
  const session = await getSession();
  if (!session) redirect("/gate?next=/admin/company");
  if (session.role !== "admin") redirect("/edit");

  // Company 는 1행만 존재합니다. 명함 서버의 첫 마이그레이션(V2__seed)이 만듭니다.
  const company = await apiOrNull<CompanyWithOffices>("/company");

  return (
    <>
      <TopNav role={session.role} current="/admin/company" />
      <main className="mx-auto w-full max-w-[1000px] px-group py-section sm:px-section sm:py-block">
        {company ? (
          <CompanyEditor company={company} />
        ) : (
          // 명함 서버 마이그레이션이 회사 1행을 넣습니다. 여기 오면 서버 DB 를 확인해야 합니다.
          <div className="py-block text-center">
            <h1 className="text-display">회사 정보가 없습니다</h1>
            <p className="mt-group text-body text-sub-text">
              명함 서버의 DB 마이그레이션이 적용됐는지 확인해 주세요.
            </p>
          </div>
        )}
      </main>
      <BottomTabBar role={session.role} current="/admin/company" />
    </>
  );
}
