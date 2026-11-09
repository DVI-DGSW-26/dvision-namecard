import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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
    <AppShell role={session.role} current="/admin/company" title="회사 정보">
      <div className="w-full max-w-[960px] p-4 md:p-6">
        {company ? (
          <CompanyEditor company={company} />
        ) : (
          /*
            회사가 아직 없는 새 환경입니다. 여기서 만들게 하지 않는 이유: 회사 생성은
            첫 직원 등록과 함께 일어나는 부트스트랩 절차라(api/gate), 두 곳에서 만들 수
            있게 하면 회사가 둘이 되는 길이 생깁니다.
          */
          <div className="py-block text-center">
            <h2 className="text-base font-semibold">회사 정보가 없습니다</h2>
            <p className="mt-group text-sm text-fg-muted">
              임직원 관리에서 첫 직원을 등록하면 회사 정보가 만들어집니다.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
