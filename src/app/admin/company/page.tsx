import { redirect } from "next/navigation";
import { BottomTabBar } from "@/components/BottomTabBar";
import { TopNav } from "@/components/TopNav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { companyOfficesInclude } from "@/types";
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

  // Company 는 1행만 존재하는 모델입니다.
  const company = await prisma.company.findFirst({ include: companyOfficesInclude });

  return (
    <>
      <TopNav role={session.role} current="/admin/company" />
      <main className="mx-auto w-full max-w-[1000px] px-group py-section sm:px-section sm:py-block">
        {company ? (
          <CompanyEditor company={company} />
        ) : (
          /*
            회사가 아직 없는 새 환경입니다. 여기서 만들게 하지 않는 이유: 회사 생성은
            첫 직원 등록과 함께 일어나는 부트스트랩 절차라(api/gate), 두 곳에서 만들 수
            있게 하면 회사가 둘이 되는 길이 생깁니다.
          */
          <div className="py-block text-center">
            <h1 className="text-display">회사 정보가 없습니다</h1>
            <p className="mt-group text-body text-sub-text">
              임직원 관리에서 첫 직원을 등록하면 회사 정보가 만들어집니다.
            </p>
          </div>
        )}
      </main>
      <BottomTabBar role={session.role} current="/admin/company" />
    </>
  );
}
